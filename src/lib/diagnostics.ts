import { pb } from '@/lib/pb';
import { getSyncStatus } from '@/lib/sync/status';

/**
 * Crash diagnostics: keeps the last few uncaught errors / unhandled rejections and
 * builds a copy-pasteable report for the error screen (`ErrorBoundary`).
 *
 * The report deliberately contains no localStorage or IndexedDB content, so it never
 * includes an AI API key, the auth token or training data.
 */

/** Only this account sees the technical details on the error screen. */
export const DIAGNOSTICS_USER = 'maarten';

interface RecentError {
  at: string;
  kind: 'error' | 'unhandledrejection';
  message: string;
  stack?: string;
}

const MAX_RECENT = 8;
const recent: RecentError[] = [];
let installed = false;

function describe(value: unknown): { message: string; stack?: string } {
  if (value instanceof Error) return { message: `${value.name}: ${value.message}`, stack: value.stack };
  try {
    return { message: typeof value === 'string' ? value : JSON.stringify(value) };
  } catch {
    return { message: String(value) };
  }
}

function remember(kind: RecentError['kind'], value: unknown) {
  recent.push({ at: new Date().toISOString(), kind, ...describe(value) });
  if (recent.length > MAX_RECENT) recent.shift();
}

/** Start collecting uncaught errors. Safe to call more than once. */
export function installDiagnostics(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('error', e => remember('error', e.error ?? e.message));
  window.addEventListener('unhandledrejection', e => remember('unhandledrejection', e.reason));
}

/** True when the signed-in user may see the technical error details. */
export function canSeeDiagnostics(): boolean {
  return pb.authStore.record?.username === DIAGNOSTICS_USER;
}

export function buildErrorReport(error: unknown, componentStack?: string | null): string {
  const main = describe(error);
  const sync = getSyncStatus();
  const lines: string[] = [
    '# Tracker foutrapport',
    `tijd: ${new Date().toISOString()}`,
    `pagina: ${location.pathname}${location.search}`,
    `gebruiker: ${String(pb.authStore.record?.username ?? 'niet ingelogd')}`,
    `online: ${navigator.onLine}`,
    `sync: ${sync.state}${sync.lastSyncedAt ? ` (laatst ${new Date(sync.lastSyncedAt).toISOString()})` : ''}`,
    `service worker actief: ${'serviceWorker' in navigator && navigator.serviceWorker.controller ? 'ja' : 'nee'}`,
    `browser: ${navigator.userAgent}`,
    '',
    '## Fout',
    // `stack` normally starts with the message; only repeat it when it doesn't.
    ...(main.stack?.startsWith(main.message) ? [main.stack] : [main.message, main.stack ?? '(geen stacktrace)']),
  ];
  if (componentStack) lines.push('', '## Componenten', componentStack.trim());
  if (recent.length > 0) {
    lines.push('', '## Eerdere fouten in deze sessie');
    for (const r of recent) lines.push(`- ${r.at} [${r.kind}] ${r.message}`, ...(r.stack ? [r.stack] : []));
  }
  return lines.join('\n');
}

/** Copies text to the clipboard; falls back to a hidden textarea when the API is blocked. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}
