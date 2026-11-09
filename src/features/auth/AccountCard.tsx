import { useState } from 'react';
import { LogOut, LogIn, RefreshCw, Check, CloudOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from './AuthContext';
import { useSyncStatus, syncNow, type SyncState } from '@/lib/sync';

const STATUS_LABEL: Record<SyncState, string> = {
  idle: 'Nog niet gesynct',
  syncing: 'Bezig met synchroniseren…',
  synced: 'Gesynchroniseerd',
  offline: 'Offline — wijzigingen worden later gesynct',
  error: 'Synchronisatie mislukt',
};

function StatusIcon({ state }: { state: SyncState }) {
  if (state === 'syncing') return <RefreshCw className="h-4 w-4 animate-spin" />;
  if (state === 'synced') return <Check className="h-4 w-4 text-primary" />;
  if (state === 'offline') return <CloudOff className="h-4 w-4 text-muted" />;
  if (state === 'error') return <AlertTriangle className="h-4 w-4 text-destructive" />;
  return <RefreshCw className="h-4 w-4 text-muted" />;
}

export function AccountCard() {
  const { mode, hasBackend, username, logout, goToLogin } = useAuth();
  const { state } = useSyncStatus();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <section className="space-y-1.5">
      <h2 className="px-0.5 text-caption font-semibold uppercase tracking-[0.08em] text-muted">Account</h2>
      <Card className="space-y-3 p-4">
        {mode === 'authed' ? (
          <>
            <div className="text-body">
              Ingelogd als <span className="font-semibold">{username ?? 'onbekend'}</span>
            </div>
            <div className="flex items-center gap-2 text-small text-muted">
              <StatusIcon state={state} />
              {STATUS_LABEL[state]}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void syncNow()} disabled={state === 'syncing'}>
                <RefreshCw className="h-4 w-4" />
                Nu synchroniseren
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
                <LogOut className="h-4 w-4" />
                Uitloggen
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-small text-muted">
              <CloudOff className="h-4 w-4" />
              Lokaal — je data staat alleen op dit apparaat
            </div>
            {hasBackend && (
              <Button variant="outline" size="sm" onClick={goToLogin}>
                <LogIn className="h-4 w-4" />
                Inloggen of account aanmaken
              </Button>
            )}
          </>
        )}
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uitloggen?</DialogTitle>
            <DialogDescription>
              Zorg dat je wijzigingen zijn gesynchroniseerd. Bij uitloggen wordt de
              lokale kopie van je gegevens op dit apparaat gewist; na opnieuw
              inloggen worden ze weer opgehaald.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Annuleren</Button>
            <Button variant="destructive" onClick={() => void logout()}>Uitloggen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
