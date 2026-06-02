/**
 * OAuth 2.0 callback page — handles the redirect from Google after the user authorises.
 * Route: /oauth/google/callback
 *
 * Flow:
 *  1. Reads `code` and `state` from the URL search params.
 *  2. Exchanges the code for tokens via PKCE (E7-07).
 *  3. Stores tokens + account name in IndexedDB.
 *  4. Triggers the initial 90-day sync (E7-11).
 *  5. Navigates to /settings.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../../db/index';
import { exchangeCode, fetchAccountName } from '../lib/oauth';
import { syncGoogleHealth } from '../lib/syncService';

type Status = 'loading' | 'syncing' | 'error';

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error || !code || !state) {
      setStatus('error');
      setErrorMessage(
        error === 'access_denied'
          ? 'Je hebt de Google Health-koppeling geweigerd.'
          : 'Autorisatie mislukt. Probeer opnieuw.',
      );
      return;
    }

    void (async () => {
      try {
        const tokens = await exchangeCode(code, state);

        if (!tokens.refresh_token) {
          throw new Error(
            'Google stuurde geen refresh token. Probeer opnieuw (verwijder eventueel de app-toegang in je Google-account).',
          );
        }

        const accountName = await fetchAccountName(tokens.access_token);
        const now = new Date();

        await db.googleHealthConnection.put({
          id: 1,
          accountName,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
          connectedAt: now,
          lastSyncAt: null,
          lastSyncError: null,
          consecutiveFailDays: 0,
        });

        setStatus('syncing');
        await syncGoogleHealth();
        navigate('/settings', { replace: true });
      } catch (err: unknown) {
        setStatus('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Onbekende fout bij koppelen.',
        );
      }
    })();
  }, [navigate]);

  if (status === 'loading' || status === 'syncing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">
          {status === 'syncing'
            ? 'Google Health gekoppeld — data ophalen (90 dagen)…'
            : 'Koppeling verwerken…'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-destructive">{errorMessage}</p>
      <button
        className="text-sm text-primary underline"
        onClick={() => navigate('/settings', { replace: true })}
      >
        Terug naar instellingen
      </button>
    </div>
  );
}
