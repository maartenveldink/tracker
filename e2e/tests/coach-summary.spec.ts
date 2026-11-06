import { test, expect } from '../fixtures/app';
import { extractSummary } from '../pages/CoachCopyPage';
import { seedTraining, type SeedWorkout } from '../fixtures/seedTraining';

const bench = (reps: number[], weight: number, extra: Partial<SeedWorkout['exercises'][number]> = {}) => ({
  name: 'Barbell Bench Press',
  sets: reps.map(r => ({ reps: r, weight, plannedReps: 8, plannedRepsMax: 12 })),
  ...extra,
});

test.describe('Claude coach — summary copy', () => {
  // Extra seeding for individual tests (kept out of the base data set).
  let extra: Parameters<typeof seedTraining>[1] = { workouts: [] };
  test.beforeEach(async ({ schemaImport, page }, testInfo) => {
    if (testInfo.title.includes('unilateral')) {
      extra = {
        workouts: [
          {
            daysAgo: 2,
            exercises: [
              // 3 planned sets logged per side = 6 entries; the same exercise twice in one workout.
              {
                name: 'Bulgarian Split Squat',
                sets: [1, 2, 3].flatMap(() => [
                  { reps: 10, weight: 20, side: 'left' as const },
                  { reps: 10, weight: 20, side: 'right' as const },
                ]),
              },
              { name: 'Lateral Raise', sets: [{ reps: 15, weight: 8 }, { reps: 15, weight: 8 }] },
              { name: 'Lateral Raise', sets: [{ reps: 12, weight: 8 }] },
              { name: 'Hip Abduction', sets: [{ reps: 15, weight: 30 }] },
            ],
          },
        ],
        deletedExercises: ['Hip Abduction'],
      };
    } else {
      extra = { workouts: [] };
    }
    // The schema under discussion.
    await schemaImport.goto();
    await schemaImport.paste({
      name: 'Coach Test',
      days: [
        {
          name: 'Push',
          exercises: [
            { exercise: 'Barbell Bench Press', sets: 3, reps: 8, repsMax: 12, startWeight: 60 },
            { exercise: 'Pull-up', sets: 3, reps: 6 },
          ],
        },
      ],
    });
    await schemaImport.importAndConfirm();

    await seedTraining(page, {
      deletedExercises: extra.deletedExercises,
      workouts: [
        ...extra.workouts,
        // Outside the 4-week window, inside 8 weeks.
        { daysAgo: 40, dayName: 'Push', exercises: [bench([5, 5, 5], 50)] },
        {
          daysAgo: 25,
          dayName: 'Push',
          notes: 'Moe, slecht geslapen',
          exercises: [
            bench([8, 8, 7], 60),
            // Bodyweight sets: no weight at all.
            { name: 'Pull-up', sets: [6, 5, 5].map(r => ({ reps: r, weight: null })) },
          ],
        },
        {
          daysAgo: 18,
          dayName: 'Push',
          exercises: [
            {
              name: 'Barbell Bench Press',
              sets: [
                { reps: 10, weight: 60, plannedReps: 8, plannedRepsMax: 12 },
                { reps: 9, weight: 60, plannedReps: 8, plannedRepsMax: 12 },
                { reps: 8, weight: 60, plannedReps: 8, plannedRepsMax: 12 },
                { reps: 0, weight: null, skipped: true, plannedReps: 8, plannedRepsMax: 12 },
              ],
            },
          ],
        },
        { daysAgo: 11, dayName: 'Push', exercises: [bench([10, 10, 10], 65)] },
        {
          daysAgo: 4,
          dayName: 'Push',
          exercises: [bench([12, 10, 9], 65, { notes: 'Schouder deed pijn bij de laatste set' })],
        },
      ],
      bodyWeights: [
        { daysAgo: 45, kg: 82 },
        { daysAgo: 27, kg: 80 },
        { daysAgo: 3, kg: 78.5 },
      ],
    });
    await page.reload();
  });

  test('copies prompt, JSON Schema and a compact summary of the chosen period', async ({
    schemas,
    coachCopy,
  }) => {
    await schemas.goto();
    await schemas.open('Coach Test');
    await expect(coachCopy.section).toBeVisible();

    await coachCopy.goal.fill('Meer rug, knie-vriendelijk');
    const prompt = await coachCopy.copy();

    // Prompt: Dutch instructions, asks for JSON only to paste back at the import screen,
    // preferring existing names + a reason per change; includes the goal and JSON Schema.
    expect(prompt).toContain('Analyseer in het Nederlands');
    expect(prompt).toContain('bij voorkeur exact de namen uit "existingExercises"');
    expect(prompt).toContain('"reason"');
    expect(prompt).toContain('Importeer schema');
    expect(prompt).toContain('Meer rug, knie-vriendelijk');
    expect(prompt).toContain('https://tracker.local/schema-format.json');

    const { json: s, raw } = extractSummary(prompt);
    expect(s.period).toMatchObject({ weeks: 4, sessions: 4 });
    expect(s.frequency).toMatchObject({ sessionsPerWeek: 1, perWeek: [1, 1, 1, 1], weeksWithoutSession: 0 });
    expect(s.frequency.byDay).toEqual({ Push: 4 });

    // Per exercise: 1RM trend, rep range reached vs target, skipped sets, weekly weight/volume.
    const benchEx = s.exercises.find(e => e.name === 'Barbell Bench Press')!;
    expect(benchEx.sessions).toBe(4);
    expect(benchEx.e1rm).toEqual({ startKg: 76, endKg: 91, changePct: 19.7 });
    expect(benchEx.setsDone).toBe(12);
    expect(benchEx.setsSkipped).toBe(1);
    expect(benchEx.perSession.map(p => p.reps)).toEqual(['7-8', '8-10', '10', '9-12']);
    expect(benchEx.perSession[1]).toMatchObject({ week: 2, sets: 3, skippedSets: 1, target: '8-12' });
    expect(benchEx.perWeek[0]).toEqual({ week: 1, avgKg: 60, volumeKg: 1380, totalReps: 23 });
    expect(benchEx.perWeek[3]).toMatchObject({ week: 4, avgKg: 65 });

    // Bodyweight sets don't crash or yield NaN: no 1RM/average weight, reps still counted.
    const pullUp = s.exercises.find(e => e.name === 'Pull-up')!;
    expect(pullUp.e1rm).toBeNull();
    expect(pullUp.perWeek).toEqual([{ week: 1, avgKg: null, volumeKg: 0, totalReps: 16 }]);
    expect(raw).not.toContain('NaN');

    // Muscles: trained vs undertrained; body weight; notes; schema; library.
    expect(s.muscles.find(m => m.muscle === 'Borst')?.sets).toBeGreaterThanOrEqual(12);
    expect(s.undertrained).toContainEqual({ muscle: 'Kuiten', setsPerWeek: 0 });
    expect(s.bodyWeight).toEqual({ entries: 2, startKg: 80, endKg: 78.5, changeKg: -1.5 });
    expect(s.notes.sessions).toEqual([{ week: 1, day: 'Push', text: 'Moe, slecht geslapen' }]);
    expect(s.notes.exercises).toEqual([
      { week: 4, exercise: 'Barbell Bench Press', text: 'Schouder deed pijn bij de laatste set' },
    ]);
    expect(s.currentSchema?.name).toBe('Coach Test');
    expect(s.existingExercises).toContain('Barbell Bench Press');

    // Privacy: no raw sets, no ids, no dates in the summary.
    expect(raw).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(raw).not.toMatch(/seed0{3}/);
    expect(raw).not.toMatch(/[a-z0-9]{15}/); // no record ids
    expect(raw).not.toContain('actualReps');
    expect(raw.length).toBeLessThan(12_000);

    // The period choice widens the window: 8 weeks includes the older session + weigh-in.
    await coachCopy.period(8).click();
    const wide = extractSummary(await coachCopy.copy()).json;
    expect(wide.period).toMatchObject({ weeks: 8, sessions: 5 });
    expect(wide.frequency.perWeek).toHaveLength(8);
    expect(wide.bodyWeight).toMatchObject({ entries: 3, startKg: 82, changeKg: -3.5 });
    expect(JSON.stringify(wide).length).toBeLessThan(16_000);
  });

  test('counts unilateral pairs once, merges a repeated exercise and keeps deleted exercises', async ({
    schemas,
    coachCopy,
  }) => {
    await schemas.goto();
    await schemas.open('Coach Test');
    const s = extractSummary(await coachCopy.copy()).json;

    // 3 planned sets, logged as 6 left/right entries, count as 3.
    const split = s.exercises.find(e => e.name === 'Bulgarian Split Squat')!;
    expect(split.setsDone).toBe(3);
    expect(split.perSession).toEqual([{ week: 4, sets: 3, skippedSets: 0, reps: '10', target: null }]);

    // The same exercise twice in one workout is one session with merged sets.
    const raise = s.exercises.find(e => e.name === 'Lateral Raise')!;
    expect(raise.sessions).toBe(1);
    expect(raise.setsDone).toBe(3);
    expect(raise.perSession).toHaveLength(1);

    // A deleted exercise keeps counting in the history but is not offered as an existing name.
    expect(s.exercises.map(e => e.name)).toContain('Hip Abduction');
    expect(s.existingExercises).not.toContain('Hip Abduction');
    expect(s.existingExercises).toContain('Lateral Raise');
  });

  test('shows the exact copied text in a collapsible preview', async ({ schemas, coachCopy }) => {
    await schemas.goto();
    await schemas.open('Coach Test');

    await expect(coachCopy.preview.getByLabel('Gekopieerde tekst')).toBeHidden();
    const preview = await coachCopy.previewText();
    expect(extractSummary(preview).json.period.sessions).toBe(4);

    expect(await coachCopy.copy()).toBe(preview);
  });
});
