#!/usr/bin/env bash
# Receptify — idempotent bootstrap. Safe to re-run.
# Recovers PostgreSQL + seed data after a container reset.

set -euo pipefail

log() { echo "[bootstrap] $*"; }

# 1. Ensure postgres OS user + binaries exist
if ! id postgres >/dev/null 2>&1; then
  log "Recreating postgres OS user"
  useradd -r -d /var/lib/postgresql -s /bin/bash postgres || true
fi

if ! command -v psql >/dev/null 2>&1; then
  log "Installing postgresql-15"
  apt-get update -y && apt-get install -y postgresql postgresql-contrib
fi

# 2. Ensure ownership
chown -R postgres:postgres /var/lib/postgresql /var/log/postgresql /etc/postgresql 2>/dev/null || true

# 3. Make sure supervisor knows about postgres
if [ ! -f /etc/supervisor/conf.d/postgresql.conf ]; then
  log "Re-writing postgres supervisor conf"
  cat > /etc/supervisor/conf.d/postgresql.conf <<'EOF'
[program:postgresql]
command=/usr/lib/postgresql/15/bin/postgres -D /var/lib/postgresql/15/main -c config_file=/etc/postgresql/15/main/postgresql.conf
user=postgres
autostart=true
autorestart=true
stderr_logfile=/var/log/postgresql/postgresql.err.log
stdout_logfile=/var/log/postgresql/postgresql.out.log
stopsignal=INT
stopwaitsecs=30
EOF
  supervisorctl reread && supervisorctl update
fi

# 4. Start postgres if not running
if ! supervisorctl status postgresql 2>/dev/null | grep -q RUNNING; then
  log "Starting postgresql"
  supervisorctl start postgresql || true
  sleep 3
fi

# 5. Ensure DB + role exist
log "Ensuring receptify DB + role"
su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='receptify'\"" | grep -q 1 || \
  su - postgres -c "psql -c \"CREATE USER receptify WITH PASSWORD 'receptify_pass' SUPERUSER;\""
su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='receptify'\"" | grep -q 1 || \
  su - postgres -c "psql -c \"CREATE DATABASE receptify OWNER receptify;\""

# 6. Run migrations + seed (idempotent)
log "Running migrations + seed"
cd /app/frontend && yarn db:seed

# 7. Restart frontend + backend so they pick up a fresh DB pool
supervisorctl restart frontend backend

log "Bootstrap complete."
