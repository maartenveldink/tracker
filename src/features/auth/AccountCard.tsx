import { useState } from 'react';
import { UserCircle, LogOut, LogIn, RefreshCw, Check, CloudOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  if (state === 'offline') return <CloudOff className="h-4 w-4 text-muted-foreground" />;
  if (state === 'error') return <AlertTriangle className="h-4 w-4 text-destructive" />;
  return <RefreshCw className="h-4 w-4 text-muted-foreground" />;
}

export function AccountCard() {
  const { mode, hasBackend, username, logout, goToLogin } = useAuth();
  const { state } = useSyncStatus();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserCircle className="h-4 w-4" />
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {mode === 'authed' ? (
          <>
            <div className="text-sm">
              Ingelogd als <span className="font-medium">{username ?? 'onbekend'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <StatusIcon state={state} />
              {STATUS_LABEL[state]}
            </div>
            <div className="flex gap-2">
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
      </CardContent>

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
    </Card>
  );
}
