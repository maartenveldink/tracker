import type { Page } from '@playwright/test';

type Tab = 'Per oefening' | 'Vergelijken' | 'Volume' | 'Records' | 'Consistentie' | 'Gewicht';

/** Page object for the Progress screen (`/progress`). */
export class ProgressPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/progress');
  }

  async openTab(tab: Tab): Promise<void> {
    await this.page.getByRole('button', { name: tab, exact: true }).click();
  }
}

/** Page object for the workout history list (`/start/history`). */
export class WorkoutHistoryPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/start/history');
  }

  /** Rows are labelled with a delete button; count them by that button. */
  get entries() {
    return this.page.getByRole('button', { name: 'Verwijder training' });
  }

  async deleteFirst(): Promise<void> {
    await this.entries.first().click();
    await this.page.getByRole('button', { name: 'Verwijderen' }).click();
  }
}
