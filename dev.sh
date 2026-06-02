#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if [ -f "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh"
  nvm use
fi

if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules/.package-lock.json" ]; then
  echo "Installing dependencies..."
  npm install
fi

npm run dev -- --open
