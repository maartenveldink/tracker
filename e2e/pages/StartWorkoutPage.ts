import type { Page } from '@playwright/test';

/** Page object for the "Start training" screen (`/start`). */
export class StartWorkoutPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/start');
  }

  /** Starts a single-day schema by name and waits for the live workout to open. */
  async start(schemaName: string): Promise<void> {
    await this.page.getByText(schemaName, { exact: true }).click();
    await this.page.waitForURL(/\/workout\/\d+$/);
    // Wait until the exercise cards have rendered so callers can assert on the
    // set grid immediately.
    await this.page.getByTestId('exercise-card').first().waitFor({ state: 'visible' });
  }

  /** Starts an ad-hoc ("Vrije training") workout with no schema. */
  async startFree(): Promise<void> {
    await this.page.getByText('Vrije training', { exact: true }).click();
    await this.page.waitForURL(/\/workout\/\d+$/);
  }

  /** Opens the suggested-workout screen (`/start/suggestion`). */
  async openSuggestion(): Promise<void> {
    await this.page.getByText('Voorgestelde training', { exact: true }).click();
    await this.page.waitForURL(/\/start\/suggestion$/);
  }

  /** Starts a specific day of a multi-day schema. */
  async startDay(schemaName: string, dayName: string): Promise<void> {
    await this.page.getByText(schemaName, { exact: true }).click(); // expands day selection
    await this.page.getByText(dayName, { exact: true }).click();    // pick the day
    await this.page.getByRole('button', { name: new RegExp(`^Start ${dayName}`) }).click();
    await this.page.waitForURL(/\/workout\/\d+$/);
  }
}
