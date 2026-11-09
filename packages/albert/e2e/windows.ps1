# Windows end-to-end test of the Albert Code CLI (Windows has no network
# namespaces, so this is not the isolated test of run.sh).
#
#   pwsh packages/albert/e2e/windows.ps1 -Bin <extension>\bin\kilo.exe [-Leak]
#
# Copies the extension's bin directory to a fresh directory, turns on the
# Windows Filtering Platform audit (Security events 5156 permitted, 5157
# blocked: every connection, with the program that opened it), runs
# scenario.ts against that kilo.exe, then lists the connections opened by the
# programs of that directory (kilo.exe, rg.exe).
#
# Fails if the scenario fails, if the guard refused anything, or if one of
# those programs connected anywhere but loopback. With -Leak, a copy of bun in
# that directory makes a deliberate external request: the test then passes only
# if it reports that leak (negative test).
#
# Not covered: name resolution is done by the Windows DNS client service on
# behalf of programs, so a DNS query cannot be attributed (the in-process guard
# still refuses dns lookups); child processes outside that directory (git) are
# not watched. Needs an elevated shell (auditpol, Security log).
param(
  [Parameter(Mandatory = $true)] [string] $Bin,
  [switch] $Leak
)
$ErrorActionPreference = "Stop"

$root = Join-Path ([System.IO.Path]::GetTempPath()) "albert-e2e-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$dir = Join-Path $root "bin"
New-Item -ItemType Directory -Force $dir | Out-Null
Copy-Item -Recurse (Join-Path (Split-Path (Resolve-Path $Bin).Path) "*") $dir
$kilo = Join-Path $dir "kilo.exe"
$guard = Join-Path $root "guard.log"
New-Item -ItemType File $guard | Out-Null
Write-Host "e2e root: $root"

auditpol /set /subcategory:"Filtering Platform Connection" /success:enable /failure:enable | Out-Null
if ($LASTEXITCODE -ne 0) { throw "auditpol failed (run elevated)" }
$start = Get-Date
Start-Sleep -Seconds 1

$env:KILO_BIN = $kilo
$env:E2E_ROOT = $root
$env:ALBERT_GUARD_LOG = $guard
& bun (Join-Path $PSScriptRoot "scenario.ts")
$scenario = $LASTEXITCODE

if ($Leak) {
  Write-Host "leak - a program of the watched directory connects to an external host"
  $copy = Join-Path $dir "leak.exe"
  Copy-Item (Get-Command bun).Source $copy
  & $copy -e "await fetch('https://example.org/').catch(() => {})"
}

Start-Sleep -Seconds 3
$leaf = Split-Path $root -Leaf
$events = @(Get-WinEvent -FilterHashtable @{ LogName = "Security"; Id = 5156, 5157; StartTime = $start } -ErrorAction SilentlyContinue)
$flows = foreach ($event in $events) {
  $data = @{}
  foreach ($node in ([xml]$event.ToXml()).Event.EventData.Data) { $data[$node.Name] = $node.'#text' }
  if ($data.Application -notlike "*\$leaf\*") { continue }
  # %%14593 is "Outbound"; inbound events are the loopback server accepting.
  if ($data.Direction -ne "%%14593") { continue }
  [pscustomobject]@{
    Event = $(if ($event.Id -eq 5157) { "blocked" } else { "permitted" })
    Program = Split-Path $data.Application -Leaf
    Destination = $data.DestAddress
    Port = $data.DestPort
  }
}
$loopback = { param($addr) $addr -like "127.*" -or $addr -eq "::1" }
$external = @($flows | Where-Object { -not (& $loopback $_.Destination) })
$refusals = @(Get-Content $guard | Where-Object { $_ -match "\S" })

Write-Host ""
Write-Host "audit events       : $($events.Count)"
Write-Host "watched outbound   : $(@($flows).Count) (loopback: $(@($flows).Count - $external.Count))"
Write-Host "external outbound  : $($external.Count)"
$external | Format-Table | Out-String | Write-Host
Write-Host "guard refusals     : $($refusals.Count)"
$refusals | ForEach-Object { Write-Host "  $_" }
Write-Host "scenario exit code : $scenario"

if (@($flows).Count -eq 0) {
  Write-Host "FAIL: no audited connection from the watched programs (the audit is not working)"
  exit 1
}
if ($Leak) {
  if ($external.Count -gt 0) { Write-Host "PASS: the deliberate leak was detected"; exit 0 }
  Write-Host "FAIL: the deliberate leak was not detected"
  exit 1
}
if ($scenario -ne 0 -or $external.Count -gt 0 -or $refusals.Count -gt 0) {
  Write-Host "FAIL"
  exit 1
}
Write-Host "PASS: Albert Code only connected to loopback"
