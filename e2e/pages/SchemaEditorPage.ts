import type { Locator, Page } from '@playwright/test';

/**
 * Page object for the schema create/edit form (`/schemas/new`, `/schemas/:id/edit`).
 * Encapsulates the DOM so specs read as user intent, not selectors.
 */
export class SchemaEditorPage {
  constructor(private readonly page: Page) {}

  async gotoNew(): Promise<void> {
    await this.page.goto('/schemas/new');
    await this.page.locator('#schema-name').waitFor();
  }

  async setName(name: string): Promise<void> {
    await this.page.locator('#schema-name').fill(name);
  }

  /** Opens the picker and adds an exercise by its exact name. */
  async addExercise(name: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Oefening toevoegen' }).click();
    const option = this.page.getByRole('button', { name, exact: true });
    await option.waitFor({ state: 'visible' });
    await option.click();
  }

  /** A single exercise row in the list, located by its exercise name. */
  exerciseRow(name: string): Locator {
    return this.page.getByTestId('schema-exercise').filter({ hasText: name });
  }

  /** Links the named exercise into a superset with the exercise directly above it. */
  async linkWithPrevious(name: string): Promise<void> {
    await this.exerciseRow(name).getByRole('button', { name: 'Superset met vorige' }).click();
  }

  /** Removes the named exercise from its superset. */
  async unlink(name: string): Promise<void> {
    await this.exerciseRow(name).getByRole('button', { name: 'Superset ontkoppelen' }).click();
  }

  /** All superset group containers currently rendered. */
  get supersetGroups(): Locator {
    return this.page.getByTestId('superset-group');
  }

  /** The superset A/B/C badge shown for an exercise row. */
  supersetBadge(name: string): Locator {
    return this.exerciseRow(name).getByText(/^[A-Z]$/);
  }

  /** Saves the schema and waits for the redirect to its detail page. */
  async save(): Promise<void> {
    await this.page.getByRole('button', { name: /Aanmaken|Opslaan/ }).click();
    await this.page.waitForURL(/\/schemas\/\d+$/);
  }
}
