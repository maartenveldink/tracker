import type { Locator, Page } from '@playwright/test';

/** Page object for the exercise library list (`/exercises`). */
export class ExercisesPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/exercises');
  }

  get newButton(): Locator {
    return this.page.getByRole('link', { name: 'Nieuw' });
  }

  async search(text: string): Promise<void> {
    await this.page.getByPlaceholder('Zoek oefening...').fill(text);
  }

  /** A list card located by exercise name. */
  card(name: string): Locator {
    return this.page.getByRole('heading', { name, exact: true });
  }

  async open(name: string): Promise<void> {
    await this.card(name).click();
    await this.page.waitForURL(/\/exercises\/\d+\/edit$/);
  }

  async delete(name: string): Promise<void> {
    await this.page.getByRole('button', { name: `Verwijder ${name}` }).click();
    await this.page.getByRole('button', { name: 'Verwijderen' }).click();
  }
}
