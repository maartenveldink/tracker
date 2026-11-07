import type { Page } from '@playwright/test';

type Equipment = 'cable' | 'dumbbell' | 'plates' | 'other';
type Formula = 'epley' | 'brzycki' | 'lombardi';

/** Page object for the Settings screen (`/settings`). */
export class SettingsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/settings');
  }

  async selectFormula(formula: Formula): Promise<void> {
    await this.page.locator(`#formula-${formula}`).click();
  }

  /** Sets the weight increment for an equipment type via its dropdown. */
  async setWeightStep(equipment: Equipment, label: string): Promise<void> {
    await this.page.locator(`#weightstep-${equipment}`).selectOption({ label });
  }

  async weightStepValue(equipment: Equipment): Promise<string> {
    return this.page.locator(`#weightstep-${equipment}`).inputValue();
  }

  /**
   * Wipes all data (with confirmation) and waits until the wipe has finished,
   * so a following `page.goto()` cannot reload the page mid-transaction.
   */
  async clearAll(): Promise<void> {
    await this.page.getByRole('button', { name: 'Alles wissen' }).click();
    await this.page.getByRole('button', { name: 'Ja, alles wissen' }).click();
    await this.page.getByText('Alle data gewist', { exact: false }).waitFor();
  }

  /** Exports the data via the Instellingen button and saves the download to `file`. */
  async exportTo(file: string): Promise<void> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.page.getByRole('button', { name: 'Exporteer data' }).click(),
    ]);
    await download.saveAs(file);
  }

  /**
   * Imports a previously exported file in the given mode and waits for the
   * "Import voltooid" dialog (so the transaction is committed before the
   * caller navigates away), then closes it.
   */
  async importFrom(file: string, mode: 'replace' | 'merge'): Promise<void> {
    await this.page.locator('input[type="file"]').setInputFiles(file);
    await this.page.getByRole('button', { name: mode === 'replace' ? /Vervangen/ : /Samenvoegen/ }).click();
    await this.page.getByText('Import voltooid').waitFor();
    await this.page.getByRole('button', { name: 'Sluiten' }).click();
  }
}
