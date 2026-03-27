#!/usr/bin/env bash
set -euo pipefail

REMOTE_SSH="${REMOTE_SSH:-narduk}"
REMOTE_ENV_FILE="${REMOTE_ENV_FILE:-/opt/narduk/tx-spends-postgres/.env}"
REMOTE_CONTAINER_NAME="${REMOTE_CONTAINER_NAME:-tx-spends-postgres}"
LOCAL_DB_NAME="${LOCAL_DB_NAME:-tx_spends}"
LOCAL_DB_URL="${LOCAL_DB_URL:-postgres://narduk@127.0.0.1:5432/${LOCAL_DB_NAME}}"
SYNC_SCOPE="${SYNC_SCOPE:-analysis}"
KEEP_ARCHIVE="${KEEP_ARCHIVE:-0}"
LOCAL_PGOPTIONS="${LOCAL_PGOPTIONS:--c synchronous_commit=off}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_cmd ssh
require_cmd psql
require_cmd createdb
require_cmd dropdb
require_cmd pg_restore
require_cmd mktemp

detect_restore_jobs() {
  if [[ -n "${RESTORE_JOBS:-}" ]]; then
    printf '%s\n' "${RESTORE_JOBS}"
    return
  fi

  local cpu_count="4"
  if command -v sysctl >/dev/null 2>&1; then
    cpu_count="$(sysctl -n hw.ncpu 2>/dev/null || printf '4')"
  fi

  if [[ "${cpu_count}" =~ ^[0-9]+$ ]]; then
    if (( cpu_count > 8 )); then
      printf '8\n'
      return
    fi
    if (( cpu_count > 1 )); then
      printf '%s\n' "$((cpu_count - 1))"
      return
    fi
  fi

  printf '4\n'
}

RESTORE_JOBS="$(detect_restore_jobs)"
ARCHIVE_FILE="${ARCHIVE_FILE:-$(mktemp -t "tx-spends-${SYNC_SCOPE}.XXXXXX.dump")}"
DELETE_ARCHIVE_ON_EXIT="1"

if [[ "${KEEP_ARCHIVE}" == "1" ]]; then
  DELETE_ARCHIVE_ON_EXIT="0"
fi

cleanup() {
  if [[ "${DELETE_ARCHIVE_ON_EXIT}" == "1" && -f "${ARCHIVE_FILE}" ]]; then
    rm -f "${ARCHIVE_FILE}"
  fi
}

trap cleanup EXIT

printf 'refreshing local database %s from %s (%s)\n' \
  "${LOCAL_DB_NAME}" \
  "${REMOTE_SSH}" \
  "${REMOTE_CONTAINER_NAME}"
printf 'sync scope: %s\n' "${SYNC_SCOPE}"
printf 'parallel restore jobs: %s\n' "${RESTORE_JOBS}"
printf 'archive path: %s\n' "${ARCHIVE_FILE}"

ssh "${REMOTE_SSH}" 'bash -s' -- "${REMOTE_ENV_FILE}" "${REMOTE_CONTAINER_NAME}" "${SYNC_SCOPE}" <<'EOF' \
  > "${ARCHIVE_FILE}"
set -euo pipefail

remote_env_file="$1"
remote_container_name="$2"
sync_scope="$3"

set -a
source "${remote_env_file}"
set +a

dump_args=(
  --format=custom
  --no-owner
  --no-privileges
)

if [[ "${sync_scope}" != "full" ]]; then
  dump_args+=(
    --table=public.fiscal_years
    --table=public.agencies
    --table=public.payees
    --table=public.geographies_counties
    --table=public.comptroller_objects
    --table=public.expenditure_categories
    --table=public.state_payment_facts
    --table=public.county_expenditure_facts
    --table=public.payment_overview_rollups
    --table=public.payment_agency_rollups
    --table=public.payment_payee_rollups
    --table=public.payment_object_rollups
    --table=public.payment_category_rollups
  )
fi

docker exec \
  -e PGPASSWORD="${POSTGRES_PASSWORD}" \
  "${remote_container_name}" \
  pg_dump \
  -h 127.0.0.1 \
  -U postgres \
  -d "${APP_DB_NAME}" \
  "${dump_args[@]}"
EOF

printf 'archive download complete (%s)\n' "$(du -sh "${ARCHIVE_FILE}" | awk '{ print $1 }')"

dropdb --if-exists "${LOCAL_DB_NAME}"
createdb "${LOCAL_DB_NAME}"

PGOPTIONS="${LOCAL_PGOPTIONS}" \
  pg_restore \
  --dbname="${LOCAL_DB_NAME}" \
  --clean \
  --if-exists \
  --exit-on-error \
  --jobs="${RESTORE_JOBS}" \
  --no-owner \
  --no-privileges \
  "${ARCHIVE_FILE}"

printf 'local tx-spends mirror ready\n'
psql --dbname="${LOCAL_DB_NAME}" -Atc \
  "select pg_size_pretty(pg_database_size(current_database())); select count(*) from state_payment_facts;"
printf 'use BLOG_ANALYSIS_DATABASE_URL=%s for local analysis runs\n' "${LOCAL_DB_URL}"
if [[ "${SYNC_SCOPE}" != "full" ]]; then
  printf 'analysis scope includes payment facts, county annual facts, rollups, and supporting dimensions\n'
fi
