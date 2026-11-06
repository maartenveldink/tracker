import { test, expect } from '../fixtures/app';
import {
  TEST_API_KEY,
  apiError,
  fulfillJson,
  mockAnthropic,
  toolResponse,
} from '../fixtures/anthropicMock';

/**
 * Claude coach, route B (API). The Anthropic API is ALWAYS mocked with
 * `page.route`; no test talks to the real service or uses a real key.
 */

const CURRENT = {
  name: 'Coach API Test',
  exercises: [
    { exercise: 'Barbell Bench Press', sets: 3, reps: 8, repsMax: 12, startWeight: 60 },
    { exercise: 'Pull-up', sets: 3, reps: 6 },
    { exercise: 'Lateral Raise', sets: 3, reps: 15 },
  ],
};

const XSS = '<img src=x onerror="window.__coachXss=1">';

const PROPOSAL = {
  analysis: `Je bankdrukken gaat goed vooruit.\n\nJe rug blijft achter. ${XSS}`,
  name: 'Coach API Test v2',
  exercises: [
    { exercise: 'Barbell Bench Press', sets: 4, reps: 8, repsMax: 12, startWeight: 62.5, reason: 'Top van de range gehaald' },
    { exercise: 'Pull-up', sets: 3, reps: 6 },
    { exercise: 'Chest Supported Row', sets: 3, reps: 10, reason: 'Meer rug, ontziet de onderrug' },
  ],
};

test.describe('Claude coach — API (route B)', () => {
  test.beforeEach(async ({ schemaImport, page }) => {
    // Safety net: any request to Anthropic that a test does not mock fails.
    await page.route('https://api.anthropic.com/**', route => route.abort('blockedbyclient'));
    await schemaImport.goto();
    await schemaImport.paste(CURRENT);
    await schemaImport.importAndConfirm();
  });

  async function setKey(settings: { goto(): Promise<void> }, coach: import('../pages/CoachPage').CoachPage) {
    await settings.goto();
    await coach.saveKey(TEST_API_KEY);
    await expect(coach.keyStatus).toBeVisible();
  }

  async function openCoach(schemas: import('../pages/SchemasPage').SchemasPage, coach: import('../pages/CoachPage').CoachPage) {
    await schemas.goto();
    await schemas.open(CURRENT.name);
    await coach.openFromSchemaDetail();
  }

  test('without a key the coach page shows an empty state linking to settings', async ({ coach, page }) => {
    const requests = await mockAnthropic(page, route => fulfillJson(route, 500, {}));
    await coach.openFromSchemaDetail();
    await expect(coach.noKey).toBeVisible();
    await expect(coach.analyseButton).toHaveCount(0);
    await coach.noKey.getByRole('link', { name: 'Naar Instellingen' }).click();
    await expect(page).toHaveURL(/\/settings#claude-coach$/);
    await expect(coach.settingsCard).toBeVisible();
    expect(requests).toHaveLength(0);
  });

  test('analyses, shows the diff with new exercise marked, and saves as a NEW schema', async ({ coach, settings, schemas, page }) => {
    const requests = await mockAnthropic(page, route => fulfillJson(route, 200, toolResponse(PROPOSAL)));

    // Settings: key (password field with show/hide) and model.
    await settings.goto();
    await expect(coach.keyInput).toHaveAttribute('type', 'password');
    await coach.keyInput.fill(TEST_API_KEY);
    await coach.pressSettingsButton('Toon API-key');
    await expect(coach.keyInput).toHaveAttribute('type', 'text');
    await coach.pressSettingsButton('Key opslaan');
    await expect(coach.keyStatus).toBeVisible();
    await expect(coach.settingsCard).not.toContainText(TEST_API_KEY);
    await coach.chooseModel('claude-opus-5-5');

    await openCoach(schemas, coach);
    await coach.period(8).click();
    await coach.goal.fill('meer rug');
    await coach.analyseButton.click();

    // Analysis: plain text, the HTML in it is NOT rendered.
    await expect(coach.analysis).toContainText('Je bankdrukken gaat goed vooruit.');
    await expect(coach.analysis).toContainText(XSS);
    await expect(coach.analysis.locator('img')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __coachXss?: number }).__coachXss)).toBeUndefined();

    // Diff against the current schema, with reasons.
    await expect(coach.row('Barbell Bench Press')).toHaveAttribute('data-kind', 'changed');
    await expect(coach.row('Barbell Bench Press')).toContainText('3×8–12 · 60 kg → 4×8–12 · 62.5 kg');
    await expect(coach.row('Barbell Bench Press')).toContainText('Top van de range gehaald');
    await expect(coach.row('Pull-up')).toHaveAttribute('data-kind', 'unchanged');
    await expect(coach.row('Chest Supported Row')).toHaveAttribute('data-kind', 'added');
    await expect(coach.row('Chest Supported Row')).toContainText('nieuwe oefening');
    await expect(coach.row('Chest Supported Row')).toContainText('Meer rug');
    await expect(coach.row('Barbell Bench Press')).not.toContainText('nieuwe oefening');
    await expect(coach.row('Lateral Raise')).toHaveAttribute('data-kind', 'removed');
    await expect(coach.newExercisesNote).toContainText('Chest Supported Row');

    // The request: right endpoint headers, tool, model, prompt — and the key only in its header.
    expect(requests).toHaveLength(1);
    const req = requests[0]!;
    expect(req.headers['x-api-key']).toBe(TEST_API_KEY);
    expect(req.headers['anthropic-version']).toBe('2023-06-01');
    expect(req.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(req.headers['content-type']).toContain('application/json');
    expect(req.body.model).toBe('claude-opus-5-5');
    expect(req.body.tools.map(t => t.name)).toEqual(['propose_schema']);
    // Forced tool_choice ({type: 'tool'}) is rejected by Sonnet/Opus 5.5: must stay `auto`.
    expect(req.body.tool_choice).toEqual({ type: 'auto', disable_parallel_tool_use: true });
    const schema = req.body.tools[0]!.input_schema;
    expect(schema.type).toBe('object');
    expect(schema).not.toHaveProperty('oneOf');
    expect(schema).not.toHaveProperty('anyOf');
    expect(schema.required).toContain('analysis');
    expect(JSON.stringify(schema)).not.toContain('$ref');
    const prompt = req.body.messages[0]!.content;
    expect(prompt).toContain('meer rug');
    expect(prompt).toContain('"weeks":8');
    expect(prompt).toContain('"name":"Coach API Test"');
    expect(JSON.stringify(req.body)).not.toContain(TEST_API_KEY);

    // Save (double click must not create two schemas).
    const originalUrl = page.url().replace(/\/coach$/, '');
    await coach.saveButton.dblclick();
    await page.waitForURL(url => /\/schemas\/[^/]+$/.test(url.pathname) && !url.href.startsWith(originalUrl));
    await expect(page.getByText('Chest Supported Row').first()).toBeVisible();

    await schemas.goto();
    await expect(schemas.card('Coach API Test v2')).toHaveCount(1);
    await expect(schemas.card('Coach API Test')).toHaveCount(1);

    // The original is untouched.
    await schemas.open('Coach API Test');
    await expect(page.getByRole('heading', { name: /^Oefeningen \(3\)/ })).toBeVisible();
    await expect(page.getByText('Lateral Raise').first()).toBeVisible();
    await expect(page.getByText('Chest Supported Row', { exact: true })).toHaveCount(0);
  });

  const errorCases: {
    name: string;
    respond: Parameters<typeof mockAnthropic>[1];
    expected: RegExp;
    details?: RegExp;
  }[] = [
    {
      name: '401 invalid key',
      respond: route => fulfillJson(route, 401, apiError('authentication_error', 'invalid x-api-key')),
      expected: /API-key is ongeldig/,
    },
    {
      name: '429 rate limit',
      respond: route => fulfillJson(route, 429, apiError('rate_limit_error', 'Too many requests'), { 'retry-after': '30' }),
      expected: /Te veel verzoeken/,
    },
    {
      name: '529 overloaded',
      respond: route => fulfillJson(route, 529, apiError('overloaded_error', 'Overloaded')),
      expected: /overbelast/,
    },
    {
      name: '403 no access',
      respond: route => fulfillJson(route, 403, apiError('permission_error', 'not allowed')),
      expected: /geen toegang/,
    },
    {
      name: '500 server error',
      respond: route => fulfillJson(route, 500, apiError('api_error', 'Internal error')),
      expected: /iets mis bij Anthropic \(fout 500\)/,
    },
    {
      name: 'refusal',
      respond: route =>
        fulfillJson(route, 200, { ...toolResponse({}), stop_reason: 'refusal', content: [] }),
      expected: /geweigerd/,
    },
    {
      name: 'invalid tool input',
      respond: route =>
        fulfillJson(route, 200, toolResponse({
          analysis: 'Analyse',
          name: 'Kapot',
          exercises: [{ exercise: 'Barbell Bench Press', reps: 'acht' }],
        })),
      expected: /voldoet niet aan het schemaformaat/,
      details: /exercises\[0\]\.sets/,
    },
    {
      name: 'answer without tool call',
      respond: route =>
        fulfillJson(route, 200, {
          ...toolResponse({}),
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Hier is mijn analyse…' }],
        }),
      expected: /geen schemavoorstel/,
    },
    {
      name: 'network failure',
      respond: route => route.abort('failed'),
      expected: /Kon Anthropic niet bereiken/,
    },
  ];

  for (const c of errorCases) {
    test(`shows a clear error: ${c.name}`, async ({ coach, settings, schemas, page }) => {
      await mockAnthropic(page, c.respond);
      await setKey(settings, coach);
      await openCoach(schemas, coach);
      await coach.analyseButton.click();
      await expect(coach.error).toContainText(c.expected);
      if (c.details) await expect(coach.errorDetails).toContainText(c.details);
      await expect(coach.error).not.toContainText(TEST_API_KEY);
      await expect(coach.diff).toHaveCount(0);
      await expect(coach.analyseButton).toBeEnabled();
    });
  }

  test('shows an offline message without calling the API', async ({ coach, settings, schemas, page, context }) => {
    const requests = await mockAnthropic(page, route => fulfillJson(route, 200, toolResponse(PROPOSAL)));
    await setKey(settings, coach);
    await openCoach(schemas, coach);
    await expect(coach.analyseButton).toBeEnabled();
    await context.setOffline(true);
    await coach.analyseButton.click();
    await expect(coach.error).toContainText(/Je bent offline/);
    expect(requests).toHaveLength(0);
    await context.setOffline(false);
  });

  test('a running analysis can be cancelled', async ({ coach, settings, schemas, page }) => {
    let release: () => void = () => {};
    const held = new Promise<void>(r => { release = r; });
    await mockAnthropic(page, async route => {
      await held;
      await fulfillJson(route, 200, toolResponse(PROPOSAL)).catch(() => {});
    });
    await setKey(settings, coach);
    await openCoach(schemas, coach);
    await coach.analyseButton.click();
    await expect(coach.loading).toBeVisible();
    await coach.cancelButton.click();
    await expect(coach.error).toContainText(/geannuleerd/);
    await expect(coach.loading).toHaveCount(0);
    release();
    await expect(coach.analyseButton).toBeEnabled();
    await expect(coach.diff).toHaveCount(0);
  });

  test('restructuring into days shows moved exercises and superset changes, not drop + add', async ({ coach, settings, schemas, page }) => {
    await mockAnthropic(page, route =>
      fulfillJson(route, 200, toolResponse({
        analysis: 'Splitsen in twee dagen.',
        name: 'Coach Split',
        days: [
          {
            name: 'Push',
            reason: 'Duwen bij elkaar',
            exercises: [
              { exercise: 'Barbell Bench Press', sets: 3, reps: 8, repsMax: 12, startWeight: 60, supersetGroup: 'A' },
              { exercise: 'Lateral Raise', sets: 3, reps: 15, supersetGroup: 'A', reason: '<b>vet</b> combineren' },
            ],
          },
          { name: 'Pull', exercises: [{ exercise: 'Pull-up', sets: 3, reps: 6 }] },
        ],
      })),
    );
    await setKey(settings, coach);
    await openCoach(schemas, coach);
    await coach.analyseButton.click();

    await expect(coach.row('Barbell Bench Press')).toHaveAttribute('data-kind', 'moved');
    await expect(coach.row('Barbell Bench Press')).toContainText('nu superset met Lateral Raise');
    await expect(coach.row('Pull-up')).toHaveAttribute('data-kind', 'moved');
    await expect(coach.row('Pull-up')).not.toContainText('superset');
    await expect(coach.diff).toContainText('3 verplaatst');
    await expect(coach.diff).toContainText('0 geschrapt');
    await expect(page.getByTestId('coach-removed-day')).toHaveCount(0);
    await expect(coach.diff.getByTestId('coach-diff-row').filter({ hasText: 'geschrapt' })).toHaveCount(0);
    // AI text in reasons is plain text, too.
    await expect(coach.row('Lateral Raise')).toContainText('<b>vet</b> combineren');
    await expect(coach.diff.locator('b')).toHaveCount(0);
  });

  test('rejects a pasted key with invalid characters', async ({ coach, settings }) => {
    await settings.goto();
    await coach.saveKey('sk-ant-abc\u200bdef');
    await expect(coach.settingsCard).toContainText('spaties of bijzondere tekens');
    await expect(coach.keyStatus).toHaveCount(0);
  });

  test('the key stays out of the export and is removed by "Alles wissen"', async ({ coach, settings, page }, testInfo) => {
    await setKey(settings, coach);
    // Stored locally under its own key, not in the (synced, exported) settings row.
    expect(await page.evaluate(() => localStorage.getItem('tracker.coach.apiKey'))).toBe(TEST_API_KEY);

    await page.reload();
    await expect(coach.keyStatus).toBeVisible();

    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exporteer data' }).click(),
    ]).then(([d]) => d);
    const file = testInfo.outputPath('export.json');
    await download.saveAs(file);
    const { readFile } = await import('node:fs/promises');
    const exported = await readFile(file, 'utf8');
    expect(exported).toContain('"settings"');
    expect(exported).not.toContain(TEST_API_KEY);
    expect(exported).not.toContain('sk-ant-');

    await settings.clearAll();
    await expect(coach.keyStatus).toHaveCount(0);
    await expect(coach.keyInput).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('tracker.coach.apiKey'))).toBeNull();
  });

  test('the key can be removed in settings', async ({ coach, settings, schemas }) => {
    await setKey(settings, coach);
    await coach.pressSettingsButton('Verwijderen');
    await expect(coach.keyStatus).toHaveCount(0);
    await openCoach(schemas, coach);
    await expect(coach.noKey).toBeVisible();
  });
});
