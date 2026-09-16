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
    await this.page.waitForURL(/\/exercises\/[^\/]+\/edit$/);
  }

  async delete(name: string): Promise<void> {
    await this.page.getByRole('button', { name: `Verwijder ${name}` }).click();
    await this.page.getByRole('button', { name: 'Verwijderen' }).click();
  }

  /** Merge `source` into `target`: source is removed, its data moves to target. */
  async mergeInto(source: string, target: string): Promise<void> {
    await this.page.getByRole('button', { name: `Samenvoegen ${source}` }).click();
    const sheet = this.page.getByRole('dialog');
    await sheet.getByPlaceholder('Zoek oefening...').fill(target);
    await sheet.getByRole('button', { name: target, exact: true }).click();
    await sheet.getByRole('button', { name: 'Samenvoegen', exact: true }).click();
    // The merge is async (a Dexie transaction); wait for the sheet to unmount.
    await sheet.waitFor({ state: 'detached' });
  }
}
