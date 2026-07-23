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
  }
}
