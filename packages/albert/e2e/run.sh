#!/usr/bin/env bash
# Albert Code network E2E test.
#
#   run.sh [--leak] <path to the kilo binary>
#
# Runs scenario.ts inside a new user, network and mount namespace where:
# - only loopback works; every other packet goes to a dummy interface and is
#   counted (and dropped) by nftables;
# - /etc/resolv.conf points at a local DNS server that records every query,
#   and /etc/nsswitch.conf and /run are replaced so that no host daemon
#   (systemd-resolved, avahi, nscd) can resolve a name on our behalf;
# - the in-process guard logs refused attempts to a file.
# The test fails if the scenario fails, or if any DNS query, outbound packet or
# guard refusal is observed. With --leak, the scenario adds a deliberate leak
# and the test is expected to fail (see negative.sh).
set -euo pipefail

leak=0
if [ "${1:-}" = "--leak" ]; then leak=1; shift; fi
bin="$(realpath "${1:?usage: run.sh [--leak] <kilo binary>}")"
here="$(cd "$(dirname "$0")" && pwd)"
bun="$(command -v bun)"
root="$(mktemp -d "${TMPDIR:-/tmp}/albert-e2e.XXXXXX")"
echo "e2e root: $root"

if [ "$(id -u)" = "0" ]; then
  wrap=(unshare --net --mount --propagation private)
else
  wrap=(unshare --user --map-root-user --net --mount --propagation private)
fi

set +e
"${wrap[@]}" env -i PATH="$(dirname "$bun"):/usr/sbin:/usr/bin:/sbin:/bin" TMPDIR="$root" \
  ROOT="$root" HERE="$here" BIN="$bin" LEAK="$leak" bash -euo pipefail -c '
  ip link set lo up
  ip link add sink type dummy
  ip addr add 10.66.0.1/24 dev sink
  ip link set sink up
  ip route add default via 10.66.0.2 dev sink
  ip -6 addr add fd66::1/64 dev sink nodad
  ip -6 route add default via fd66::2 dev sink
  nft add table inet watch
  nft add chain inet watch out "{ type filter hook output priority 0; policy accept; }"
  # IPv6 neighbour discovery and MLD are kernel signalling on the dummy link,
  # not traffic from the code under test: counted apart, everything else is a leak.
  nft add rule inet watch out oifname != "lo" icmpv6 type "{ 130, 131, 132, 133, 134, 135, 136, 143 }" counter drop
  nft add rule inet watch out oifname != "lo" counter drop

  # Name resolution can only go to the recording DNS server.
  mount -t tmpfs tmpfs /run
  mkdir -p /run/systemd/resolve
  printf "nameserver 127.0.0.1\noptions attempts:1 timeout:1\n" > "$ROOT/resolv.conf"
  printf "hosts: files dns\n" > "$ROOT/nsswitch.conf"
  cp "$ROOT/resolv.conf" /run/systemd/resolve/stub-resolv.conf
  cp "$ROOT/resolv.conf" /run/systemd/resolve/resolv.conf
  if [ ! -L /etc/resolv.conf ]; then mount --bind "$ROOT/resolv.conf" /etc/resolv.conf; fi
  mount --bind "$ROOT/nsswitch.conf" /etc/nsswitch.conf

  DNS_LOG="$ROOT/dns.log" bun "$HERE/fake-dns.ts" > "$ROOT/dns.out" 2>&1 &
  for i in $(seq 1 50); do grep -q "dns ready" "$ROOT/dns.out" 2>/dev/null && break; sleep 0.1; done
  touch "$ROOT/dns.log" "$ROOT/guard.log"

  sleep 1
  nft reset counters table inet watch > /dev/null
  status=0
  KILO_BIN="$BIN" E2E_ROOT="$ROOT" E2E_LEAK="$LEAK" ALBERT_GUARD_LOG="$ROOT/guard.log" \
    bun "$HERE/scenario.ts" || status=$?

  nft list chain inet watch out | grep -v icmpv6 | sed -n "s/.*counter packets \([0-9]*\).*/\1/p" > "$ROOT/packets"
  exit $status
'
scenario=$?
set -e

packets="$(cat "$root/packets" 2>/dev/null || echo unknown)"
dns="$(grep -c . "$root/dns.log" 2>/dev/null || true)"
guard="$(grep -c . "$root/guard.log" 2>/dev/null || true)"

echo "---"
echo "scenario exit code : $scenario"
echo "outbound packets   : $packets"
echo "dns queries        : ${dns:-0}"
echo "guard refusals     : ${guard:-0}"
if [ "${dns:-0}" != "0" ]; then echo "dns log:"; cat "$root/dns.log"; fi
if [ "${guard:-0}" != "0" ]; then echo "guard log:"; cat "$root/guard.log"; fi

if [ "$scenario" != "0" ] || [ "$packets" != "0" ] || [ "${dns:-0}" != "0" ] || [ "${guard:-0}" != "0" ]; then
  echo "FAIL: see $root (serve.log, dns.log, guard.log)"
  exit 1
fi
echo "PASS: no external connection attempt"
rm -rf "$root"
