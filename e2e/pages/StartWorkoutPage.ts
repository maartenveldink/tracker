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
    // CT-06: a recently-used schema shows a "Toch starten" confirmation first.
    const confirm = this.page.getByRole('button', { name: 'Toch starten' });
    try {
      await confirm.waitFor({ state: 'visible', timeout: 1000 });
      await confirm.click();
    } catch {
      // No recent-use warning — the workout is already starting.
    }
    await this.page.waitForURL(/\/workout\/\d+$/);
  }

  /** Starts an ad-hoc ("Vrije training") workout with no schema. */
  async startFree(): Promise<void> {
    await this.page.getByText('Vrije training', { exact: true }).click();
    await this.page.waitForURL(/\/workout\/\d+$/);
  }

  /** Starts a specific day of a multi-day schema. */
  async startDay(schemaName: string, dayName: string): Promise<void> {
    await this.page.getByText(schemaName, { exact: true }).click(); // expands day selection
    await this.page.getByText(dayName, { exact: true }).click();    // pick the day
    await this.page.getByRole('button', { name: new RegExp(`^Start ${dayName}`) }).click();
    await this.page.waitForURL(/\/workout\/\d+$/);
  }
}
