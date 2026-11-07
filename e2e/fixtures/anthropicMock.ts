import type { Page, Request, Route } from '@playwright/test';

/**
 * Mocks the Anthropic Messages API for the Claude-coach tests. NEVER let a test
 * reach the real API: every request to api.anthropic.com is intercepted.
 * Handles the CORS preflight the browser sends for the custom headers.
 */
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

/** A fake key; must never be sent anywhere real. */
export const TEST_API_KEY = 'sk-ant-e2e-fake-key-0000000000';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': '*',
};

export interface CapturedRequest {
  headers: Record<string, string>;
  body: {
    model: string;
    max_tokens: number;
    system: string;
    tools: { name: string; input_schema: Record<string, unknown> }[];
    tool_choice: { type: string };
    messages: { role: string; content: string }[];
  };
}

type Handler = (route: Route, request: Request) => Promise<void>;

/** Installs `handler` for POSTs (preflights are answered automatically). Returns the captured requests. */
export async function mockAnthropic(page: Page, handler: Handler): Promise<CapturedRequest[]> {
  const captured: CapturedRequest[] = [];
  // Also catch any other path on the host, so nothing ever leaks out.
  await page.route('https://api.anthropic.com/**', async (route, request) => {
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    captured.push({
      headers: await request.allHeaders(),
      body: request.postDataJSON() as CapturedRequest['body'],
    });
    await handler(route, request);
  });
  return captured;
}

export function fulfillJson(route: Route, status: number, body: unknown, headers: Record<string, string> = {}) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { ...CORS, ...headers },
    body: JSON.stringify(body),
  });
}

/** A successful Messages API response that calls `propose_schema` with `input`. */
export function toolResponse(input: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    id: 'msg_e2e',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    stop_reason: 'tool_use',
    content: [
      { type: 'thinking', thinking: '', signature: 'e2e' },
      { type: 'tool_use', id: 'toolu_e2e', name: 'propose_schema', input },
    ],
    usage: { input_tokens: 1000, output_tokens: 500 },
    ...extra,
  };
}

export function apiError(type: string, message: string) {
  return { type: 'error', error: { type, message } };
}
