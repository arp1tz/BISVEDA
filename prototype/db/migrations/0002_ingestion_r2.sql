-- BISVEDA R2 — ingestion pipeline additions (ARCHITECTURE.md §6, §9).
-- Retry with backoff, worker heartbeat, officer-confirmed product terms.

-- Retry/backoff: a queued job is not claimed before run_after.
ALTER TABLE ingestion_jobs ADD COLUMN run_after timestamptz NOT NULL DEFAULT now();
DROP INDEX IF EXISTS jobs_claim;
CREATE INDEX jobs_claim ON ingestion_jobs(state, run_after) WHERE state = 'queued';

-- One row per running worker process, refreshed while it polls or works.
CREATE TABLE worker_heartbeats (
  worker_id   text PRIMARY KEY,                 -- host:pid
  seen_at     timestamptz NOT NULL,
  current_job uuid REFERENCES ingestion_jobs(id) ON DELETE SET NULL
);

-- Products a published standard covers (officer-confirmed at publish). The chat uses them to decide
-- that a product question is about one of our standards; empty for the original nine documents,
-- which the built-in product vocabulary already covers.
ALTER TABLE documents ADD COLUMN product_terms text[] NOT NULL DEFAULT '{}';
