import type { Locator, Page } from '@playwright/test';

/** Page object for the weekly planner list + create form (planner module). */
export class PlannerPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/planner');
  }

  /** Opens the "Beheer" tab where week plans are listed. */
  async openManage(): Promise<void> {
    // The planner page is lazy-loaded and re-renders as its live queries
    // resolve; wait for the tab to settle before clicking to avoid a race with
    // Radix re-mounting the trigger under heavy parallel load.
    const tab = this.page.getByRole('tab', { name: 'Beheer' });
    await tab.waitFor({ state: 'visible' });
    await this.page.waitForTimeout(200);
    await tab.click();
  }

  /** Creates a week plan via the form and returns to the planner. */
  async createPlan(name: string): Promise<void> {
    await this.page.goto('/planner/new');
    await this.page.locator('#plan-name').fill(name);
    await this.page.getByRole('button', { name: /Aanmaken|Opslaan/ }).click();
    await this.page.waitForURL(/\/planner$/);
  }

  card(name: string): Locator {
    return this.page.getByRole('heading', { name, exact: true });
  }
}
