import type { Locator, Page } from '@playwright/test';

/**
 * Page object for the live workout screen (`/workout/:id`).
 *
 * Only the expanded exercise card renders its set grid, so "the expanded card"
 * is the one that contains the quick-reps bar — a stable, style-independent way
 * to follow the app's focus as it advances.
 */
export class WorkoutPage {
  constructor(private readonly page: Page) {}

  /** The exercise card that is currently expanded (shows the quick-reps bar). */
  get expandedCard(): Locator {
    return this.page
      .getByTestId('exercise-card')
      .filter({ has: this.page.getByTestId('quick-reps') });
  }

  /** Name of the exercise in the expanded card. */
  async expandedExerciseName(): Promise<string> {
    return (await this.expandedCard.locator('h3').first().innerText()).trim();
  }

  /** The rest-timer countdown bar (present only while resting). */
  get restTimer(): Locator {
    return this.page.getByTestId('rest-timer');
  }

  get supersetGroups(): Locator {
    return this.page.getByTestId('superset-group');
  }

  /**
   * Logs the active set of the expanded card: enters a weight, then taps a rep
   * count (which completes the set). Waits for the live query to settle so the
   * weight is registered before completion.
   */
  async completeActiveSet(weight: number, reps: number): Promise<void> {
    const card = this.expandedCard;
    await card.getByTestId('set-weight').first().fill(String(weight));
    // The weight round-trips through IndexedDB (useLiveQuery) before it counts.
    await this.page.waitForTimeout(400);
    await card.getByTestId('quick-reps').getByRole('button', { name: String(reps), exact: true }).click();
  }
}
