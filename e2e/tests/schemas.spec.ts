import { test, expect } from '../fixtures/app';

const A = 'Barbell Bench Press';
const B = 'Barbell Row';

test.describe('Training schemas', () => {
  test('creates a schema and shows it in the list and detail', async ({ schemaEditor, schemas, page }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Full Body');
    await schemaEditor.addExercise(A);
    await schemaEditor.addExercise(B);
    await schemaEditor.save();

    // Landed on the detail page for the new schema.
    await expect(page.getByRole('heading', { name: 'E2E Full Body' })).toBeVisible();

    await schemas.goto();
    await expect(schemas.card('E2E Full Body')).toBeVisible();
  });

  test('copies a schema', async ({ schemaEditor, schemas }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Original');
    await schemaEditor.addExercise(A);
    await schemaEditor.save();

    await schemas.goto();
    await schemas.copy('E2E Original');
    // Copy opens in the editor; back on the list both exist.
    await schemas.goto();
    await expect(schemas.card('E2E Original')).toBeVisible();
    await expect(schemas.card('E2E Original (kopie)')).toBeVisible();
  });

  test('deletes a schema', async ({ schemaEditor, schemas }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Disposable');
    await schemaEditor.addExercise(A);
    await schemaEditor.save();

    await schemas.goto();
    await expect(schemas.card('E2E Disposable')).toBeVisible();
    await schemas.delete('E2E Disposable');
    await expect(schemas.card('E2E Disposable')).toHaveCount(0);
  });

  test('shares a schema and re-imports it, preserving the superset', async ({
    schemaEditor,
    schemaDetail,
    schemas,
    page,
  }) => {
    await schemaEditor.gotoNew();
    await schemaEditor.setName('E2E Shared');
    await schemaEditor.addExercise(A);
    await schemaEditor.addExercise(B);
    await schemaEditor.linkWithPrevious(B);
    await schemaEditor.save();

    const url = await schemaDetail.getShareUrl();
    expect(url).toContain('importSchema=');

    // Visiting the share URL offers to import the schema.
    await page.goto(url);
    await page.getByRole('button', { name: 'Importeren' }).click();
    await page.waitForURL(/\/schemas\/\d+$/);

    // A same-named import is de-duplicated with a "(geïmporteerd)" suffix.
    await expect(page.getByRole('heading', { name: 'E2E Shared (geïmporteerd)' })).toBeVisible();

    // Opening its editor shows the superset survived the round-trip.
    await schemaDetail.edit();
    await expect(schemaEditor.supersetGroups).toHaveCount(1);

    // Both the original and the import are listed.
    await schemas.goto();
    await expect(schemas.card('E2E Shared')).toBeVisible();
    await expect(schemas.card('E2E Shared (geïmporteerd)')).toBeVisible();
  });
});
