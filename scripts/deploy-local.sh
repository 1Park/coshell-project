#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/share/coshell/runtime/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
base="$HOME/.local/share/coshell"
label="local.coshell.frontend"
domain="gui/$(id -u)"
sha="$(git rev-parse HEAD)"
mkdir -p "$base/releases" "$base/logs" "$HOME/Library/LaunchAgents"
release="$(mktemp -d "$base/releases/${sha:0:12}.XXXXXX")"
echo "Archiving $sha to $release"
git archive HEAD | tar -x -C "$release"
cd "$release"
echo "::group::Install dependencies"
time npm ci --no-audit --no-fund
echo "::endgroup::"
echo "::group::Build frontend"
time npm run build
echo "::endgroup::"

# launchd owns the server, independently of the Actions job process tree.
export COSHELL_BASE="$base" COSHELL_RELEASE="$release" COSHELL_SHA="$sha"
plist="$HOME/Library/LaunchAgents/$label.plist"
python3 - "$plist" <<'PY'
import os, plistlib, sys
base = os.environ['COSHELL_BASE']
config = {
    'Label': 'local.coshell.frontend',
    'ProgramArguments': ['/bin/bash', base + '/start-server.sh'],
    'RunAtLoad': True, 'KeepAlive': True, 'ThrottleInterval': 5,
    'EnvironmentVariables': {'PATH': os.environ['PATH'], 'HOME': os.environ['HOME'], 'PORT': '3000', 'HOST': '127.0.0.1'},
    'StandardOutPath': base + '/logs/frontend.log',
    'StandardErrorPath': base + '/logs/frontend.error.log',
}
with open(sys.argv[1], 'wb') as f: plistlib.dump(config, f)
PY
cat > "$base/start-server.sh" <<'SH'
#!/bin/bash
set -euo pipefail
cd "$HOME/.local/share/coshell/current"
# Optional machine-local secrets (e.g. ANTHROPIC_API_KEY). Never committed.
if [ -f "$HOME/.local/share/coshell/env" ]; then
  set -a
  . "$HOME/.local/share/coshell/env"
  set +a
fi
export RELEASE_SHA="$(cat .release-sha)"
exec npm start
SH
printf '%s\n' "$sha" > "$release/.release-sha"
previous="$(readlink "$base/current" || true)"
switch_release() {
  ln -s "$1" "$base/current.next"
  mv -fh "$base/current.next" "$base/current"
}
echo "Activating release $sha"
switch_release "$release"
rollback() {
  if [ -n "$previous" ]; then
    switch_release "$previous"
    launchctl kickstart -k "$domain/$label" || true
    echo "Deployment failed; restored $previous" >&2
  else
    launchctl bootout "$domain/$label" 2>/dev/null || true
    rm -f "$base/current"
  fi
}
trap rollback ERR
if launchctl print "$domain/$label" >/dev/null 2>&1; then
  launchctl kickstart -k "$domain/$label"
else
  launchctl bootstrap "$domain" "$plist"
fi
echo "Checking server health and commit"
healthy=false
for attempt in {1..30}; do
  if curl -fsS --max-time 2 http://127.0.0.1:3000/healthz 2>/dev/null | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("commit") == sys.argv[1] else 1)' "$sha" 2>/dev/null; then
    healthy=true
    break
  fi
  sleep 1
done
if [ "$healthy" != true ]; then
  echo "Server health check failed" >&2
  false
fi
trap - ERR
echo "Deployed $sha to http://localhost:3000"

# MCP server runs after the frontend is healthy, so an MCP failure never rolls back the frontend.
mcp_label="local.coshell.mcp"
echo "::group::Install MCP dependencies"
(cd "$release/mcp" && npm ci --no-audit --no-fund)
echo "::endgroup::"
mkdir -p "$base/data"
DATA_DIR="$base/data" node "$release/mcp/scripts/seed.mjs"
mcp_plist="$HOME/Library/LaunchAgents/$mcp_label.plist"
python3 - "$mcp_plist" <<'PY'
import os, plistlib, sys
base = os.environ['COSHELL_BASE']
config = {
    'Label': 'local.coshell.mcp',
    'ProgramArguments': ['/bin/bash', base + '/start-mcp.sh'],
    'RunAtLoad': True, 'KeepAlive': True, 'ThrottleInterval': 5,
    'EnvironmentVariables': {'PATH': os.environ['PATH'], 'HOME': os.environ['HOME'], 'PORT': '3001', 'HOST': '0.0.0.0', 'DATA_DIR': base + '/data'},
    'StandardOutPath': base + '/logs/mcp.log',
    'StandardErrorPath': base + '/logs/mcp.error.log',
}
with open(sys.argv[1], 'wb') as f: plistlib.dump(config, f)
PY
cat > "$base/start-mcp.sh" <<'SH'
#!/bin/bash
set -euo pipefail
cd "$HOME/.local/share/coshell/current/mcp"
export RELEASE_SHA="$(cat ../.release-sha)"
exec node src/server.mjs
SH
if launchctl print "$domain/$mcp_label" >/dev/null 2>&1; then
  launchctl kickstart -k "$domain/$mcp_label"
else
  launchctl bootstrap "$domain" "$mcp_plist"
fi
echo "Checking MCP server health and commit"
for attempt in {1..30}; do
  if curl -fsS --max-time 2 http://127.0.0.1:3001/healthz 2>/dev/null | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("commit") == sys.argv[1] else 1)' "$sha" 2>/dev/null; then
    echo "Deployed MCP server $sha to http://0.0.0.0:3001/mcp"
    exit 0
  fi
  sleep 1
done
echo "MCP server health check failed (frontend is still deployed)" >&2
exit 1
