import { test, expect } from '../fixtures/app';

const A = 'Barbell Bench Press';

test.describe('Settings', () => {
  test('persists the 1RM formula across a reload', async ({ settings, page }) => {
    await settings.goto();
    await settings.selectFormula('brzycki');

    await page.reload();
    await expect(page.locator('#formula-brzycki')).toBeChecked();
  });

  test('persists a per-equipment weight step across a reload', async ({ settings, page }) => {
    await settings.goto();
    await settings.setWeightStep('plates', '2,5 kg');

    await page.reload();
    await expect(page.locator('#weightstep-plates')).toHaveValue('2.5-kg');
  });

  test('clear-all wipes user schemas', async ({ schemaEditor, schemas, settings }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E ClearMe');
    await schemaEditor.addExercise(A);
    await schemaEditor.save();

    await settings.goto();
    await settings.clearAll();

    await schemas.goto();
    await expect(schemas.card('E2E ClearMe')).toHaveCount(0);
  });
});
