// Small helpers around the Web Share API with graceful fallbacks.

/** Shares plain text via the OS share sheet, falling back to the clipboard. */
export async function shareText(text: string, title?: string): Promise<'shared' | 'copied' | 'none'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (err) {
      // User cancelled or share failed — fall through to clipboard
      if (err instanceof DOMException && err.name === 'AbortError') return 'none';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'none';
  }
}

/** Resolves `var(--x)` references in a serialized SVG to concrete values. */
function resolveCssVars(markup: string): string {
  const root = getComputedStyle(document.documentElement);
  return markup.replace(/var\((--[a-z0-9-]+)\)/gi, (_, name: string) => {
    const value = root.getPropertyValue(name).trim();
    return value || 'transparent';
  });
}

/** Rasterizes an SVG element (e.g. a chart) to a PNG blob on a solid background. */
export async function svgToPngBlob(
  svg: SVGSVGElement,
  options: { scale?: number; background?: string } = {},
): Promise<Blob> {
  const scale = options.scale ?? 2;
  const rect = svg.getBoundingClientRect();
  const width = rect.width || Number(svg.getAttribute('width')) || 600;
  const height = rect.height || Number(svg.getAttribute('height')) || 300;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  const serialized = resolveCssVars(new XMLSerializer().serializeToString(clone));
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;

  const img = new Image();
  img.width = width;
  img.height = height;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Kon grafiek niet omzetten naar afbeelding.'));
    img.src = svgUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas niet beschikbaar.');

  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Kon afbeelding niet genereren.'))),
      'image/png',
    );
  });
}

/** Shares an image file via the share sheet, falling back to a download. */
export async function shareImage(blob: Blob, filename: string, title?: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }
  // Fallback: trigger a download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
