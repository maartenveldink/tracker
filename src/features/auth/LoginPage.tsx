import { useState } from 'react';
import { ClientResponseError } from 'pocketbase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from './AuthContext';

type Mode = 'login' | 'register';

/** Google sign-in is only offered when explicitly enabled at build time. */
const GOOGLE_ENABLED = import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === 'true';

export function LoginPage() {
  const { loginWithPassword, register, loginWithGoogle, continueWithoutAccount } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (username.trim().length < 2) return setError('Vul een gebruikersnaam in.');
    if (password.length < 8) return setError('Wachtwoord moet minstens 8 tekens zijn.');
    setBusy(true);
    try {
      if (mode === 'login') await loginWithPassword(username.trim(), password);
      else await register(username.trim(), password);
    } catch (err) {
      setError(messageFor(err, mode));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(messageFor(err, mode));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === 'login' ? 'Inloggen' : 'Account aanmaken'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="username">Gebruikersnaam</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Wachtwoord</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === 'login' ? 'Inloggen' : 'Account aanmaken'}
            </Button>
          </form>

          {GOOGLE_ENABLED && (
            <Button
              type="button"
              variant="outline"
              className="w-full mt-2"
              disabled={busy}
              onClick={handleGoogle}
            >
              Inloggen met Google
            </Button>
          )}

          <button
            type="button"
            className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
          >
            {mode === 'login' ? 'Nog geen account? Maak er een aan' : 'Al een account? Inloggen'}
          </button>

          <div className="mt-4 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={busy}
              onClick={continueWithoutAccount}
            >
              Verder zonder account
            </Button>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Je data blijft dan alleen op dit apparaat. Je kunt later alsnog een
              account maken om te synchroniseren.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function messageFor(err: unknown, mode: Mode): string {
  if (err instanceof ClientResponseError) {
    if (err.status === 400) {
      return mode === 'login'
        ? 'Onjuiste gebruikersnaam of wachtwoord.'
        : 'Deze gebruikersnaam is al in gebruik of ongeldig.';
    }
    if (err.status === 0) return 'Geen verbinding met de server.';
  }
  return 'Er ging iets mis. Probeer het opnieuw.';
}
