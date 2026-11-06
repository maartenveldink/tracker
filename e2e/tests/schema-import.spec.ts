import { test, expect } from '../fixtures/app';

test.describe('Schema JSON import', () => {
  test('imports a valid multi-day schema from pasted JSON (with superset and rotation)', async ({
    schemas,
    schemaImport,
    schemaEditor,
    schemaDetail,
    page,
  }) => {
    // Entry point from the schema list.
    await schemas.goto();
    await page.getByRole('link', { name: 'Importeer schema' }).click();
    await expect(page).toHaveURL(/\/schemas\/import$/);

    await schemaImport.paste({
      name: 'E2E Coach Split',
      days: [
        {
          name: 'Push',
          exercises: [
            { exercise: 'barbell bench press', sets: 3, reps: 8, repsMax: 12, startWeight: 60, restSeconds: 90 },
            { exercise: 'Overhead Press', sets: 3, reps: 10, supersetGroup: 'A', reason: 'schouders achter' },
            { exercise: 'Barbell Row', sets: 3, reps: 10, supersetGroup: 'A' },
          ],
        },
        { name: 'Pull', exercises: [{ exercise: 'Barbell Row', sets: 4, reps: 8 }] },
      ],
      rotation: ['Push', 'Pull', 'Push'],
    });

    // Summary: name, counts, prescription; no errors, nothing unknown.
    await expect(schemaImport.errors).toHaveCount(0);
    await expect(schemaImport.summary).toContainText('E2E Coach Split');
    await expect(schemaImport.summary).toContainText('2 dagen · 4 oefeningen');
    await expect(schemaImport.summary).toContainText('3×8–12 · 60 kg · rust 90 s');
    await expect(schemaImport.unknownNote).toHaveCount(0);

    await schemaImport.importAndConfirm();
    await expect(page.getByRole('heading', { name: 'E2E Coach Split' })).toBeVisible();

    // Same confirmation + result as a share-link import: shows up in the list,
    // case-insensitive name matching reused the library exercise, superset kept.
    await schemas.goto();
    await expect(schemas.card('E2E Coach Split')).toBeVisible();
    await schemas.open('E2E Coach Split');
    await schemaDetail.edit();
    await expect(schemaEditor.supersetGroups).toHaveCount(1);
  });

  test('shows every validation error with its path and blocks the import', async ({ schemaImport }) => {
    await schemaImport.goto();

    await schemaImport.paste('{ dit is geen json');
    await expect(schemaImport.errors).toContainText('geen geldige JSON');
    await expect(schemaImport.importButton).toHaveCount(0);

    await schemaImport.paste({
      name: '',
      exercises: [
        { exercise: 'Barbell Row', sets: 0, reps: 8 },
        { exercise: 'Overhead Press', sets: 3, reps: 10, repsMax: 6 },
        { sets: 3, reps: '8' },
      ],
    });
    await expect(schemaImport.errors).toContainText('name: ');
    await expect(schemaImport.errors).toContainText('exercises[0].sets: moet tussen 1 en 20');
    await expect(schemaImport.errors).toContainText('exercises[1].repsMax: moet minimaal gelijk zijn aan reps (10)');
    await expect(schemaImport.errors).toContainText('exercises[2].exercise: ontbreekt');
    await expect(schemaImport.errors).toContainText('exercises[2].reps: moet een getal zijn');
    await expect(schemaImport.summary).toHaveCount(0);
    await expect(schemaImport.importButton).toHaveCount(0);

    // Neither days nor exercises, and a rotation naming a missing day.
    await schemaImport.paste({ name: 'X', days: [{ name: 'A', exercises: [{ exercise: 'Barbell Row', sets: 3, reps: 8 }] }], rotation: ['B'] });
    await expect(schemaImport.errors).toContainText('rotation[0]: "B" is geen dag in "days"');
  });

  test('flags unknown exercises as new and creates them on import', async ({ schemaImport, exercises, page }) => {
    await schemaImport.goto();
    await schemaImport.paste({
      name: 'E2E Unknown',
      exercises: [
        { exercise: 'Barbell Row', sets: 3, reps: 8 },
        { exercise: 'Zercher Squat Deluxe', sets: 3, reps: 5 },
        { exercise: 'Brandnew Widget Curl', sets: 2, reps: 12, foo: 1 },
      ],
    });
    await expect(schemaImport.unknownNote).toContainText('2 oefeningen bestaan nog niet');
    await expect(schemaImport.summary.getByText('nieuw', { exact: true })).toHaveCount(2);
    // Unknown fields are non-blocking warnings.
    await expect(schemaImport.warnings).toContainText('exercises[2].foo: onbekend veld');

    await schemaImport.importAndConfirm();
    await expect(page.getByText('Zercher Squat Deluxe').first()).toBeVisible();

    await exercises.goto();
    await expect(exercises.card('Zercher Squat Deluxe')).toBeVisible();
    await expect(exercises.card('Brandnew Widget Curl')).toBeVisible();
  });

  test('accepts a fenced file upload and the compact share format (v: 1)', async ({ schemaImport, page }) => {
    await schemaImport.goto();

    // AI answers often come wrapped in a markdown code fence.
    const fenced = '```json\n' + JSON.stringify({ name: 'E2E Fenced', exercises: [{ exercise: 'Barbell Row', sets: 3, reps: 8 }] }) + '\n```';
    await schemaImport.chooseFile('schema.json', fenced);
    await expect(schemaImport.input).toHaveValue(fenced);
    await expect(schemaImport.summary).toContainText('E2E Fenced');

    // Compact format as produced by share links.
    await schemaImport.paste({ v: 1, name: 'E2E Compact', exercises: [{ n: 'Barbell Row', s: 4, r: 6, rm: 8, w: 70, rs: 120 }] });
    await expect(schemaImport.errors).toHaveCount(0);
    await expect(schemaImport.summary).toContainText('E2E Compact');
    await expect(schemaImport.summary).toContainText('4×6–8 · 70 kg · rust 120 s');

    await schemaImport.importAndConfirm();
    await expect(page.getByRole('heading', { name: 'E2E Compact' })).toBeVisible();
  });
});
