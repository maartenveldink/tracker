import type { Locator, Page } from '@playwright/test';

/** Page object for the schema list (`/schemas`). */
export class SchemasPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/schemas');
  }

  get newButton(): Locator {
    return this.page.getByRole('link', { name: 'Nieuw' });
  }

  card(name: string): Locator {
    return this.page.getByRole('heading', { name, exact: true });
  }

  async open(name: string): Promise<void> {
    await this.card(name).click();
    await this.page.waitForURL(/\/schemas\/\d+$/);
  }

  /** Duplicates a schema; the app opens the copy's editor. */
  async copy(name: string): Promise<void> {
    await this.page.getByRole('button', { name: `Kopieer ${name}` }).click();
    await this.page.waitForURL(/\/schemas\/\d+\/edit$/);
  }

  async delete(name: string): Promise<void> {
    await this.page.getByRole('button', { name: `Verwijder ${name}` }).click();
    await this.page.getByRole('button', { name: 'Verwijderen' }).click();
  }
}
