CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email varchar(255) NOT NULL,
  action varchar(50) NOT NULL,
  entity varchar(50) NOT NULL,
  entity_id varchar(100),
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address varchar(64);
