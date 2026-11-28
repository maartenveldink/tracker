import { test, expect } from '../fixtures/app';

// Smal telefoonscherm: de koppelknop (alleen op een uitgeklapte kaart) en
// omhoog/omlaag mogen nooit buiten beeld vallen.
test.use({ viewport: { width: 360, height: 740 } });

test.describe('Superset-knop op een smal scherm', () => {
  test('voorgestelde training toont koppelknop, omhoog en omlaag in beeld', async ({
    startWorkout,
    suggest,
    page,
  }) => {
    await startWorkout.goto();
    await startWorkout.openSuggestion();
    await expect(suggest.rows.first()).toBeVisible();

    // Ingeklapt is er geen koppelknop.
    await expect(page.getByRole('button', { name: 'Superset met vorige' })).toHaveCount(0);

    // Eerste kaart heeft ook uitgeklapt geen koppelknop; de tweede wel.
    const first = await suggest.expand(0);
    await expect(first.getByRole('button', { name: 'Superset met vorige' })).toHaveCount(0);
    await expect(first.getByRole('button', { name: 'Wissel oefening' })).toBeVisible();
    const second = await suggest.expand(1);
    const link = second.getByRole('button', { name: 'Superset met vorige' });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeInViewport({ ratio: 1 });
    await expect(link).toContainText('Superset met vorige');
    await expect(second.getByRole('button', { name: 'Omhoog' })).toBeInViewport({ ratio: 1 });
    await expect(second.getByRole('button', { name: 'Omlaag' })).toBeInViewport({ ratio: 1 });
    await expect(second.getByRole('button', { name: 'Wissel oefening' })).toBeInViewport({ ratio: 1 });
  });

  test('schema bewerken toont koppelknop in beeld', async ({ schemaEditor }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('Smal');
    await schemaEditor.addExercise('Barbell Bench Press');
    await schemaEditor.addExercise('Barbell Row');

    const row = schemaEditor.exerciseRow('Barbell Row');
    await expect(row.getByRole('button', { name: 'Superset met vorige' })).toHaveCount(0);
    await schemaEditor.expand('Barbell Row');
    const link = row.getByRole('button', { name: 'Superset met vorige' });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeInViewport({ ratio: 1 });
  });
});
