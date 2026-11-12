/**
 * BISVEDA — PostgreSQL client (ARCHITECTURE.md §2, §8).
 *
 * One pg Pool per process. Kept on globalThis so Next.js dev hot-reloads
 * don't open a new pool on every module reload.
 * DATABASE_URL defaults to the local docker-compose database (dev only).
 */

import { Pool, type PoolClient, type QueryResultRow } from "pg";

export const DEFAULT_DATABASE_URL = "postgres://bisveda:bisveda_dev@127.0.0.1:5432/bisveda";

const globalForDb = globalThis as unknown as { __bisvedaPool?: Pool };

export function getPool(): Pool {
  if (!globalForDb.__bisvedaPool) {
    globalForDb.__bisvedaPool = new Pool({
      connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
    });
    globalForDb.__bisvedaPool.on("error", (err) => {
      console.error("[db] idle client error:", err.message);
    });
  }
  return globalForDb.__bisvedaPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query<T>(sql, params);
  return res.rows;
}

/** Runs fn inside BEGIN/COMMIT; rolls back and rethrows on any error. */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (globalForDb.__bisvedaPool) {
    await globalForDb.__bisvedaPool.end();
    globalForDb.__bisvedaPool = undefined;
  }
}

/** pgvector literal for a JS number array. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

/** Parses pgvector's text output ("[0.1,0.2,...]") back to numbers. */
export function parseVector(s: string | null): number[] | null {
  if (!s) return null;
  return s.slice(1, -1).split(",").map(Number);
}
