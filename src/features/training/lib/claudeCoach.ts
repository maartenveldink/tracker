import schemaFormatRaw from '../../../../docs/schema-format.json?raw';
import type { CoachSummary } from './coachSummary';
import { buildCoachPrompt, PROPOSE_SCHEMA_TOOL } from './coachPrompt';
import { validateSchemaJson, type SchemaJson } from './schemaJson';
import type { SharedSchema } from './schemaShare';
import { isValidApiKeyFormat, type CoachModel } from './coachConfig';

/**
 * Route B of the Claude coach: calls the Anthropic Messages API straight from
 * the browser (no backend, no SDK) and returns an analysis + a proposed schema.
 *
 * The answer comes back as the input of a single tool, `propose_schema`, whose
 * input schema is `docs/schema-format.json` plus `analysis`, and is then
 * validated with the same validator as the JSON import (`schemaJson.ts`).
 *
 * Note: `tool_choice: {type: 'tool'}` (forced tool use) is rejected with a 400
 * by Claude Sonnet 5.5 and Opus 5.5, so the request uses `auto` + an explicit
 * instruction and treats a missing tool call as an invalid answer.
 */

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';
/** Non-streaming request; keeps well under the HTTP time-outs. */
const MAX_TOKENS = 16000;
export const COACH_TIMEOUT_MS = 240_000;

type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// --- Tool definition ---

/** Replaces local `{"$ref": "#/$defs/x"}` references by the definition itself. */
function inlineRefs(node: unknown, defs: Json): unknown {
  if (Array.isArray(node)) return node.map(n => inlineRefs(n, defs));
  if (!isObj(node)) return node;
  const ref = node.$ref;
  if (typeof ref === 'string' && ref.startsWith('#/$defs/')) {
    return inlineRefs(defs[ref.slice('#/$defs/'.length)], defs);
  }
  const out: Json = {};
  for (const [k, v] of Object.entries(node)) out[k] = inlineRefs(v, defs);
  return out;
}

/**
 * Input schema of `propose_schema`: the readable schema format (refs inlined,
 * meta keys dropped) with an extra required `analysis` string. The root stays a
 * plain object (no oneOf/anyOf), as the API requires.
 */
export function buildProposeSchemaInputSchema(): Json {
  const format = JSON.parse(schemaFormatRaw) as Json;
  const defs = isObj(format.$defs) ? format.$defs : {};
  const properties = isObj(format.properties) ? format.properties : {};
  const required = Array.isArray(format.required) ? (format.required as string[]) : [];
  return {
    type: 'object',
    description:
      'Analysis plus the proposed training schema. Use EITHER `exercises` (one training day) OR `days` (several days), never both. repsMax must be >= reps; exercises sharing a supersetGroup must be adjacent.',
    additionalProperties: false,
    required: ['analysis', ...required.filter(r => r !== 'analysis')],
    properties: {
      analysis: {
        type: 'string',
        minLength: 1,
        description:
          'Analysis of the training period in Dutch (plain text, paragraphs separated by a blank line): progress, weak points, what changes and why, and which exercises are dropped.',
      },
      ...(inlineRefs(properties, defs) as Json),
    },
  };
}

export const PROPOSE_SCHEMA_TOOL_DEFINITION = {
  name: PROPOSE_SCHEMA_TOOL,
  description:
    'Return the analysis of the training period and the proposed new training schema. The proposal is saved as a NEW schema next to the current one. Prefer exercise names from existingExercises; add a short Dutch "reason" to every added or changed exercise.',
  input_schema: buildProposeSchemaInputSchema(),
};

const SYSTEM_PROMPT =
  `Je bent een ervaren, nuchtere krachttrainingscoach. Je schrijft in het Nederlands. Je antwoordt uitsluitend door precies één keer de tool "${PROPOSE_SCHEMA_TOOL}" aan te roepen; de gebruiker ziet alleen wat je in die tool zet.`;

export interface CoachRequestOptions {
  summary: CoachSummary;
  goal?: string;
  model: CoachModel;
}

/** The JSON body for POST /v1/messages (exported for tests and inspection). */
export function buildCoachRequestBody({ summary, goal, model }: CoachRequestOptions): Json {
  return {
    model,
    max_tokens: MAX_TOKENS,
    output_config: { effort: 'medium' },
    system: SYSTEM_PROMPT,
    tools: [PROPOSE_SCHEMA_TOOL_DEFINITION],
    tool_choice: { type: 'auto', disable_parallel_tool_use: true },
    messages: [{ role: 'user', content: buildCoachPrompt({ summary, goal, mode: 'api' }) }],
  };
}

// --- Errors ---

export type CoachErrorKind =
  | 'no-key'
  | 'unauthorized'
  | 'forbidden'
  | 'rate-limit'
  | 'overloaded'
  | 'server'
  | 'bad-request'
  | 'offline'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'refusal'
  | 'invalid-response';

export class CoachError extends Error {
  readonly kind: CoachErrorKind;
  /** Per-path validation errors (invalid answer) or other detail lines. */
  readonly details: string[];
  constructor(kind: CoachErrorKind, message: string, details: string[] = []) {
    super(message);
    this.name = 'CoachError';
    this.kind = kind;
    this.details = details;
  }
}

/** Removes the key from any text we might show (defence in depth). */
function redact(text: string, apiKey: string): string {
  return apiKey ? text.split(apiKey).join('[API-key]') : text;
}

async function errorFromResponse(res: Response, apiKey: string): Promise<CoachError> {
  let apiType = '';
  let apiMessage = '';
  try {
    const body: unknown = await res.json();
    if (isObj(body) && isObj(body.error)) {
      if (typeof body.error.type === 'string') apiType = body.error.type;
      if (typeof body.error.message === 'string') apiMessage = redact(body.error.message, apiKey).slice(0, 300);
    }
  } catch {
    // not JSON
  }
  const s = res.status;
  if (s === 401 || apiType === 'authentication_error') {
    return new CoachError('unauthorized', 'De API-key is ongeldig of ingetrokken. Controleer of vervang de key in Instellingen → Claude-coach.');
  }
  if (s === 403 || apiType === 'permission_error') {
    return new CoachError('forbidden', 'Deze API-key heeft geen toegang tot dit model. Controleer de key en het model in Instellingen → Claude-coach.');
  }
  if (s === 429 || apiType === 'rate_limit_error') {
    const retry = Number(res.headers.get('retry-after'));
    const wait = Number.isFinite(retry) && retry > 0 ? ` Probeer het over ${Math.ceil(retry)} seconden opnieuw.` : ' Probeer het over een paar minuten opnieuw.';
    return new CoachError('rate-limit', `Te veel verzoeken, of de limiet van je API-key is bereikt.${wait}`);
  }
  if (s === 529 || apiType === 'overloaded_error') {
    return new CoachError('overloaded', 'Claude is op dit moment overbelast. Probeer het over een paar minuten opnieuw.');
  }
  if (s >= 500) {
    return new CoachError('server', `Er ging iets mis bij Anthropic (fout ${s}). Probeer het later opnieuw.`);
  }
  if (s === 404) {
    return new CoachError('bad-request', 'Het gekozen model is niet beschikbaar voor deze API-key. Kies een ander model in Instellingen → Claude-coach.', apiMessage ? [apiMessage] : []);
  }
  if (s === 413) {
    return new CoachError('bad-request', 'De samenvatting is te groot voor één verzoek. Kies een kortere periode.');
  }
  return new CoachError('bad-request', `Het verzoek werd geweigerd (fout ${s}).`, apiMessage ? [apiMessage] : []);
}

// --- Response ---

export interface CoachProposal {
  /** Analysis text (Dutch, plain text). */
  analysis: string;
  /** Validated proposal in the readable format (reasons included). */
  schema: SchemaJson;
  /** Compact form for `importSharedSchema`. */
  shared: SharedSchema;
  warnings: string[];
  model: string;
}

/** Turns a parsed Messages API response into a validated proposal (throws `CoachError`). */
export function parseCoachResponse(body: unknown): CoachProposal {
  const invalid = (msg: string, details: string[] = []) =>
    new CoachError('invalid-response', msg, details);

  if (!isObj(body) || !Array.isArray(body.content)) {
    throw invalid('Claude gaf een onverwacht antwoord (geen inhoud).');
  }
  if (body.stop_reason === 'refusal') {
    throw new CoachError('refusal', 'Claude heeft dit verzoek geweigerd. Pas je doel of vraag aan en probeer het opnieuw.');
  }
  const call = body.content.find(
    (b): b is Json => isObj(b) && b.type === 'tool_use' && b.name === PROPOSE_SCHEMA_TOOL,
  );
  if (body.stop_reason === 'max_tokens') {
    throw invalid('Het antwoord van Claude werd afgekapt (te lang). Probeer het opnieuw, eventueel met een kortere periode.');
  }
  if (!call) {
    throw invalid('Claude gaf geen schemavoorstel terug. Probeer het opnieuw.');
  }
  if (!isObj(call.input)) {
    throw invalid('Het voorstel van Claude is geen geldig object.');
  }
  const { analysis, ...rest } = call.input;
  const errors: string[] = [];
  if (typeof analysis !== 'string' || analysis.trim() === '') {
    errors.push('analysis: ontbreekt of is leeg');
  }
  const result = validateSchemaJson(rest);
  if (!result.ok) errors.push(...result.errors);
  if (errors.length > 0 || !result.ok) {
    throw invalid('Het voorstel van Claude voldoet niet aan het schemaformaat.', errors);
  }
  return {
    analysis: (analysis as string).trim(),
    schema: result.schema,
    shared: result.shared,
    warnings: result.warnings,
    model: typeof body.model === 'string' ? body.model : '',
  };
}

// --- Request ---

export interface RequestCoachProposalOptions extends CoachRequestOptions {
  apiKey: string | null;
  /** Abort from the caller (cancel button, leaving the page). */
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Asks Claude for an analysis + schema proposal. Throws `CoachError` on any failure. */
export async function requestCoachProposal(opts: RequestCoachProposalOptions): Promise<CoachProposal> {
  const { apiKey, signal, timeoutMs = COACH_TIMEOUT_MS } = opts;
  if (!apiKey) {
    throw new CoachError('no-key', 'Er is nog geen API-key ingesteld. Voeg er een toe in Instellingen → Claude-coach.');
  }
  if (!isValidApiKeyFormat(apiKey)) {
    throw new CoachError('unauthorized', 'De opgeslagen API-key bevat ongeldige tekens (spatie of bijzonder teken). Plak de key opnieuw in Instellingen → Claude-coach.');
  }
  if (signal?.aborted) throw new CoachError('aborted', 'De analyse is geannuleerd.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new CoachError('offline', 'Je bent offline. De analyse heeft internet nodig; probeer het opnieuw zodra je verbinding hebt.');
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  const abortError = () =>
    timedOut
      ? new CoachError('timeout', `Claude reageerde niet binnen ${Math.round(timeoutMs / 1000)} seconden. Probeer het opnieuw.`)
      : new CoachError('aborted', 'De analyse is geannuleerd.');

  try {
    let res: Response;
    try {
      res = await fetch(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(buildCoachRequestBody(opts)),
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
    } catch {
      if (controller.signal.aborted) throw abortError();
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new CoachError('offline', 'Je bent offline. De analyse heeft internet nodig; probeer het opnieuw zodra je verbinding hebt.');
      }
      throw new CoachError('network', 'Kon Anthropic niet bereiken. Controleer je internetverbinding en probeer het opnieuw.');
    }

    if (!res.ok) throw await errorFromResponse(res, apiKey);

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      if (controller.signal.aborted) throw abortError();
      throw new CoachError('invalid-response', 'Claude gaf een antwoord dat geen geldige JSON is. Probeer het opnieuw.');
    }
    return parseCoachResponse(body);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
