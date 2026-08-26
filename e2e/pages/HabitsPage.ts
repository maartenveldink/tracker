import type { Locator, Page } from '@playwright/test';

const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

type Schedule =
  | { kind: 'daily' }
  | { kind: 'interval'; everyDays: number }
  | { kind: 'weekdays'; days: number[] }   // 0=ma … 6=zo
  | { kind: 'monthdays'; days: number[] };

interface CreateHabit {
  name: string;
  emoji?: string;
  type?: 'boolean' | 'count';
  target?: number;
  schedule?: Schedule;
}

/** Page object for the habit tracker (`/habits`). */
export class HabitsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/habits');
  }

  async gotoNew(): Promise<void> {
    await this.page.goto('/habits/new');
  }

  /** Fills the habit form and saves; returns to the day view. */
  async create({ name, emoji, type = 'boolean', target, schedule = { kind: 'daily' } }: CreateHabit): Promise<void> {
    await this.gotoNew();
    if (emoji) await this.page.getByLabel('Emoji').fill(emoji);
    await this.page.getByLabel('Naam').fill(name);

    if (type === 'count') {
      await this.page.getByRole('button', { name: 'Teller', exact: true }).click();
      if (target != null) await this.page.getByLabel('Doel').fill(String(target));
    }

    switch (schedule.kind) {
      case 'daily':
        await this.page.getByRole('button', { name: 'Dagelijks', exact: true }).click();
        break;
      case 'interval':
        await this.page.getByRole('button', { name: 'Elke X dagen', exact: true }).click();
        await this.page.getByLabel('Aantal dagen').fill(String(schedule.everyDays));
        break;
      case 'weekdays':
        await this.page.getByRole('button', { name: 'Weekdagen', exact: true }).click();
        for (const d of schedule.days) {
          await this.page.getByRole('button', { name: WEEKDAYS[d]!, exact: true }).click();
        }
        break;
      case 'monthdays':
        await this.page.getByRole('button', { name: 'Dag v/d maand', exact: true }).click();
        for (const d of schedule.days) {
          await this.page.getByRole('button', { name: String(d), exact: true }).click();
        }
        break;
    }

    await this.page.getByRole('button', { name: 'Habit aanmaken' }).click();
    await this.page.waitForURL(/\/habits$/);
  }

  get rows(): Locator {
    return this.page.getByTestId('habit-row');
  }

  row(name: string): Locator {
    return this.rows.filter({ hasText: name });
  }

  async toggle(name: string): Promise<void> {
    await this.row(name).getByRole('button', { name: /Afvink/ }).click();
  }

  async increment(name: string): Promise<void> {
    await this.row(name).getByRole('button', { name: 'Meer' }).click();
  }

  async prevDay(): Promise<void> {
    await this.page.getByRole('button', { name: 'Vorige dag' }).click();
  }
}
