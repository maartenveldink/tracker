import { useMemo, type ReactNode } from 'react';

export interface ChartColors {
  line: string;
  muted: string;
  text: string;
  surface: string;
  accent: string;
  accent2: string;
}

/** Fallbacks equal `src/styles/tokens.css`; only used when the CSS variables are unreadable. */
const FALLBACK: ChartColors = {
  line: '#26324f',
  muted: '#9aa6c2',
  text: '#f1f4fb',
  surface: '#131a2b',
  accent: '#c8f135',
  accent2: '#7c9cff',
};

/**
 * Design tokens resolved to concrete colours. Recharts output is also serialised
 * to a PNG for sharing, where `var(--...)` would not resolve, so charts get
 * real values read from `tokens.css`.
 */
export function useChartColors(): ChartColors {
  return useMemo(() => {
    if (typeof document === 'undefined') return FALLBACK;
    const css = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    return {
      line: read('--color-line', FALLBACK.line),
      muted: read('--color-muted', FALLBACK.muted),
      text: read('--color-text', FALLBACK.text),
      surface: read('--color-surface', FALLBACK.surface),
      accent: read('--color-accent', FALLBACK.accent),
      accent2: read('--color-accent-2', FALLBACK.accent2),
    };
  }, []);
}

export function axisTick(c: ChartColors) {
  return { fontSize: 12, fill: c.muted };
}

export function tooltipStyles(c: ChartColors) {
  return {
    contentStyle: {
      backgroundColor: c.surface,
      border: `1px solid ${c.line}`,
      borderRadius: '12px',
      fontSize: '12px',
    },
    labelStyle: { color: c.text },
  };
}

/** Gives a chart an accessible name (the SVG itself is not navigable). */
export function ChartFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="img" aria-label={label}>
      {children}
    </div>
  );
}
