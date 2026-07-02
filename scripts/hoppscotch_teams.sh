#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/hoppscotch_list_teams.sh" "$@"
