# Migrating off `@apibara/plugin-drizzle`

A guide for moving an Apibara indexer from `@apibara/plugin-drizzle` to vanilla
`drizzle-orm` with manual cursor management. Based on what worked (and what bit
us) in the governance indexer migration.

## Why migrate

The plugin gives you four things:

1. **Cursor persistence** — `airfoil.checkpoints` table read on connect, written each block.
2. **Reorg rollback** — Postgres deferred constraint triggers record every INSERT/UPDATE/DELETE on tracked tables; on `message:invalidate` the rollback is replayed.
3. **Drizzle-kit migrations** runner.
4. **Per-block transactions**.

For most indexers that handle finalized-ish data and don't display
pre-accepted state, (2) and (3) aren't pulling their weight, and (2) actively
causes problems:

- The `airfoil.reorg_rollback` table grows unboundedly when `message:finalize`
  rarely fires (which is the case under `finality: "accepted"`). We had ~4700
  rows in production over a few thousand blocks.
- The deferred constraint triggers on every user table interact poorly with
  the user's own `DELETE`/`INSERT` patterns. We hit a deterministic
  `blocks_pkey` dup-key crash whenever the indexer tried to re-process a block
  whose row already existed — even though a manual `psql`
  `DELETE`-then-`INSERT` worked fine. The exact MVCC interaction was never
  proven, but dropping the airfoil schema made it disappear.

## Pre-migration checklist

1. **Take a database backup** (Railway → Postgres → Backups → "Backup Now",
   or `pg_dump`). Don't skip this.
2. **Confirm finality choice.** If you really need pre-accepted streaming
   with auto-rollback, the plugin may still be the better fit. Otherwise pick
   `accepted` or `finalized`.
3. **Locate every running instance** of the indexer (Railway services, local
   dev terminals, CI workers). Two instances writing to the same DB through
   the migration is the worst case.

## Schema changes

Add a single cursor table:

```ts
// src/lib/schema.ts
export const indexerCursor = pgTable("indexer_cursor", {
  id: text("id").primaryKey(),
  orderKey: bigint("order_key", { mode: "bigint" }).notNull(),
  uniqueKey: text("unique_key"),
});
```

`uniqueKey` is the block hash Apibara uses to detect reorgs; nullable because
it's optional in the protocol.

## Code changes

Replace `@apibara/plugin-drizzle` imports with vanilla drizzle:

```ts
// before
import { drizzle, drizzleStorage, useDrizzleStorage } from "@apibara/plugin-drizzle";

// after
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
```

Set up the connection without the plugin:

```ts
const pool = new Pool({ connectionString: databaseUrl });
const database = drizzle(pool, { schema });
```

Drop the entire `plugins: [drizzleStorage(...)]` block.

Wrap the transform body in a transaction and write the cursor in the same
transaction so data and progress advance atomically:

```ts
async transform({ block, endCursor }) {
  if (!block.header) return;
  const blockNumber = Number(block.header.blockNumber);

  await database.transaction(async (db) => {
    // Re-processing safety: clear this block's row before inserting fresh.
    // FK CASCADE through event_keys removes dependent event-table rows.
    await db.delete(schema.blocks).where(eq(schema.blocks.number, blockNumber));

    await db.insert(schema.blocks).values({
      number: blockNumber,
      hash: BigInt(block.header.blockHash ?? 0).toString(),
      time: block.header.timestamp,
    });

    // ... process block.events here, all using `db` ...

    if (endCursor) {
      await db.insert(schema.indexerCursor).values({
        id: CURSOR_ID,
        orderKey: endCursor.orderKey,
        uniqueKey: endCursor.uniqueKey ?? null,
      }).onConflictDoUpdate({
        target: schema.indexerCursor.id,
        set: {
          orderKey: endCursor.orderKey,
          uniqueKey: endCursor.uniqueKey ?? null,
        },
      });
    }
  });
},
```

Add two hooks:

```ts
hooks: {
  // Resume from the persisted cursor on every connect.
  "connect:before": async ({ request }) => {
    const [row] = await database
      .select()
      .from(schema.indexerCursor)
      .where(eq(schema.indexerCursor.id, CURSOR_ID))
      .limit(1);
    if (row) {
      request.startingCursor = {
        orderKey: row.orderKey,
        uniqueKey: (row.uniqueKey ?? undefined) as `0x${string}` | undefined,
      };
    }
  },
  // Reorg handling: when DNA tells us to roll back, drop everything past the
  // new cursor. ON DELETE CASCADE on event_keys.<block_number> removes
  // dependent event-table rows. Reset our cursor in the same transaction.
  "message:invalidate": async ({ message }) => {
    const cursor = message.cursor;
    if (!cursor) return;
    const cursorOrderKey = Number(cursor.orderKey);
    await database.transaction(async (db) => {
      await db.delete(schema.blocks).where(gt(schema.blocks.number, cursorOrderKey));
      await db
        .update(schema.indexerCursor)
        .set({ orderKey: cursor.orderKey, uniqueKey: cursor.uniqueKey ?? null })
        .where(eq(schema.indexerCursor.id, CURSOR_ID));
    });
  },
},
```

**Note on hooks:** pass them via the `hooks` field of the `defineIndexer`
config object, **not** by calling `idx.hooks.hook(...)` on the returned
indexer — the returned object exposes `hooks` as a config type, not a
`Hookable` instance.

## Migration SQL

`drizzle-kit generate` will produce the `CREATE TABLE indexer_cursor`
migration. Append a conditional seed so existing deployments preserve their
indexing progress:

```sql
CREATE TABLE "indexer_cursor" (
  "id" text PRIMARY KEY NOT NULL,
  "order_key" bigint NOT NULL,
  "unique_key" text
);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'airfoil' AND table_name = 'checkpoints'
  ) THEN
    INSERT INTO "indexer_cursor" ("id", "order_key", "unique_key")
    SELECT '<your_indexer_id>', "order_key", "unique_key"
    FROM "airfoil"."checkpoints"
    WHERE "id" = 'indexer_<your_indexer_name>_<your_indexer_name>'
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;
```

The `DO` block makes the seed idempotent and safe on fresh installs (no
airfoil schema = nothing happens).

The legacy `airfoil.checkpoints.id` is `indexer_<indexerName>_<identifier>` —
for the governance case both were `governance`, giving
`indexer_governance_governance`. Yours may differ.

## Operational scripts to remove

If you had any of these patterns to work around plugin-drizzle quirks, drop
them after the migration:

- A `cleanup-triggers.ts` script that drops `<table>_reorg_indexer_*` triggers on startup.
- A `start-with-retry` wrapper that detects "already exists" errors and retries.
- A `RUN npx drizzle-kit generate` step in your Dockerfile (migrations should be committed).

## Deploy ordering

1. Merge the PR. Migration runs on next start, creates `indexer_cursor`,
   seeds from `airfoil.checkpoints` if present.
2. New indexer starts, reads cursor, resumes streaming. Watch for:
   - `indexer_cursor` has a row.
   - `order_key` advances on every new block.
   - No errors in the indexer's stdout or Postgres logs.
3. Once you've verified stability for some hours/days, run the airfoil drop:

```sql
-- scripts/drop-airfoil.sql
DROP SCHEMA IF EXISTS airfoil CASCADE;
```

This is the destructive step — it removes the rollback table, function, and
all reorg constraint triggers. Run only after you're confident in step 2.

## Pitfalls we hit

These are listed roughly in the order we tripped over them. Watch for them on
other stacks.

### 1. Wrong env-var name for the stream URL

Existing Railway envs commonly have `APIBARA_URL` (legacy from older indexer
configs). The new SDK reads `STREAM_URL`. Result: the indexer silently falls
back to the public `https://mainnet.starknet.a5a.ch` endpoint, whose
unreliable heartbeats trigger a 45-second `No message received` stream
timeout in a tight restart loop.

**Fix:** make `apibara.config.ts` accept both:

```ts
streamUrl: (process.env.STREAM_URL ?? process.env.APIBARA_URL ?? "https://mainnet.starknet.a5a.ch").trim(),
```

### 2. `railway.toml` healthcheck on a worker

A `[deploy] healthcheckPath = "/"` in `railway.toml` will never pass for an
indexer (no HTTP server). Failed healthchecks → deploys marked FAILED →
previous container keeps running → your code change never goes live.

**Fix:** remove `healthcheckPath` and `healthcheckTimeout` from `railway.toml`
for indexer-only services. If an API service shares the same `railway.toml`,
give it its own per-service config or use the Railway dashboard to set
healthcheck per-service.

### 3. Pre-existing block rows + leftover reorg triggers

Even after the new code is running, the triggers from
`@apibara/plugin-drizzle` are still installed on your data tables until you
drop the airfoil schema. The trigger function returns `NULL` when its session
var isn't set (the new code doesn't set it), so it should be a no-op.

**But:** when the new code's `transform` `DELETE`-then-`INSERT`s a block
whose row pre-existed (a re-processed block immediately after the
migration), the `INSERT` deterministically failed with `blocks_pkey`. A
manual `psql` `DELETE+INSERT` of the same row succeeded. **The mechanism
remains unproven** — likely an MVCC interaction between drizzle's transaction
handling and the deferred constraint triggers, but couldn't isolate it.

**Workaround:**

- Drop the airfoil schema (`DROP SCHEMA airfoil CASCADE`) — removes triggers and rollback infra.
- Bump the cursor in `indexer_cursor` past the latest existing block before
  restarting, so the indexer streams *new* blocks (no DELETE-then-INSERT
  collision possibility). Set `unique_key = NULL` if you don't have the hex
  form of the chain hash handy; Apibara accepts that.

If you migrate cleanly (cursor seeded, then the airfoil drop happens before
the new code re-processes any pre-existing block), you may not hit this. We
hit it because the new container started writing while we were still
investigating. Order matters: **drop airfoil before the first transform call
against an existing-row block.**

### 4. `unique_key` value format

`indexer_cursor.unique_key` is plain text but the apibara `Cursor.uniqueKey`
type is `Bytes` = `0x${string}`. If you're seeding from another source (e.g.,
a `numeric`-typed hash column), convert to the hex form first or set NULL. A
decimal-encoded numeric will not match the chain's expected hash and Apibara
will treat the cursor as invalid.

### 5. Lockfile drift

Apibara packages are typically pinned to the `next` dist-tag in
`package.json` (`"apibara": "next"`). With `npm install` in the Dockerfile,
the lockfile gets regenerated on each build and you can pick up new `next`
versions silently. Switch to `npm ci` in the Dockerfile to enforce the
committed lockfile.

## Verification queries

After deploy, sanity-check with:

```sql
-- Cursor seeded and advancing
SELECT * FROM indexer_cursor;

-- Latest block is recent
SELECT MAX(number), MAX(time) FROM blocks;

-- Airfoil bloat is gone (after drop)
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'airfoil';
SELECT COUNT(*) FROM information_schema.triggers
WHERE trigger_name LIKE '%_reorg_indexer_%';

-- No active connections from rogue old plugin instances
SELECT pid, application_name, client_addr, query
FROM pg_stat_activity
WHERE datname = current_database() AND pid <> pg_backend_pid();
```

## Reference: governance indexer migration

The governance indexer migration is in PR #6 of this repo. See:

- `indexer/indexers/governance.indexer.ts` — final transform shape.
- `indexer/src/lib/schema.ts` — `indexerCursor` definition.
- `indexer/migrations/0001_remove_drizzle_storage_plugin.sql` — schema migration with cursor seed.
- `indexer/scripts/drop-airfoil.sql` — manual cleanup script.
