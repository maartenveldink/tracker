import type { Locator, Page } from '@playwright/test';

/** Page object for the food database list + create form (nutrition module). */
export class FoodsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/foods');
  }

  /** Creates a food via the form and returns to the list. */
  async createFood(name: string): Promise<void> {
    await this.page.goto('/foods/new');
    await this.page.locator('#food-name').fill(name);
    await this.page.locator('#food-serving').fill('100');
    await this.page.getByRole('button', { name: /Aanmaken|Opslaan/ }).click();
    await this.page.waitForURL(/\/foods$/);
  }

  card(name: string): Locator {
    return this.page.getByRole('heading', { name, exact: true });
  }
}
