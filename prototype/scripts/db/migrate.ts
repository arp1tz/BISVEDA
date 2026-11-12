/**
 * BISVEDA — apply SQL migrations in db/migrations in name order (R1.1).
 * Each file runs in its own transaction and is recorded in schema_migrations.
 *
 * Usage (from prototype/):
 *   npm run db:migrate
 *   npm run db:reset -- --yes     DROP everything in schema public, then migrate (dev only)
 */

import fs from "fs";
import path from "path";
import { loadEnv } from "../kb/env";
loadEnv();
import { getPool, closePool } from "../../src/lib/db/client";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../db/migrations");

async function main() {
  const reset = process.argv.includes("--reset");
  const pool = getPool();

  if (reset) {
    if (!process.argv.includes("--yes")) {
      console.error("Refusing to reset without --yes (this deletes all data in the database).");
      process.exit(1);
    }
    const url = process.env.DATABASE_URL || "";
    if (url && !/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
      console.error("Refusing to reset a non-local database.");
      process.exit(1);
    }
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    console.log("Schema public dropped and recreated.");
  }

  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const applied = new Set((await pool.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`applied ${file}`);
      count++;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`FAILED ${file}: ${(err as Error).message}`);
      process.exitCode = 1;
      break;
    } finally {
      client.release();
    }
  }
  if (count === 0 && !process.exitCode) console.log("Database is up to date.");
  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  await closePool();
  process.exit(1);
});
