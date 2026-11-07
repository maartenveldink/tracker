import type { Locator, Page } from '@playwright/test';

/** The Claude-coach screen (`/schemas/:id/coach`) and its settings card. */
export class CoachPage {
  constructor(private readonly page: Page) {}

  /** From a schema's detail page: "Laat Claude analyseren". */
  async openFromSchemaDetail(): Promise<void> {
    await this.page.getByRole('link', { name: 'Laat Claude analyseren' }).click();
    await this.page.waitForURL(/\/schemas\/[^/]+\/coach$/);
    // The page is lazy-loaded; the router keeps showing the schema page (which
    // has its own "Periode" group) until it is in, so wait for the real thing.
    await this.page.getByRole('heading', { name: 'Claude-coach', exact: true }).waitFor();
  }

  get noKey(): Locator {
    return this.page.getByTestId('coach-no-key');
  }

  period(weeks: 4 | 8): Locator {
    return this.page.getByRole('group', { name: 'Periode' }).getByRole('button', { name: `${weeks} weken` });
  }

  get goal(): Locator {
    return this.page.getByLabel('Doel of vraag (optioneel)');
  }

  get analyseButton(): Locator {
    return this.page.getByRole('button', { name: /^(Analyseer|Opnieuw analyseren)$/ });
  }

  get cancelButton(): Locator {
    return this.page.getByRole('button', { name: 'Annuleren' });
  }

  get loading(): Locator {
    return this.page.getByTestId('coach-loading');
  }

  get error(): Locator {
    return this.page.getByTestId('coach-error');
  }

  get errorDetails(): Locator {
    return this.page.getByTestId('coach-error-details');
  }

  get analysis(): Locator {
    return this.page.getByTestId('coach-analysis');
  }

  get diff(): Locator {
    return this.page.getByTestId('coach-diff');
  }

  /** A diff row by exercise name (first match). */
  row(exercise: string): Locator {
    return this.diff.locator(`[data-testid="coach-diff-row"][data-exercise="${exercise}"]`).first();
  }

  get newExercisesNote(): Locator {
    return this.page.getByTestId('coach-new-exercises');
  }

  get saveButton(): Locator {
    return this.page.getByRole('button', { name: /Als nieuw schema opslaan|Bezig met opslaan/ });
  }

  // --- Settings card ---

  get settingsCard(): Locator {
    return this.page.getByTestId('coach-settings');
  }

  get keyInput(): Locator {
    return this.settingsCard.getByLabel('API-key', { exact: true });
  }

  get keyStatus(): Locator {
    return this.settingsCard.getByTestId('coach-key-status');
  }

  /** On the settings page: types the key and saves it. */
  async saveKey(key: string): Promise<void> {
    await this.keyInput.fill(key);
    await this.pressSettingsButton('Key opslaan');
  }

  async pressSettingsButton(name: string): Promise<void> {
    await this.settingsCard.getByRole('button', { name, exact: true }).click();
  }

  async chooseModel(id: string): Promise<void> {
    await this.page.locator('#coach-model').selectOption(id);
  }
}
