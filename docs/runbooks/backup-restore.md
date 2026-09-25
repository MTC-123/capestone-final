# Runbook: MongoDB backup & restore (RICER Ifrane)

## Why this runbook exists

The demo/production database runs on **MongoDB Atlas M0** (the free tier).
M0 clusters do not have continuous backups or point-in-time snapshots — the
only backup strategy available to us is doing it ourselves with
`mongodump`/`mongorestore`. This runbook covers the two scripts that do
that (`scripts/db/backup.sh`, `scripts/db/restore.sh`), how to verify a
restore, and the results of an actual rehearsal run against the local dev
database.

All commands below assume you're in `apps/web/` (the scripts live at
`apps/web/scripts/db/`).

## Scripts

### `scripts/db/backup.sh` — take a backup

```
scripts/db/backup.sh                        # backs up $DATABASE_URL
scripts/db/backup.sh "mongodb+srv://..."     # backs up an explicit URI (e.g. Atlas)
BACKUP_DIR=/some/path scripts/db/backup.sh   # custom output directory (default: apps/web/backups/)
```

It runs `mongodump --gzip --archive` and writes a single timestamped file:
`backups/ricer-backup-<UTC timestamp>.gz`.

- If `mongodump` is installed on your machine, it's used directly.
- Otherwise it falls back to `docker exec ricer-mongo mongodump` — the
  local dev container ships the MongoDB Database Tools, and this works
  equally well against the local replica set *or* a remote (Atlas) URI,
  since the container only needs outbound network access to reach it.

### `scripts/db/restore.sh` — restore a backup

```
scripts/db/restore.sh <archive.gz> [target] [--drop]
```

`[target]` is either a full Mongo URI, or a bare database name (which
restores into the local dev replica set as
`mongodb://localhost:27017/<name>?replicaSet=rs0&directConnection=true`).
Omit it to restore into `$DATABASE_URL`.

**Always pass `--drop`** unless you specifically want to merge into
existing data — it tells `mongorestore` to drop each collection before
restoring into it, so a restore is idempotent (re-running it gives you the
same end state, not duplicated documents).

```
scripts/db/restore.sh backups/ricer-backup-20260924T135547Z.gz ricer_restore_test --drop
scripts/db/restore.sh backups/ricer-backup-....gz "mongodb+srv://user:pass@cluster/ricer" --drop
```

Same local-binary-then-docker fallback as `backup.sh`.

**Implementation note (why it's not a one-line `mongorestore --uri=...`):**
an archive restore records the *source* database name in every namespace
(`<db>.<collection>`). If the target `--uri` also embeds a database name
that differs from the source (e.g. restoring `ricer` into
`ricer_restore_test`), `mongorestore` filters namespaces against the URI's
db name *before* applying any rename, silently restoring **zero**
documents. `restore.sh` avoids this by connecting with a database-less URI
and doing the rename purely through `--nsFrom="ricer.*" --nsTo="<target>.*"`
— confirmed against this project's own archives (see rehearsal below). If
your source database is ever named something other than `ricer`, set
`SOURCE_DB=<name>` before calling the script.

### `scripts/db/compare-counts.ts` — verify a restore

```
npx tsx scripts/db/compare-counts.ts <uriA> <uriB>
```

Prints a per-collection (per Prisma model) document count for both URIs
side by side and flags any mismatch. It uses two `PrismaClient` instances
pointed at the two URIs and calls `.count()` on every model in the schema
— no extra dependency needed, and it stays in sync with `schema.prisma`
automatically.

Exit code is `0` if every collection matches, `2` if any differ.

## Rehearsal — actually run, 2026-09-24

We backed up the seeded local dev database, restored it into a fresh
database on the same container, and compared counts, to prove the two
scripts actually work end to end (not just "should work").

```
$ ./scripts/db/backup.sh
Backing up: mongodb://localhost:27017/ricer?replicaSet=rs0&directConnection=true
Output:     apps/web/backups/ricer-backup-20260924T135547Z.gz
Local mongodump not found — using 'docker exec ricer-mongo mongodump'...
...
Backup complete: apps/web/backups/ricer-backup-20260924T135547Z.gz (40K)

$ ./scripts/db/restore.sh backups/ricer-backup-20260924T135547Z.gz ricer_restore_test --drop
Restoring:  .../backups/ricer-backup-20260924T135547Z.gz
Source db:  ricer
Target:     mongodb://localhost:27017/?replicaSet=rs0&directConnection=true (db: ricer_restore_test)
Mode:       --drop (existing collections in the target are dropped first)
Local mongorestore not found — using 'docker exec ricer-mongo mongorestore'...
...
272 document(s) restored successfully. 0 document(s) failed to restore.
Restore complete.

$ npx tsx scripts/db/compare-counts.ts \
    "mongodb://localhost:27017/ricer?replicaSet=rs0&directConnection=true" \
    "mongodb://localhost:27017/ricer_restore_test?replicaSet=rs0&directConnection=true"

Model                        A       B  Match
User                        11      11  OK
OfficialRequest              2       2  OK
AuditLog                    19      19  OK
NotificationDelivery        19      19  OK
RefreshToken                  0       0  OK
Report                      40      40  OK
Incident                    26      26  OK
Equipment                   18      18  OK
RetardantProduct             5       5  OK
Infrastructure               20      20  OK
Resource                      6       6  OK
RiskBasin                     0       0  OK
TruckDeployment                0       0  OK
Team                          9       9  OK
Dispatch                     11      11  OK
Vehicle                      15      15  OK
VehicleTelemetry               0       0  OK
FireEventRecord               19      19  OK
RouteCache                     0       0  OK
AgencyStatus                  7       7  OK
CommunicationLog              13      13  OK
POIActivation                  1       1  OK
ICSAssignment                  7       7  OK
MutualAidRequest               1       1  OK
PMAWorkflow                    0       0  OK
EquipmentAudit                 1       1  OK
Deployment                     0       0  OK
Campaign                       1       1  OK
PhaseChecklist                19      19  OK
Debriefing                     2       2  OK
Upload                         0       0  OK

All collections match.
```

**Result: pass.** All 30 collections matched exactly (272 total documents
in the 22 non-empty ones). The `ricer_restore_test` database was dropped
after the rehearsal (`db.getSiblingDB("ricer_restore_test").dropDatabase()`)
to leave the container clean.

## Recommended cadence

- **Before any risky operation** against the Atlas demo DB (schema
  migration, bulk edit, re-seed with `SEED_ALLOW_PRODUCTION=true`): take a
  backup first.
- **Ad hoc / before a demo**: a quick `./scripts/db/backup.sh` costs a few
  seconds and a few tens of KB at this data size.
- Backups are plain files (`backups/*.gz`) — copy them somewhere durable
  (e.g. a private cloud bucket, or just off your laptop) if they need to
  survive longer than your local disk. Consider adding `apps/web/backups/`
  to `.gitignore` so dump archives never end up in git history.

## Disaster-recovery drill (do this periodically, not just once)

1. `./scripts/db/backup.sh "$ATLAS_URI"` (or the local URI, for a dry run).
2. `./scripts/db/restore.sh <archive> ricer_restore_test --drop` against the
   local dev container (never restore-test directly into Atlas).
3. `npx tsx scripts/db/compare-counts.ts "$ATLAS_URI" "mongodb://localhost:27017/ricer_restore_test?replicaSet=rs0&directConnection=true"`
   and confirm "All collections match."
4. Drop `ricer_restore_test` when done.

If step 3 ever reports a mismatch, do not assume the backup is fine —
investigate before you need it for real.
