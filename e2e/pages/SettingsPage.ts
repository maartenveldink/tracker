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

  /** Wipes all data (with confirmation). */
  async clearAll(): Promise<void> {
    await this.page.getByRole('button', { name: 'Alles wissen' }).click();
    await this.page.getByRole('button', { name: 'Ja, alles wissen' }).click();
  }
}
