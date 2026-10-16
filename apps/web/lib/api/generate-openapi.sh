#!/usr/bin/env bash
#
# Regenerates apps/web/lib/api/openapi.d.ts from apps/api/openapi.yaml, the
# single source of truth for the web/API contract.
#
# Why the generator brings its own TypeScript:
# `openapi-typescript` needs the TypeScript 5.x JavaScript compiler API
# (`ts.factory`), but this repository pins the native TypeScript 7 compiler,
# whose npm entrypoint exports no JS API. Declaring `openapi-typescript` as a
# devDependency would therefore advertise a tool that crashes on every run, so
# the pinned versions live here and run in an isolated `bunx` environment with
# their own `typescript@5.9.3`.
#
# Cost of this choice: regenerating needs the network or a warm `bunx` cache.
# That is acceptable precisely because the artifact is committed - no build and
# no CI run ever needs the generator.
set -euo pipefail

# Resolve paths from this script's location, not from the caller's cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)" # apps/web
SPEC="$WEB_DIR/../api/openapi.yaml"        # apps/api/openapi.yaml
OUT="$SCRIPT_DIR/openapi.d.ts"

# The drift guard: the SHA-256 of the spec is stamped into the artifact so the
# offline test (openapi-drift.test.ts) can detect a spec change without ever
# running the generator.
SPEC_HASH="$(sha256sum "$SPEC" | awk '{ print $1 }')"

# Generate into a temp file so a network failure can never clobber the
# committed artifact with a half-written body. The temp file is only ever
# removed here, never any repository file.
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

bunx --package typescript@5.9.3 --package openapi-typescript@7.13.0 \
	openapi-typescript "$SPEC" --output "$TMP"

{
	printf '%s\n' "// @generated - do not edit by hand; regenerate with \`bun run openapi:generate\`."
	printf '%s\n' "// Source: apps/api/openapi.yaml"
	printf '%s\n' "// source-sha256: ${SPEC_HASH}"
	cat "$TMP"
} > "$OUT"

# openapi-typescript emits 4-space indentation; the repository formats with
# tabs. Reformat so `biome check` stays green and a second run of this script
# stays byte-for-byte identical (Biome's formatter is deterministic).
"$WEB_DIR/node_modules/.bin/biome" format --write "$OUT"
