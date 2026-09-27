-- BISVEDA V9 Migration 002: Audit Log Schema
-- Tracks all administrative actions: submit, publish, archive, rollback, fact approve/reject/edit

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ DEFAULT now(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  before JSONB,
  after JSONB,
  note TEXT
);

CREATE INDEX IF NOT EXISTS audit_log_target ON audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS audit_log_at ON audit_log (at DESC);
