#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "Warning: .env not found. Copy .env.example to .env and fill in your values." >&2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install from https://nodejs.org/" >&2
  exit 1
fi

if [[ ! -d "node_modules" ]]; then
  echo "Installing npm dependencies..."
  npm install
fi
