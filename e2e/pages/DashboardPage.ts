import type { Locator, Page } from '@playwright/test';

/** Page object for the home dashboard (`/`). */
export class DashboardPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  /** Records a quick body-weight entry. */
  async weighIn(kg: number): Promise<void> {
    // With history the weigh-in lives in a sheet behind the "+ Log" tile button;
    // on the empty home it is inline.
    // Wait until the data has loaded (home flashes nothing while loading).
    await this.page.getByRole('heading', { name: 'Vandaag' }).waitFor();
    await this.page.getByText(/Begin je eerste training|weken streak/).first().waitFor();
    const logButton = this.page.getByRole('button', { name: '+ Log' });
    if (await logButton.isVisible()) await logButton.click();
    await this.page.getByPlaceholder('kg').fill(String(kg));
    await this.page.getByRole('button', { name: 'Opslaan' }).click();
  }

  latestWeight(): Locator {
    return this.page.getByTestId('weight-tile');
  }

  /** The weeks-in-a-row training streak number. */
  get streak(): Locator {
    return this.page.getByText('weken streak').locator('xpath=preceding-sibling::p[1]');
  }

  get resumeButton(): Locator {
    return this.page.getByRole('button', { name: 'Hervat' });
  }

  /** The "overweeg een deload-week" notice. */
  get deloadCard(): Locator {
    return this.page.getByTestId('deload-card');
  }

  get hideDeloadButton(): Locator {
    return this.deloadCard.getByRole('button', { name: 'Verberg een week' });
  }
}
