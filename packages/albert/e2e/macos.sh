#!/usr/bin/env bash
# macOS end-to-end test of the Albert Code CLI (macOS has no network
# namespaces, so this is not the isolated test of run.sh).
#
#   bash packages/albert/e2e/macos.sh [--leak] <extension>/bin/kilo
#
# Creates a dedicated user, copies the extension's bin directory, bun and the
# test scripts to a fresh directory, and runs scenario.ts as that user while a
# pf anchor lets loopback through and blocks and logs every TCP and UDP packet
# of that user on any other interface. Every program the scenario starts (the
# CLI, rg, git, the commands of the bash tool) runs as that user, so all of
# them are watched.
#
# Fails if the scenario fails, if the guard refused anything, or if pf blocked
# a packet of that user. With --leak, the user also makes a deliberate external
# request: the test then passes only if pf reports it (negative test).
#
# Not covered: name resolution is done by mDNSResponder on behalf of programs,
# so a DNS query cannot be attributed (the in-process guard still refuses dns
# lookups); ICMP and raw sockets are not matched by user. Needs sudo without a
# password (GitHub macOS runners).
set -euo pipefail

leak=0
if [ "${1:-}" = "--leak" ]; then leak=1; shift; fi
src="$(cd "$(dirname "${1:?usage: macos.sh [--leak] <kilo binary>}")" && pwd)"
here="$(cd "$(dirname "$0")" && pwd)"
user=albert-e2e
uid=4242
anchor=com.apple/albert-e2e

# /tmp is a link to /private/tmp: the CLI resolves its directory, so the test
# must use the real path or the fake model writes "outside" the project.
root="$(cd "$(mktemp -d /tmp/albert-e2e.XXXXXX)" && pwd -P)"
echo "e2e root: $root"
mkdir -p "$root/bin" "$root/tools" "$root/albert" "$root/home"
ditto "$src" "$root/bin"
chmod +x "$root/bin/kilo" "$root/bin/rg" 2> /dev/null || true
cp "$(command -v bun)" "$root/tools/bun"
ditto "$(cd "$here/.." && pwd)" "$root/albert"
rm -rf "$root/albert/node_modules"
touch "$root/guard.log"

if ! id "$user" > /dev/null 2>&1; then
  sudo dscl . -create "/Users/$user"
  sudo dscl . -create "/Users/$user" UniqueID "$uid"
  sudo dscl . -create "/Users/$user" PrimaryGroupID 20
  sudo dscl . -create "/Users/$user" UserShell /bin/bash
  sudo dscl . -create "/Users/$user" NFSHomeDirectory "$root/home"
fi

# Loopback passes; any other TCP or UDP packet of the test user is blocked and
# logged. The default /etc/pf.conf evaluates the com.apple/* anchors.
# "return" makes a blocked connect fail at once instead of waiting for a timeout.
printf 'pass quick on lo0 all\nblock return log quick proto { tcp udp } all user %s\n' "$uid" > "$root/pf.conf"
# The test user owns the tree; the runner still reads the results.
sudo chown -R "$user" "$root"
sudo chmod 755 "$root"
sudo ifconfig pflog0 create 2> /dev/null || true
token="$(sudo pfctl -E 2>&1 | sed -n 's/^Token : //p')"
sudo pfctl -a "$anchor" -f "$root/pf.conf"
sudo pfctl -a "$anchor" -z > /dev/null 2>&1 || true
sudo tcpdump -n -e -i pflog0 -w "$root/pflog.pcap" > /dev/null 2>&1 &
dump=$!
cleanup() {
  sudo kill "$dump" 2> /dev/null || true
  sudo pfctl -a "$anchor" -F all > /dev/null 2>&1 || true
  if [ -n "$token" ]; then sudo pfctl -X "$token" > /dev/null 2>&1 || true; fi
}
trap cleanup EXIT
sleep 1

cd "$root"
run() {
  sudo -u "$user" env -i PATH="$root/tools:/usr/bin:/bin:/usr/sbin:/sbin" HOME="$root/home" TMPDIR="$root/home" \
    KILO_BIN="$root/bin/kilo" E2E_ROOT="$root" E2E_LEAK=0 ALBERT_GUARD_LOG="$root/guard.log" "$@"
}

set +e
run "$root/tools/bun" "$root/albert/e2e/scenario.ts"
scenario=$?
set -e

if [ "$leak" = "1" ]; then
  echo "leak - the test user connects to an external host"
  run "$root/tools/bun" -e "await fetch('https://example.org/').catch(() => {})" || true
fi

sleep 2
# Packets counted by the block rules of the anchor ({ tcp udp } expands to two).
stats="$(sudo pfctl -a "$anchor" -vsr)"
rules="$(grep -c '^block' <<< "$stats" || true)"
blocked="$(awk '/^block/ { on = 1; next } /^[a-z]/ { on = 0 } on { for (i = 1; i < NF; i++) if ($i == "Packets:") sum += $(i + 1) } END { print sum + 0 }' <<< "$stats")"
refusals="$(grep -c . "$root/guard.log" || true)"
sudo kill "$dump" 2> /dev/null || true
sleep 1

echo ""
echo "pf rules           :"
sed 's/^/  /' <<< "$stats"
echo "blocked packets    : $blocked"
sudo tcpdump -n -e -r "$root/pflog.pcap" 2> /dev/null | head -20 | sed 's/^/  /'
echo "guard refusals     : ${refusals:-0}"
if [ "${refusals:-0}" != "0" ]; then sed 's/^/  /' "$root/guard.log"; fi
echo "scenario exit code : $scenario"

if [ "$rules" = "0" ]; then
  echo "FAIL: the pf block rules are not loaded"
  exit 1
fi
if [ "$leak" = "1" ]; then
  if [ "$blocked" -gt 0 ]; then echo "PASS: the deliberate leak was detected"; exit 0; fi
  echo "FAIL: the deliberate leak was not detected"
  exit 1
fi
if [ "$scenario" != "0" ] || [ "$blocked" != "0" ] || [ "${refusals:-0}" != "0" ]; then
  # A CI runner is gone after the job: show the CLI output and its last log.
  echo "--- serve.log (last 100 lines)"
  sudo tail -n 100 "$root/serve.log" 2> /dev/null || true
  last="$(sudo find "$root/home" -path '*albert-code/log/*.log' 2> /dev/null | sort | tail -n 1)"
  if [ -n "$last" ]; then
    echo "--- $last (last 200 lines)"
    sudo tail -n 200 "$last"
  fi
  echo "FAIL: see $root (serve.log, guard.log, pflog.pcap)"
  exit 1
fi
echo "PASS: Albert Code only connected to loopback"
