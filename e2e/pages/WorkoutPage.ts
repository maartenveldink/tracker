import type { Locator, Page } from '@playwright/test';

/**
 * Page object for the live workout screen (`/workout/:id`).
 *
 * The screen shows one exercise at a time ("current exercise"): its sets, the
 * weight/reps steppers and the big "Set klaar" button. The full list of
 * exercises lives in the "Oefeningen in deze training" sheet; helpers that need
 * it (`exerciseOrder`, `exerciseMeta`, …) open and close it themselves.
 */
export class WorkoutPage {
  constructor(private readonly page: Page) {}

  /**
   * Title (exercise name) of the current exercise. Assert on it with web-first
   * assertions (`toContainText`): right after the workout opens, the title can
   * render before the exercise list has loaded from IndexedDB.
   */
  get currentTitle(): Locator {
    return this.page.getByTestId('current-exercise');
  }

  /** Superset badge of the current exercise (only present inside a superset). */
  get supersetBadge(): Locator {
    return this.page.getByTestId('superset-badge');
  }

  /** The rest-timer strip (present only while resting). */
  get restTimer(): Locator {
    return this.page.getByTestId('rest-timer');
  }

  /** The weight stepper input of the current exercise. */
  get weightInput(): Locator {
    return this.page.getByTestId('weight-input');
  }

  /** The reps stepper input of the current exercise. */
  get repsInput(): Locator {
    return this.page.getByTestId('reps-input');
  }

  /** The big primary button ("Set klaar" / "Volgende oefening" / …). */
  get primaryButton(): Locator {
    return this.page.getByRole('button', { name: /^(Set klaar|Volgende oefening|Laatste oefening afronden|Training afronden)$/ });
  }

  /** Opens the exercise overview sheet. */
  async openOverview(): Promise<void> {
    await this.page.getByRole('button', { name: 'Oefeningen in deze training' }).click();
  }

  /** Closes whatever sheet is open. */
  async closeSheet(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.page.getByRole('dialog').waitFor({ state: 'detached' });
  }

  /** Rows of the overview sheet (only while it is open). */
  get overviewRows(): Locator {
    return this.page.getByTestId('overview-row');
  }

  /** Exercise names in workout order, read from the overview sheet. */
  async exerciseOrder(): Promise<string[]> {
    await this.openOverview();
    await this.overviewRows.first().waitFor({ state: 'visible' }).catch(() => undefined);
    const names = (await this.page.getByTestId('overview-name').allInnerTexts()).map(n => n.trim());
    await this.closeSheet();
    return names;
  }

  /** Sub-line of the nth (0-based) exercise in the overview, e.g. "1/3 sets · nieuw". */
  async exerciseMeta(index: number): Promise<string> {
    await this.openOverview();
    const meta = this.page.getByTestId('overview-meta').nth(index);
    await meta.waitFor({ state: 'visible' });
    const text = (await meta.innerText()).trim();
    await this.closeSheet();
    return text;
  }

  /** Superset label ("A", "B", …) of the nth exercise in the overview, or null. */
  async exerciseSuperset(index: number): Promise<string | null> {
    await this.openOverview();
    const row = this.overviewRows.nth(index);
    await row.waitFor({ state: 'visible' });
    const label = await row.getAttribute('data-superset');
    await this.closeSheet();
    return label;
  }

  /**
   * Logs the active set: enters weight and reps in the steppers and taps
   * "Set klaar". Waits a moment so the write to IndexedDB settles before the
   * next action.
   */
  async completeActiveSet(weight: number, reps: number): Promise<void> {
    await this.weightInput.fill(String(weight));
    await this.logActiveReps(reps);
  }

  /**
   * Logs the active set with the current weight (it stays filled in after
   * "Set klaar") and the given reps.
   */
  async logActiveReps(reps: number): Promise<void> {
    await this.repsInput.fill(String(reps));
    await this.page.getByRole('button', { name: 'Set klaar', exact: true }).click();
    await this.page.waitForTimeout(300);
  }

  /** Logs every remaining set of the current (non-superset) exercise. */
  async completeExercise(weight: number, reps: number, sets = 3): Promise<void> {
    await this.completeActiveSet(weight, reps);
    for (let i = 1; i < sets; i++) await this.logActiveReps(reps);
  }

  /** Taps "Volgende oefening" (only offered once all sets of the exercise are logged). */
  async nextExercise(): Promise<void> {
    await this.page.getByRole('button', { name: 'Volgende oefening', exact: true }).click();
  }

  /** Adds an exercise mid-workout via the overview sheet + picker. */
  async addExercise(name: string): Promise<void> {
    await this.openOverview();
    await this.page.getByRole('dialog').getByRole('button', { name: /Oefening toevoegen/ }).click();
    await this.page.getByRole('button', { name, exact: true }).click();
  }

  /**
   * Creates a brand-new exercise from inside the add-exercise sheet and adds it
   * to the workout: searches for a name that doesn't exist, opens the full form
   * (prefilled with that name), then submits. `description` is optional.
   */
  async createAndAddExercise(name: string, description?: string): Promise<void> {
    await this.openOverview();
    await this.page.getByRole('dialog').getByRole('button', { name: /Oefening toevoegen/ }).click();
    await this.page.getByPlaceholder('Zoek oefening...').fill(name);
    await this.page.getByRole('button', { name: `Nieuwe oefening "${name}" aanmaken` }).click();
    // The form is prefilled with the searched name.
    if (description) await this.page.locator('#exercise-description').fill(description);
    await this.page.getByRole('button', { name: 'Aanmaken & toevoegen' }).click();
  }

  async pause(): Promise<void> {
    await this.page.getByRole('button', { name: 'Pauze' }).click();
  }

  async resume(): Promise<void> {
    await this.page.getByRole('button', { name: 'Hervat' }).click();
  }

  get pausedBanner(): Locator {
    return this.page.getByText('Training gepauzeerd');
  }

  /** Number of set rows of the current exercise. */
  setCount(): Promise<number> {
    return this.page.getByTestId('set-row').count();
  }

  async addSet(): Promise<void> {
    await this.page.getByRole('button', { name: 'Set toevoegen' }).click();
  }

  /** "Laatste set weghalen" (a unilateral exercise loses a left+right pair). */
  async removeLastSet(): Promise<void> {
    await this.page.getByRole('button', { name: 'Laatste set weghalen' }).click();
  }

  /** Skips the running rest timer. */
  async skipRest(): Promise<void> {
    await this.restTimer.getByRole('button', { name: 'Sla over' }).click();
  }

  /** Finishes the workout (confirms the sheet) and waits for the summary. */
  async finish(): Promise<void> {
    await this.page.getByRole('button', { name: 'Afronden', exact: true }).first().click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Afronden', exact: true }).click();
    await this.page.waitForURL(/\/workout\/[^\/]+\/summary$/);
  }
}
