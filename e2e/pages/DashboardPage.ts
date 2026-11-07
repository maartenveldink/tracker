import type { Locator, Page } from '@playwright/test';

/** Page object for the home dashboard (`/`). */
export class DashboardPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  /** Records a quick body-weight entry. */
  async weighIn(kg: number): Promise<void> {
    await this.page.getByPlaceholder('kg').fill(String(kg));
    await this.page.getByRole('button', { name: 'Opslaan' }).click();
  }

  latestWeight(): Locator {
    return this.page.getByText(/laatst .* kg/);
  }

  /** The weeks-in-a-row training streak number. */
  get streak(): Locator {
    return this.page.getByText('wk streak').locator('xpath=preceding-sibling::p[1]');
  }

  get resumeButton(): Locator {
    return this.page.getByRole('button', { name: 'Hervat' });
  }
}
