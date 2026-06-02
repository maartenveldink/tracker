/**
 * PKCE (Proof Key for Code Exchange) utilities using the Web Crypto API.
 * Used for the OAuth 2.0 Authorization Code flow without a client secret (E7-05).
 */

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/** Generate a cryptographically random code verifier (43–128 chars, base64url). */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

/** Derive the code challenge from the verifier using SHA-256. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(hash);
}
