import { test, expect } from '../fixtures/app';

// Smal telefoonscherm: de koppelknop en omhoog/omlaag mogen nooit buiten beeld vallen.
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

    // Eerste kaart heeft geen koppelknop; de tweede wel.
    const link = page.getByRole('button', { name: 'Superset koppelen' }).first();
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeInViewport({ ratio: 1 });
    await expect(link).toContainText('Superset met vorige');
    await expect(page.getByRole('button', { name: 'Omhoog' }).nth(1)).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Omlaag' }).first()).toBeInViewport({ ratio: 1 });
  });

  test('schema bewerken toont koppelknop in beeld', async ({ schemaEditor }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('Smal');
    await schemaEditor.addExercise('Barbell Bench Press');
    await schemaEditor.addExercise('Barbell Row');

    const link = schemaEditor.exerciseRow('Barbell Row').getByRole('button', { name: 'Superset met vorige' });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeInViewport({ ratio: 1 });
  });
});
