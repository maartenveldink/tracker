/// <reference path="../pb_data/types.d.ts" />

// Closed sign-up: the first account can register itself through the app; after
// that, new accounts are refused unless TRACKER_ALLOW_SIGNUP=true is set (or a
// superuser creates the account in the admin UI). Personal app, one user for now.
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) {
    return e.next();
  }
  const existing = $app.countRecords("users");
  if (existing > 0 && $os.getenv("TRACKER_ALLOW_SIGNUP") !== "true") {
    throw new ForbiddenError("Registratie is gesloten.");
  }
  return e.next();
}, "users");
