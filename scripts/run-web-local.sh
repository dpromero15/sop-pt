#!/usr/bin/env bash
# Runs the local Vite web app (npm run dev).
# Invoked by the VS Code/Cursor task "run web (local)".

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found on PATH. Install Node.js and try again." >&2
  exit 1
fi

echo "Starting web app from $repo_root ..."
npm run dev
