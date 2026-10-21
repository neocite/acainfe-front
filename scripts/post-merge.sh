#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Install the merged lockfile without prompting or changing dependency versions.
CI=true pnpm install --frozen-lockfile
pnpm --filter @workspace/acainfe run typecheck
pnpm --filter @workspace/acainfe run build
