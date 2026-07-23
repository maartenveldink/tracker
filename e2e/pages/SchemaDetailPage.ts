import type { Page } from '@playwright/test';

/** Page object for a schema's detail page (`/schemas/:id`). */
export class SchemaDetailPage {
  constructor(private readonly page: Page) {}

  /** Opens the share dialog and returns the generated import URL. */
  async getShareUrl(): Promise<string> {
    await this.page.getByRole('button', { name: 'Schema delen' }).click();
    const input = this.page.getByRole('dialog').getByRole('textbox');
    await input.waitFor();
    return input.inputValue();
  }

  async edit(): Promise<void> {
    await this.page.getByRole('button', { name: 'Bewerken' }).click();
    await this.page.waitForURL(/\/schemas\/\d+\/edit$/);
  }
}
