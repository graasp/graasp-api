#!/usr/bin/env bash
# Migrates the database at DB_CONNECTION with the admin app's migrations.
#
# The admin app (graasp/graasp-web) owns the database schema: it writes and runs
# every migration, and core's src/drizzle/schema.ts describes the result. Core
# no longer runs drizzle migrations. This script checks admin out at ADMIN_REF
# (pinned in mise.toml) and runs `mix ecto.migrate` against DB_CONNECTION.
#
# Environment:
#   DB_CONNECTION  database to migrate (postgres://user:pass@host:port/db)
#   ADMIN_REF      admin commit or tag to take the migrations from
#   ADMIN_DIR      use this admin checkout as is instead of tmp/admin at ADMIN_REF
#                  (for example ../admin while working on a migration)
#
# Needs git, and either mix on the PATH or mise to install Erlang and Elixir.
set -euo pipefail

: "${DB_CONNECTION:?DB_CONNECTION is not set}"

admin_dir="${ADMIN_DIR:-tmp/admin}"
if [ -z "${ADMIN_DIR:-}" ]; then
  : "${ADMIN_REF:?ADMIN_REF is not set}"
  if [ ! -d "$admin_dir/.git" ]; then
    git clone --quiet --filter=blob:none https://github.com/graasp/graasp-web.git "$admin_dir"
  fi
  git -C "$admin_dir" fetch --quiet origin "$ADMIN_REF"
  git -C "$admin_dir" checkout --quiet --detach FETCH_HEAD
fi
echo "Migrating with admin $(git -C "$admin_dir" rev-parse --short HEAD) from $admin_dir"

cd "$admin_dir"
if ! command -v mix >/dev/null; then
  mise trust --quiet mise.toml
  mise install --quiet
fi

# mix from the PATH, or from the tools pinned in admin's mise.toml
admin_mix() {
  if command -v mix >/dev/null; then
    mix "$@"
  else
    mise exec -- mix "$@"
  fi
}

export MIX_ENV=test
admin_mix local.hex --if-missing --force >/dev/null
admin_mix local.rebar --if-missing --force >/dev/null
admin_mix deps.get >/dev/null
# Ecto passes URL query parameters on as connection options, so drop them
# (for example ?sslmode=disable).
DATABASE_URL="${DB_CONNECTION%%\?*}" admin_mix ecto.migrate
