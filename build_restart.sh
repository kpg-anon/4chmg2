#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # nvm reads variables that may be unset; under `set -u` that ends the script at once, `|| true` or not.
  set +u
  source "$HOME/.nvm/nvm.sh"
  nvm use >/dev/null 2>&1 || true
  set -u
fi

echo "Building and reloading..."
npx gulp
echo "Done."
