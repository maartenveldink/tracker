/// <reference path="../pb_data/types.d.ts" />

// Tracker multi-user schema (see docs/design.multi-user-sync.md).
//
// Creates the seven per-user data collections and configures the built-in
// `users` auth collection for username/password login without SMTP. Each data
// collection stores the whole Dexie document as a JSON `data` field plus the
// sync metadata the client reconciles on (`clientUpdatedAt`, `deleted`) and a
// `user` relation for per-user isolation via API rules.
//
// This file is auto-applied on `serve`/`migrate up`. It is safe to commit and is
// the reproducible source of truth for the schema (requirement A-08).

migrate(
  (app) => {
    // --- Auth: configure the built-in `users` collection ---------------------
    const users = app.findCollectionByNameOrId('users');

    // Login on username (no e-mail required, no verification e-mail → no SMTP).
    users.passwordAuth.enabled = true;
    users.passwordAuth.identityFields = ['username'];
    // OTP / e-mail verification stay off so the server needs no mailer.
    if (users.otp) users.otp.enabled = false;
    app.save(users);

    const usersId = users.id;

    // Per-user access: a signed-in user may only touch their own rows.
    const ownerRule = "@request.auth.id != '' && user = @request.auth.id";

    // Every data collection shares the same shape.
    const dataCollections = [
      'exercises',
      'schemas',
      'workouts',
      'body_weights',
      'habits',
      'habit_logs',
      'settings',
    ];

    for (const name of dataCollections) {
      const collection = new Collection({
        type: 'base',
        name,
        listRule: ownerRule,
        viewRule: ownerRule,
        createRule: ownerRule,
        updateRule: ownerRule,
        deleteRule: ownerRule,
        fields: [
          {
            type: 'relation',
            name: 'user',
            required: true,
            collectionId: usersId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          // The full Dexie document (nested exercises/sets/days/rotation, etc.).
          { type: 'json', name: 'data', required: true, maxSize: 2000000 },
          // Last local write time (epoch ms) — basis for last-write-wins.
          { type: 'number', name: 'clientUpdatedAt', required: true },
          // Tombstone flag so deletions propagate on sync.
          { type: 'bool', name: 'deleted' },
        ],
        // `settings` is one row per user; enforce it. The pull cursor filters on
        // the built-in `updated` autodate, which is indexed by default.
        indexes:
          name === 'settings'
            ? [`CREATE UNIQUE INDEX \`idx_${name}_user\` ON \`${name}\` (\`user\`)`]
            : [`CREATE INDEX \`idx_${name}_user\` ON \`${name}\` (\`user\`)`],
      });
      app.save(collection);
    }
  },
  (app) => {
    // Down: drop the data collections (leave the built-in users collection).
    for (const name of [
      'exercises',
      'schemas',
      'workouts',
      'body_weights',
      'habits',
      'habit_logs',
      'settings',
    ]) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {
        // already gone
      }
    }
  },
);
