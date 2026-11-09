import type { Page } from '@playwright/test';

/** Page object for the "Start training" screen (`/start`). */
export class StartWorkoutPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/start');
  }

  /** Starts a single-day schema by name and waits for the live workout to open. */
  async start(schemaName: string): Promise<void> {
    // Scoped to the schema list: the suggested card may show the same name.
    await this.page.getByTestId('schema-list').getByText(schemaName, { exact: true }).click();
    await this.page.waitForURL(/\/workout\/[^\/]+$/);
    // Wait until the exercise cards have rendered so callers can assert on the
    // set grid immediately.
    await this.page.getByTestId('exercise-card').first().waitFor({ state: 'visible' });
  }

  /** Starts an ad-hoc ("Vrije training") workout with no schema. */
  async startFree(): Promise<void> {
    await this.page.getByText('Vrije training', { exact: true }).click();
    await this.page.waitForURL(/\/workout\/[^\/]+$/);
  }

  /** Opens the suggested-workout screen (`/start/suggestion`). */
  async openSuggestion(): Promise<void> {
    await this.page.getByRole('button', { name: 'Voorgestelde training' }).click();
    await this.page.waitForURL(/\/start\/suggestion$/);
  }

  /** Starts a specific day of a multi-day schema. */
  async startDay(schemaName: string, dayName: string): Promise<void> {
    // Days of a multi-day schema are listed directly; a tap starts the day.
    const list = this.page.getByTestId('schema-list').locator(`section[aria-label="${schemaName}"]`);
    await list.getByRole('button', { name: `Start ${dayName}` }).click();
    await this.page.waitForURL(/\/workout\/[^\/]+$/);
  }
}
