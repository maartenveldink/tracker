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

  test('persists the muscle detail level across a reload', async ({ settings, page }) => {
    await settings.goto();
    await page.locator('#muscle-detail').click(); // switch to "detailed"

    await page.reload();
    await expect(page.locator('#muscle-detail')).toBeChecked();
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

  test('exports data and re-imports it after a wipe', async ({ schemaEditor, schemas, settings, page }, testInfo) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Backup');
    await schemaEditor.addExercise(A);
    await schemaEditor.save();

    // Export → capture the downloaded JSON.
    await settings.goto();
    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exporteer data' }).click(),
    ]).then(([d]) => d);
    const file = testInfo.outputPath('tracker-export.json');
    await download.saveAs(file);

    // Wipe everything.
    await settings.clearAll();
    await schemas.goto();
    await expect(schemas.card('E2E Backup')).toHaveCount(0);

    // Import the file (replace mode) → the schema is restored.
    await settings.goto();
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.getByRole('button', { name: /Vervangen/ }).click();
    await page.getByRole('button', { name: 'Sluiten' }).click();

    await schemas.goto();
    await expect(schemas.card('E2E Backup')).toBeVisible();
  });
});
