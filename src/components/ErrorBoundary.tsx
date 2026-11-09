import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
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
      <div className="min-h-screen bg-bg p-4 text-text">
        <div className="mx-auto max-w-xl space-y-4 pt-8">
          <div className="space-y-1">
            <div className="text-caption font-semibold uppercase tracking-[0.08em] text-muted">Tracker</div>
            <h1 className="font-display text-screen font-bold tracking-tight">Er ging iets mis</h1>
          </div>
          <p className="text-body text-muted">
            De app kon dit scherm niet tonen. Je data is niet verloren; probeer opnieuw te laden.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="lg" onClick={() => window.location.reload()}>
              Opnieuw laden
            </Button>
            {showDetails && (
              <Button type="button" size="lg" variant="outline" onClick={() => void this.handleCopy()}>
                {copied === 'ok' ? 'Gekopieerd ✓' : copied === 'failed' ? 'Kopiëren mislukt' : 'Kopieer foutrapport'}
              </Button>
            )}
          </div>

          {showDetails && (
            <pre
              aria-label="Foutrapport"
              className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-card border border-line bg-surface p-3 text-caption text-muted"
            >
              {buildErrorReport(error, componentStack)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
