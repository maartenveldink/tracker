import { Component, type ErrorInfo, type ReactNode } from 'react';
import { buildErrorReport, canSeeDiagnostics, copyToClipboard } from '@/lib/diagnostics';

/**
 * Catches render errors (including failed lazy chunks) so the app never ends on a blank
 * screen. Error boundaries must be class components; this is the only one in the app.
 * Technical details (and the copy button) are only shown to the diagnostics user.
 */

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
  copied: 'idle' | 'ok' | 'failed';
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, copied: 'idle' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  private handleCopy = async () => {
    const report = buildErrorReport(this.state.error, this.state.componentStack);
    this.setState({ copied: (await copyToClipboard(report)) ? 'ok' : 'failed' });
  };

  render(): ReactNode {
    const { error, componentStack, copied } = this.state;
    if (!error) return this.props.children;

    const showDetails = canSeeDiagnostics();
    return (
      <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
        <div className="mx-auto max-w-xl space-y-4">
          <h1 className="text-xl font-semibold text-red-400">Er ging iets mis</h1>
          <p className="text-sm text-slate-300">
            De app kon dit scherm niet tonen. Je data is niet verloren; probeer opnieuw te laden.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900"
              onClick={() => window.location.reload()}
            >
              Opnieuw laden
            </button>
            {showDetails && (
              <button
                type="button"
                className="rounded-md border border-slate-600 px-3 py-2 text-sm font-medium"
                onClick={() => void this.handleCopy()}
              >
                {copied === 'ok' ? 'Gekopieerd ✓' : copied === 'failed' ? 'Kopiëren mislukt' : 'Kopieer foutrapport'}
              </button>
            )}
          </div>

          {showDetails && (
            <pre
              aria-label="Foutrapport"
              className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-700 bg-slate-900 p-3 text-xs text-slate-300"
            >
              {buildErrorReport(error, componentStack)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
