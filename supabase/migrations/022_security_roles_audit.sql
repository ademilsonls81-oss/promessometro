-- Enable TOTP for admin/moderator users
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_session_at TIMESTAMPTZ;

-- Ensure role column has proper values
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'public' CHECK (role IN ('public', 'moderador', 'admin', 'super_admin'));

-- Create index on role for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_mfa ON users(mfa_enabled) WHERE mfa_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_immutable ON audit_logs(created_at DESC);

-- Make audit_logs append-only (no delete policy)
-- This is enforced at application level; for DB-level, use a trigger:
CREATE OR REPLACE FUNCTION prevent_audit_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records cannot be deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_delete_audit ON audit_logs;
CREATE TRIGGER no_delete_audit
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_delete();

DROP TRIGGER IF EXISTS no_update_audit ON audit_logs;
CREATE TRIGGER no_update_audit
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_delete();

-- Prevent DELETE on system_errors
CREATE OR REPLACE FUNCTION prevent_system_errors_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'System error records cannot be deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_delete_system_errors ON system_errors;
CREATE TRIGGER no_delete_system_errors
  BEFORE DELETE ON system_errors
  FOR EACH ROW EXECUTE FUNCTION prevent_system_errors_delete();