/**
 * Google OAuth 2.0 Authorization Code flow with PKCE (E7-05, E7-06, E7-07, E7-08).
 * No client secret — all tokens stored locally in IndexedDB.
 */

import { generateCodeVerifier, generateCodeChallenge } from './pkce';
import { db } from '../../../db/index';

const SCOPES = [
  'https://www.googleapis.com/auth/fitness.sleep.read',
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

const PKCE_VERIFIER_KEY = 'gHealth_pkce_verifier';
const OAUTH_STATE_KEY = 'gHealth_oauth_state';

export function getClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID as string ?? '';
}

export function getRedirectUri(): string {
  return `${window.location.origin}/oauth/google/callback`;
}

/**
 * Build the Google OAuth URL and store the PKCE verifier + state in sessionStorage.
 * Caller should redirect the browser to the returned URL.
 */
export async function buildAuthUrl(): Promise<string> {
  const clientId = getClientId();
  if (!clientId) throw new Error('VITE_GOOGLE_CLIENT_ID is not configured.');

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateCodeVerifier(); // random nonce for CSRF protection

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'consent', // ensure refresh_token is returned
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  token_type: string;
}

/** Exchange the authorization code for tokens (E7-07). */
export async function exchangeCode(code: string, returnedState: string): Promise<TokenResponse> {
  const storedState = sessionStorage.getItem(OAUTH_STATE_KEY);
  if (storedState !== returnedState) {
    throw new Error('OAuth state mismatch — mogelijk CSRF-aanval.');
  }

  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (!verifier) throw new Error('PKCE verifier ontbreekt. Begin opnieuw met koppelen.');

  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      redirect_uri: getRedirectUri(),
      code_verifier: verifier,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token exchange mislukt: ${err}`);
  }

  return response.json() as Promise<TokenResponse>;
}

/** Fetch the Google account display name via userinfo endpoint. */
export async function fetchAccountName(accessToken: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return 'Google-account';
  const data = await response.json() as { name?: string; email?: string };
  return data.name ?? data.email ?? 'Google-account';
}

/**
 * Refresh the access token using the stored refresh token (E7-08).
 * Updates the stored connection with the new access token.
 * Returns the new access token, or throws on failure.
 */
export async function refreshAccessToken(): Promise<string> {
  const conn = await db.googleHealthConnection.get(1);
  if (!conn) throw new Error('Geen Google Health-koppeling aanwezig.');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: conn.refreshToken,
      client_id: getClientId(),
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const err = await response.json() as { error?: string; error_description?: string };
    // refresh token revoked or expired
    if (err.error === 'invalid_grant') {
      await db.googleHealthConnection.put({
        ...conn,
        lastSyncError: 'refresh_token_invalid',
      });
    }
    throw new Error(err.error_description ?? 'Token vernieuwen mislukt.');
  }

  const data = await response.json() as TokenResponse;
  const newExpiresAt = Date.now() + data.expires_in * 1000;

  await db.googleHealthConnection.put({
    ...conn,
    accessToken: data.access_token,
    expiresAt: newExpiresAt,
  });

  return data.access_token;
}

/**
 * Return a valid access token, refreshing automatically if expired (E7-08).
 * Throws if the refresh fails (e.g. refresh token revoked).
 */
export async function getValidAccessToken(): Promise<string> {
  const conn = await db.googleHealthConnection.get(1);
  if (!conn) throw new Error('Geen Google Health-koppeling aanwezig.');

  // Add a 60-second buffer so we don't use a token that expires mid-request
  if (Date.now() < conn.expiresAt - 60_000) {
    return conn.accessToken;
  }

  return refreshAccessToken();
}
