import type { Locator, Page } from '@playwright/test';

/** Page object for the suggested free-workout screen (`/start/suggestion`). */
export class SuggestWorkoutPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/start/suggestion');
    await this.rows.first().waitFor({ state: 'visible' });
  }

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Voorgestelde training' });
  }

  /** One shared exercise card per suggested exercise — a stable row count. */
  get rows(): Locator {
    return this.page.getByTestId('exercise-edit-card');
  }

  /**
   * Expands the nth card (0-based; no-op when already open). Swap, the
   * superset button and the Sets/Reps steppers only exist on an expanded card.
   */
  async expand(nth: number): Promise<Locator> {
    const card = this.rows.nth(nth);
    const toggle = card.locator('button[aria-expanded]');
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    return card;
  }

  count(): Promise<number> {
    return this.rows.count();
  }

  /** The current target-duration label, e.g. "45 min". */
  get targetLabel(): Locator {
    return this.page.getByText(/^\d+ min$/);
  }

  async longer(): Promise<void> {
    await this.page.getByRole('button', { name: 'Langer' }).click();
  }

  async removeFirst(): Promise<void> {
    await this.rows.first().getByRole('button', { name: 'Verwijderen' }).click();
  }

  /** Opens the "swap for a similar exercise" sheet on the first row. */
  async openSwapFirst(): Promise<void> {
    const card = await this.expand(0);
    await card.getByRole('button', { name: 'Wissel oefening' }).click();
  }

  get swapSheetTitle(): Locator {
    return this.page.getByRole('heading', { name: 'Vergelijkbare oefening' });
  }

  /**
   * Opens the add-exercise picker, adds the first available exercise, and
   * returns its name. The picker only lists exercises not already suggested,
   * so the returned exercise is guaranteed new to the list.
   */
  async addFirstAvailable(): Promise<string> {
    await this.page.getByRole('button', { name: 'Oefening toevoegen' }).click();
    const dialog = this.page.getByRole('dialog');
    const candidate = dialog.getByRole('button').filter({ hasNotText: 'Sluiten' }).first();
    const name = (await candidate.innerText()).trim();
    await candidate.click();
    return name;
  }

  async start(): Promise<void> {
    await this.page.getByRole('button', { name: 'Start training' }).click();
    await this.page.waitForURL(/\/workout\/[^\/]+$/);
  }
}
