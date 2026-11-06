import type { Locator, Page } from '@playwright/test';

/** Page object for the schema JSON import screen (`/schemas/import`). */
export class SchemaImportPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/schemas/import');
  }

  get input(): Locator {
    return this.page.getByLabel('Schema JSON');
  }

  get errors(): Locator {
    return this.page.getByTestId('import-errors');
  }

  get warnings(): Locator {
    return this.page.getByTestId('import-warnings');
  }

  get summary(): Locator {
    return this.page.getByTestId('import-summary');
  }

  get unknownNote(): Locator {
    return this.page.getByTestId('import-unknown');
  }

  get importButton(): Locator {
    return this.page.getByRole('button', { name: 'Importeren', exact: true });
  }

  async paste(json: string | object): Promise<void> {
    await this.input.fill(typeof json === 'string' ? json : JSON.stringify(json, null, 2));
  }

  async chooseFile(name: string, contents: string): Promise<void> {
    await this.page.getByLabel('Kies JSON-bestand').setInputFiles({
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(contents),
    });
  }

  /** Clicks the import button, then confirms in the dialog; lands on the detail page. */
  async importAndConfirm(): Promise<void> {
    await this.importButton.click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Importeren' }).click();
    await this.page.waitForURL(/\/schemas\/(?!import$)[^\/]+$/);
  }
}
