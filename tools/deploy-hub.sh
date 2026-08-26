#!/usr/bin/env bash
#
# Deploy the survey app to the Swift Hub as a KV-served tool.
#
#   CF_TOKEN=xxxx ./tools/deploy-hub.sh
#
# It ends up at https://swift-hub.square-dream-c7dd.workers.dev/tools/window-survey
#
# A KV write, not a worker deploy - so it cannot be clobbered by another Claude
# session pushing the worker, and needs no `wrangler`.
#
# Note: the hub serves /tools/<slug> behind a hub login unless the slug is
# listed in TOOL_SLUGS in the worker. Leaving it logged-in-only is the safer
# default; making it public is a worker change, not a KV change.

set -euo pipefail

SLUG="${SLUG:-window-survey}"
NS="${CF_KV_NAMESPACE:-044b063ad25c45128c45c954bcf53172}"   # swift-hub-transfer
KEY="tool:${SLUG}"
HUB="https://swift-hub.square-dream-c7dd.workers.dev"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "${CF_TOKEN:-}" ]]; then
  echo "CF_TOKEN is not set. Create a token with Workers KV Storage:Edit and export it." >&2
  exit 1
fi

api() { curl -sS -H "Authorization: Bearer ${CF_TOKEN}" "$@"; }

# Account id: use CF_ACCOUNT_ID if given, else the first account on the token.
ACCT="${CF_ACCOUNT_ID:-}"
if [[ -z "$ACCT" ]]; then
  ACCT=$(api "https://api.cloudflare.com/client/v4/accounts" \
    | python3 -c 'import sys,json; r=json.load(sys.stdin); print(r["result"][0]["id"] if r.get("result") else "")')
fi
if [[ -z "$ACCT" ]]; then
  echo "Could not resolve a Cloudflare account id. Set CF_ACCOUNT_ID." >&2
  exit 1
fi

echo "Building…"
( cd "$ROOT" && node build.js )
FILE="$ROOT/dist/survey.html"
BYTES=$(wc -c < "$FILE")
echo "  $FILE  (${BYTES} bytes)"

# A marker unique to this build, so the read-back proves THIS copy is live
# rather than an older one that happens to contain the same UI strings.
STAMP="build $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
sed "s|<title>|<!-- ${STAMP} --><title>|" "$FILE" > "$TMP"

echo "Writing KV ${KEY} in namespace ${NS}…"
RESP=$(api -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${ACCT}/storage/kv/namespaces/${NS}/values/${KEY}" \
  -H "Content-Type: text/plain" --data-binary "@${TMP}")
echo "$RESP" | python3 -c 'import sys,json; r=json.load(sys.stdin); sys.exit(0 if r.get("success") else (print("KV write failed:", r.get("errors")) or 1))'

# Read it back. "success: true" is not proof it is serving - always verify.
echo "Reading back…"
BACK=$(api "https://api.cloudflare.com/client/v4/accounts/${ACCT}/storage/kv/namespaces/${NS}/values/${KEY}")
if grep -qF "$STAMP" <<< "$BACK"; then
  echo "  verified: this build is the one in KV"
else
  echo "  WARNING: read-back does not contain this build's stamp." >&2
  echo "  Another session may have written over it. Re-run before assuming it is live." >&2
  exit 1
fi

echo
echo "Live at: ${HUB}/tools/${SLUG}"
echo "Cloudflare takes 20-90s to propagate. Add a cache-buster (?v=$(date +%s)) if you see an old copy."
