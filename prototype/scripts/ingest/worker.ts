/**
 * BISVEDA — ingestion worker (R2.2, ARCHITECTURE.md §6).
 *
 *   npm run worker:ingest            poll the queue forever
 *   npm run worker:ingest -- --once  process at most one job, then exit
 *
 * Claims one queued job at a time with FOR UPDATE SKIP LOCKED, so several
 * workers can run side by side. Slice 1 has no parser yet: a claimed job is
 * logged and marked failed with an explicit reason, so nothing is ever shown
 * as indexed before the pipeline exists.
 */

import { closePool, getPool, query } from "../../src/lib/db/client";

const POLL_MS = 2000;
const once = process.argv.includes("--once");

interface ClaimedJob {
  id: string;
  version_id: string;
  attempts: number;
}

async function log(jobId: string, level: "info" | "error", step: string, message: string) {
  console.log(`[worker] ${level} ${step}: ${message}`);
  await query(`INSERT INTO job_logs (job_id, level, step, message) VALUES ($1, $2, $3, $4)`, [
    jobId,
    level,
    step,
    message,
  ]);
}

async function claim(): Promise<ClaimedJob | null> {
  const res = await getPool().query<ClaimedJob>(
    `UPDATE ingestion_jobs
        SET state = 'running', started_at = now(), attempts = attempts + 1,
            lease_until = now() + interval '10 minutes', step = 'claimed'
      WHERE id = (
        SELECT id FROM ingestion_jobs
         WHERE state = 'queued'
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1
      )
      RETURNING id, version_id, attempts`,
  );
  return res.rows[0] ?? null;
}

async function processJob(job: ClaimedJob) {
  await log(job.id, "info", "claimed", `attempt ${job.attempts}`);
  await query(`UPDATE document_versions SET status = 'processing' WHERE id = $1`, [job.version_id]);

  // R2.3 (parse) is not built yet. Fail loudly instead of faking the remaining steps.
  const reason = "Parsing is not built yet (R2 slice 2). The file is stored and queued; nothing was indexed.";
  await log(job.id, "error", "parse", reason);
  await query(
    `UPDATE ingestion_jobs SET state = 'failed', step = 'parse', error = $2, finished_at = now(), lease_until = NULL
      WHERE id = $1`,
    [job.id, reason],
  );
  await query(`UPDATE document_versions SET status = 'failed' WHERE id = $1`, [job.version_id]);
}

async function main() {
  console.log(`[worker] ingestion worker started${once ? " (--once)" : ""}`);
  for (;;) {
    const job = await claim();
    if (job) {
      await processJob(job);
      if (once) break;
      continue;
    }
    if (once) {
      console.log("[worker] queue is empty");
      break;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main()
  .catch((err) => {
    console.error("[worker] fatal:", err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
