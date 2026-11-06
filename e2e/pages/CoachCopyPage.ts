import { expect, type Locator, type Page } from '@playwright/test';

/** The "Analyse door Claude" section on a schema's detail page. */
export class CoachCopyPage {
  constructor(private readonly page: Page) {}

  get section(): Locator {
    return this.page.getByTestId('coach-copy');
  }

  get copyButton(): Locator {
    return this.section.getByRole('button', { name: /Kopieer voor Claude|Gekopieerd/ });
  }

  period(weeks: 4 | 8): Locator {
    return this.section.getByRole('button', { name: `${weeks} weken` });
  }

  get goal(): Locator {
    return this.section.getByLabel('Doel of vraag (optioneel)');
  }

  get preview(): Locator {
    return this.page.getByTestId('coach-preview');
  }

  /** The text shown in the (collapsible) preview block. */
  async previewText(): Promise<string> {
    await this.preview.locator('summary').click();
    return this.preview.getByLabel('Gekopieerde tekst').inputValue();
  }

  /**
   * Clicks the copy button and returns the text the app wrote to the clipboard.
   * The page's `clipboard.writeText` is wrapped to capture it: the real system
   * clipboard is shared between parallel browser contexts, so reading it back
   * would race with other tests.
   */
  async copy(): Promise<string> {
    type Captured = { __copied?: string };
    await this.page.evaluate(() => {
      const w = window as unknown as Captured;
      w.__copied = undefined;
      navigator.clipboard.writeText = async (text: string) => {
        w.__copied = text;
      };
    });
    await expect(this.copyButton).toBeEnabled();
    await this.copyButton.click();
    await expect
      .poll(() => this.page.evaluate(() => (window as unknown as Captured).__copied))
      .toBeTruthy();
    return this.page.evaluate(() => (window as unknown as Captured).__copied ?? '');
  }
}

/** The parts of the copied summary JSON the tests look at. */
export interface SummaryJson {
  period: { weeks: number; sessions: number };
  frequency: { sessionsPerWeek: number; perWeek: number[]; weeksWithoutSession: number; byDay: Record<string, number> };
  currentSchema: { name: string } | null;
  exercises: {
    name: string;
    sessions: number;
    e1rm: { startKg: number; endKg: number; changePct: number | null } | null;
    setsDone: number;
    setsSkipped: number;
    perSession: { week: number; sets: number; skippedSets: number; reps: string | null; target: string | null }[];
    perWeek: { week: number; avgKg: number | null; volumeKg: number; totalReps: number }[];
  }[];
  muscles: { muscle: string; sets: number; setsPerWeek: number; volumeKg: number }[];
  undertrained: { muscle: string; setsPerWeek: number }[];
  bodyWeight: { entries: number; startKg: number; endKg: number; changeKg: number } | null;
  notes: {
    sessions: { week: number; day: string | null; text: string }[];
    exercises: { week: number; exercise: string; text: string }[];
  };
  existingExercises: string[];
}

/** Pulls the training-summary JSON (last section) out of a copied prompt. */
export function extractSummary(prompt: string): { json: SummaryJson; raw: string } {
  const marker = '## Samenvatting van mijn training (JSON)\n';
  const i = prompt.indexOf(marker);
  if (i < 0) throw new Error('summary section missing from prompt');
  const raw = prompt.slice(i + marker.length).trim();
  return { json: JSON.parse(raw) as SummaryJson, raw };
}
