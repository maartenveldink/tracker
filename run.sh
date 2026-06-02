#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# Load nvm if available
if [ -f "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh"
  nvm use
fi

# Install dependencies if node_modules is missing or package-lock.json is newer
if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules/.package-lock.json" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build
echo "Building..."
npm run build

# Serve the production build and open the browser
echo "Starting preview server..."
npm run preview -- --open
