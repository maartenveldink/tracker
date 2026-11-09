import type { Page } from '@playwright/test';

type Tab = 'Oefeningen' | 'Overzicht' | 'Gewicht';

/** Page object for the Progress screen (`/progress`). */
export class ProgressPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/progress');
  }

  async openTab(tab: Tab): Promise<void> {
    await this.page.getByRole('tab', { name: tab, exact: true }).click();
  }

  /** Opens an exercise's history (1RM chart + sessions) from the Oefeningen list. */
  async openExercise(name: string): Promise<void> {
    await this.page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await this.page.getByRole('heading', { name, exact: true }).waitFor();
  }

  /** The goal progress bar for an exercise (history page or records board). */
  goalBar(name: string) {
    return this.page.getByRole('progressbar', { name: `Doel ${name}`, exact: true });
  }

  // --- Training calendar (Overzicht tab) ---

  get calendarMonth() {
    return this.page.getByTestId('calendar-month');
  }

  get calendarDetails() {
    return this.page.getByTestId('calendar-day-details');
  }

  /** A day cell, e.g. calendarDay('5 november'); matches "5 november, 2 trainingen". */
  calendarDay(label: string) {
    return this.page.getByRole('button', { name: new RegExp(`^${label}, `) });
  }

  /** All day cells of the shown month (labelled "<d> <maand>, ..."). */
  get calendarDays() {
    return this.page.getByRole('button', { name: /^\d+ [a-z]+, (geen training|\d+ (training|trainingen))$/ });
  }

  async calendarPrevious(): Promise<void> {
    await this.page.getByRole('button', { name: 'Vorige maand' }).click();
  }

  async calendarNext(): Promise<void> {
    await this.page.getByRole('button', { name: 'Volgende maand' }).click();
  }

  async calendarToday(): Promise<void> {
    await this.page.getByRole('button', { name: 'Vandaag', exact: true }).click();
  }
}

/** Page object for the workout history list (`/start/history`). */
export class WorkoutHistoryPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/start/history');
  }

  /** Rows are labelled with a delete button; count them by that button. */
  get entries() {
    return this.page.getByRole('button', { name: 'Verwijder training' });
  }

  async deleteFirst(): Promise<void> {
    await this.entries.first().click();
    await this.page.getByRole('button', { name: 'Verwijderen' }).click();
  }
}
