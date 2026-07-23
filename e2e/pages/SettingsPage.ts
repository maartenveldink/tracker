import type { Page } from '@playwright/test';

type Equipment = 'cable' | 'dumbbell' | 'plates' | 'other';
type Formula = 'epley' | 'brzycki' | 'lombardi';
type Feature = 'nutrition' | 'planner';

/** Page object for the Settings screen (`/settings`). */
export class SettingsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/settings');
  }

  async selectFormula(formula: Formula): Promise<void> {
    await this.page.locator(`#formula-${formula}`).click();
  }

  /**
   * Enables/disables an optional feature module. Waits for the change to reach
   * the nav (i.e. persist to IndexedDB) so a follow-up navigation to the now-
   * gated route isn't redirected by a not-yet-committed flag.
   */
  async toggleFeature(feature: Feature): Promise<void> {
    await this.page.locator(`#feature-${feature}`).click();
    const navName = feature === 'nutrition' ? 'Voeding' : 'Planner';
    await this.page.getByRole('link', { name: navName }).waitFor({ state: 'visible' });
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
