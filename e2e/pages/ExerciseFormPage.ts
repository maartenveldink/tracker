import type { Page } from '@playwright/test';

/** Page object for the exercise create/edit form (`/exercises/new`, `/exercises/:id/edit`). */
export class ExerciseFormPage {
  constructor(private readonly page: Page) {}

  async gotoNew(): Promise<void> {
    await this.page.goto('/exercises/new');
    await this.page.locator('#exercise-name').waitFor();
  }

  async setName(name: string): Promise<void> {
    await this.page.locator('#exercise-name').fill(name);
  }

  async setDescription(text: string): Promise<void> {
    await this.page.locator('#exercise-description').fill(text);
  }

  /** Picks a per-exercise weight increment from the "Gewichtsstap" dropdown. */
  async setWeightStep(label: string): Promise<void> {
    await this.page.locator('#weight-step').selectOption({ label });
  }

  /** Submits and waits for the redirect back to the exercise list. */
  async save(): Promise<void> {
    await this.page.getByRole('button', { name: /Aanmaken|Opslaan/ }).click();
    await this.page.waitForURL(/\/exercises$/);
  }

  /** Convenience: create a fresh exercise end-to-end. */
  async create(name: string, description?: string): Promise<void> {
    await this.gotoNew();
    await this.setName(name);
    if (description) await this.setDescription(description);
    await this.save();
  }
}
