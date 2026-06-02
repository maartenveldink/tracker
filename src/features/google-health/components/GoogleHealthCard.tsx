/**
 * Google Health settings card (E7-05, E7-09, E7-10, E7-17–E7-22).
 * Shows connection status and allows the user to connect or disconnect.
 */

import { useState } from 'react';
import { Activity, ExternalLink, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useGoogleHealth } from '../hooks/useGoogleHealth';
import { buildAuthUrl } from '../lib/oauth';
import { disconnectGoogleHealth } from '../lib/syncService';
import { syncGoogleHealth } from '../lib/syncService';

function formatDate(d: Date): string {
  return d.toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function GoogleHealthCard() {
  const { isConfigured, connection, isLoading } = useGoogleHealth();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // E7-19: persistent warning when too many consecutive fail days
  const showStaleWarning =
    connection !== null &&
    connection !== undefined &&
    connection.consecutiveFailDays >= 7;

  // E7-08: refresh_token invalid → show re-connect prompt
  const isExpired = connection?.lastSyncError === 'refresh_token_invalid';

  // E7-18: scope denied
  const isScopeDenied = connection?.lastSyncError === 'scope_denied';

  async function handleConnect() {
    setConnecting(true);
    try {
      const url = await buildAuthUrl();
      window.location.href = url;
    } catch (err) {
      console.error('OAuth build URL failed:', err);
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setConfirmDisconnect(false);
    await disconnectGoogleHealth();
  }

  async function handleManualSync() {
    setSyncing(true);
    try {
      await syncGoogleHealth();
    } catch {
      // Errors persisted in connection row; UI will reflect them via useLiveQuery
    } finally {
      setSyncing(false);
    }
  }

  // -------------------------------------------------------------------------
  // Not configured (no client ID in build)
  // -------------------------------------------------------------------------
  if (!isConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Google Health
          </CardTitle>
          <CardDescription>
            Koppel Google Health om slaap, stappen en hartfrequentie naast je trainingsdata te zien.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Deze build is niet geconfigureerd voor Google Health. Stel{' '}
            <code className="text-xs bg-muted px-1 rounded">VITE_GOOGLE_CLIENT_ID</code>{' '}
            in om de integratie te activeren.
          </p>
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Google Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Not connected
  // -------------------------------------------------------------------------
  if (!connection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Google Health
          </CardTitle>
          <CardDescription>
            Koppel Google Health om slaap, stappen en hartfrequentie naast je trainingsdata te zien.
            De koppeling is volledig optioneel; alle andere functies blijven werken.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* E7-22: privacy note */}
          <div className="text-xs text-muted-foreground space-y-1 bg-muted/40 rounded-lg p-3">
            <p className="font-medium text-foreground">Privacy</p>
            <p>
              De app haalt slaap, stappen en hartfrequentie op. Deze data blijft uitsluitend lokaal
              opgeslagen en wordt nooit naar externe servers verstuurd.
            </p>
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Google Health privacybeleid
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Button
            className="w-full"
            onClick={() => void handleConnect()}
            disabled={connecting}
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Koppel Google Health
          </Button>
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Connected
  // -------------------------------------------------------------------------
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Google Health
          </CardTitle>
          <CardDescription>
            {/* E7-09 */}
            Gekoppeld als <span className="font-medium text-foreground">{connection.accountName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* E7-19: stale data warning */}
          {showStaleWarning && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-900/30 border border-amber-800/50 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                Er zijn al meer dan 7 dagen geen gegevens gesynchroniseerd.
                Controleer je internetverbinding of koppel opnieuw.
              </p>
            </div>
          )}

          {/* E7-08: expired refresh token */}
          {isExpired && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/15 border border-destructive/30 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-xs text-destructive">
                  Google Health-koppeling verlopen — opnieuw koppelen.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => void handleConnect()}
                  disabled={connecting}
                >
                  Opnieuw koppelen
                </Button>
              </div>
            </div>
          )}

          {/* E7-18: scope denied */}
          {isScopeDenied && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/15 border border-destructive/30 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs text-destructive">
                  Toegang geweigerd — controleer de Google Health-machtigingen in je Google-accountinstellingen.
                </p>
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Google-account app-toegang
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Last sync indicator (E7-17) */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              Laatste sync:{' '}
              {connection.lastSyncAt
                ? formatDate(connection.lastSyncAt)
                : 'Nog nooit'}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => void handleManualSync()}
              disabled={syncing}
              aria-label="Synchroniseer nu"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* E7-10: disconnect */}
          <Button
            variant="outline"
            className="w-full text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => setConfirmDisconnect(true)}
          >
            Ontkoppel Google Health
          </Button>
        </CardContent>
      </Card>

      {/* Disconnect confirmation (E7-10) */}
      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Google Health ontkoppelen?</DialogTitle>
            <DialogDescription>
              Alle opgeslagen tokens en gesynchroniseerde gezondheidsdata (slaap, stappen,
              hartfrequentie) worden permanent verwijderd. Dit kan niet ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDisconnect(false)}>
              Annuleren
            </Button>
            <Button variant="destructive" onClick={() => void handleDisconnect()}>
              Ontkoppelen en data wissen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
