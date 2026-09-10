import PocketBase from 'pocketbase';

/**
 * Single PocketBase client for the whole app. The base URL is a build-time env
 * var (`VITE_PB_URL`); when unset (e.g. the PWA is served from the same origin
 * as PocketBase) it falls back to the current origin.
 *
 * The SDK persists the auth token + user record in localStorage, so a logged-in
 * user stays "known" on this device across reloads — and even when the token has
 * expired. The app is gated on *having a stored identity*, not on the token
 * being currently valid, so an expired token never locks you out of your local
 * data (see `docs/design.multi-user-sync.md` → offline-gedrag & auth).
 */
const configuredUrl = import.meta.env.VITE_PB_URL as string | undefined;
const baseUrl = configuredUrl || window.location.origin;

export const pb = new PocketBase(baseUrl);

/**
 * True when a backend is configured (`VITE_PB_URL` set). When false the app runs
 * purely local — no login gate, no sync — which is the single-user / pilot mode.
 */
export function backendConfigured(): boolean {
  return Boolean(configuredUrl);
}

// Don't auto-cancel overlapping requests — the sync engine fires several in
// parallel per tick.
pb.autoCancellation(false);

/** The collection used for authentication. */
export const USERS_COLLECTION = 'users';

/** True when there is a stored user identity on this device (token may be stale). */
export function hasStoredIdentity(): boolean {
  return pb.authStore.record != null;
}

/** The current user's id, or undefined when signed out. */
export function currentUserId(): string | undefined {
  return pb.authStore.record?.id;
}
