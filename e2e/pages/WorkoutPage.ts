import type { Locator, Page } from '@playwright/test';

/**
 * Page object for the live workout screen (`/workout/:id`).
 *
 * The screen shows one exercise at a time ("current exercise") in the B1 layout:
 * set dots (`set-row`, one per set) or, for a unilateral exercise, the zigzag
 * (`side-dot`, one per side: L1 → R1 → L2 → R2, `data-set` + `data-side`),
 * the set card with the weight/reps steppers for the opened set, the "Gedaan"
 * list (`done-row`) and at the bottom the rest ring next to the main button. The full list of
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

  /** The running rest ring (`role="timer"`, present only while resting; idle it is `rest-ring-idle`). */
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

  /** The big primary button ("Set klaar" / "Opslaan" / "Volgende oefening" / …). */
  get primaryButton(): Locator {
    return this.page.getByRole('button', { name: /^(Set klaar|Opslaan|Volgende oefening|Laatste oefening afronden|Training afronden)$/ });
  }

  /** Set dots of the current exercise (one per set, a left/right pair counts once). */
  get setDots(): Locator {
    return this.page.getByTestId('set-row');
  }

  /** Zigzag dots of a unilateral exercise (one per side, in order L1, R1, L2, R2, …). */
  get sideDots(): Locator {
    return this.page.getByTestId('side-dot');
  }

  /** The zigzag dot of one side of a unilateral set (`set` is 1-based). */
  sideDot(set: number, side: 'left' | 'right'): Locator {
    return this.page.locator(`[data-testid="side-dot"][data-set="${set}"][data-side="${side}"]`);
  }

  /** The idle rest ring (no rest running); shows "na R" on a unilateral exercise. */
  get restRingIdle(): Locator {
    return this.page.getByTestId('rest-ring-idle');
  }

  /**
   * Rows of the "Gedaan" list (one per logged set, with the difference to last
   * time; unilateral: one per set with both sides logged, "Set 1 · 20 kg · L 12 · R 12").
   */
  get doneRows(): Locator {
    return this.page.getByTestId('done-row');
  }

  /** Opens the nth (0-based) set in the set card by tapping its dot. */
  async openSet(index: number): Promise<void> {
    await this.setDots.nth(index).click();
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

  /** Number of sets of the current exercise; a unilateral left/right pair counts once. */
  setCount(): Promise<number> {
    return this.page.locator('[data-testid="set-row"], [data-testid="side-dot"][data-side="left"]').count();
  }

  async addSet(): Promise<void> {
    await this.page.getByRole('button', { name: 'Set toevoegen' }).click();
  }

  /**
   * Removes the last set: opens it via its dot, then "Set verwijderen" (only
   * offered on the last, not yet logged set; a unilateral exercise loses its
   * left+right pair; its last dot is the right side).
   */
  async removeLastSet(): Promise<void> {
    await this.page.locator('[data-testid="set-row"], [data-testid="side-dot"]').last().click();
    await this.page.getByRole('button', { name: 'Set verwijderen', exact: true }).click();
  }

  /** Taps the running rest ring: +30 seconds. */
  async extendRest(): Promise<void> {
    await this.restTimer.getByRole('button').click();
  }

  /** Remaining rest in seconds, read from the timer's aria-label ("Rust nog 1 minuut 12 seconden"). */
  async restSeconds(): Promise<number> {
    const label = (await this.restTimer.getAttribute('aria-label')) ?? '';
    const m = label.match(/(\d+) minu(?:ut|ten) (\d+) seconden/);
    return Number(m?.[1]) * 60 + Number(m?.[2]);
  }

  /** Skips an exercise via the overview sheet (the live screen has no skip button, B1). */
  async skipExercise(name: string): Promise<void> {
    await this.openOverview();
    await this.page.getByRole('button', { name: `${name} overslaan` }).click();
    await this.closeSheet();
  }

  /** Finishes the workout (confirms the sheet) and waits for the summary. */
  async finish(): Promise<void> {
    await this.page.getByRole('button', { name: 'Afronden', exact: true }).first().click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Afronden', exact: true }).click();
    await this.page.waitForURL(/\/workout\/[^\/]+\/summary$/);
  }
}
