#!/usr/bin/env bash
# Alpine (musl) end-to-end test of the Albert Code CLI.
#
#   bash packages/albert/e2e/alpine.sh [--negative] <extension>/bin/kilo
#
# Runs run.sh (or negative.sh with --negative) inside a privileged alpine:3.22
# container of the host's architecture, with the musl build of bun. The
# container only provides the Alpine userland the CLI runs on: the isolation
# (network and mount namespaces, nftables, tcpdump, recording DNS server) is
# that of run.sh. Needs docker, and network access before the test to pull the
# image, the Alpine packages and bun.
set -euo pipefail

script=run.sh
if [ "${1:-}" = "--negative" ]; then script=negative.sh; shift; fi
bin="$(realpath "${1:?usage: alpine.sh [--negative] <kilo binary>}")"
albert="$(cd "$(dirname "$0")/.." && pwd)"
version="${BUN_VERSION:-1.4.4}"
case "$(uname -m)" in
  x86_64) asset=bun-linux-x64-musl ;;
  aarch64) asset=bun-linux-aarch64-musl ;;
  *) echo "unsupported architecture $(uname -m)"; exit 1 ;;
esac

tools="$(mktemp -d "${TMPDIR:-/tmp}/albert-alpine.XXXXXX")"
trap 'rm -rf "$tools"' EXIT
base="https://github.com/oven-sh/bun/releases/download/bun-v$version"
curl -fsSL "$base/$asset.zip" -o "$tools/$asset.zip"
curl -fsSL "$base/SHASUMS256.txt" -o "$tools/SHASUMS256.txt"
(cd "$tools" && grep " $asset.zip\$" SHASUMS256.txt | sha256sum --check)
unzip -q "$tools/$asset.zip" -d "$tools"

# ripgrep publishes no arm64 musl build: the alpine-arm64 VSIX relies on the
# system rg, as its users do (apk add ripgrep).
packages="bash nftables tcpdump iproute2 util-linux git libstdc++ libgcc"
if [ ! -e "$(dirname "$bin")/rg" ]; then packages="$packages ripgrep"; fi

docker run --rm --privileged \
  -v "$albert:/albert:ro" \
  -v "$(dirname "$bin"):/ext/bin:ro" \
  -v "$tools/$asset/bun:/usr/local/bin/bun:ro" \
  -e PACKAGES="$packages" -e SCRIPT="$script" -e EXE="$(basename "$bin")" \
  alpine:3.22 sh -euc '
    apk add --no-cache $PACKAGES > /dev/null
    # musl reads no nsswitch.conf; run.sh replaces it, so it must exist.
    touch /etc/nsswitch.conf
    bash "/albert/e2e/$SCRIPT" "/ext/bin/$EXE"
  '
