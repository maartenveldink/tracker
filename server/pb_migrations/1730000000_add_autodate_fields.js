/// <reference path="../pb_data/types.d.ts" />

// PocketBase >= 0.23 no longer adds `created`/`updated` to collections created from
// code. The sync engine pulls with `sort=updated` and `updated > cursor`, so without
// the field every pull is a 400. This adds the two autodate fields to the data
// collections (idempotent) and backfills existing rows so they are picked up on the
// next pull.

migrate(
  (app) => {
    const names = [
      'exercises',
      'schemas',
      'workouts',
      'body_weights',
      'habits',
      'habit_logs',
      'settings',
    ];
    const now = new DateTime().string();

    for (const name of names) {
      const collection = app.findCollectionByNameOrId(name);
      let changed = false;

      if (!collection.fields.getByName('created')) {
        collection.fields.add(new AutodateField({ name: 'created', onCreate: true }));
        changed = true;
      }
      if (!collection.fields.getByName('updated')) {
        collection.fields.add(
          new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }),
        );
        changed = true;
      }
      if (!changed) continue;

      app.save(collection);
      app
        .db()
        .newQuery(
          'UPDATE {{' + name + "}} SET created = {:now}, updated = {:now} WHERE updated = '' OR updated IS NULL",
        )
        .bind({ now: now })
        .execute();
    }
  },
  () => {
    // Intentionally a no-op: dropping the fields would break sync.
  },
);
