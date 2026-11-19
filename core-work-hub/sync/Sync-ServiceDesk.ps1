#Requires -Version 7.0
<#
.SYNOPSIS
  Core Work Hub — Service Desk Plus read sync (Phase 1). Runs on Nick's PC only.

.DESCRIPTION
  Reads open requests in the Core group queues, plus requests closed in the last 90 days, from the
  Service Desk Plus REST API v3 and writes tickets.json into the shared hub folder.

  * Read-only: never writes to Service Desk.
  * The API credential is read from Windows Credential Manager on this PC. It is never written to the
    shared folder, the page, the logs or the code. Store it once with:
        On-premises:  cmdkey /generic:CoreWorkHub-SDP /user:token /pass:<the read-only technician key>
        Cloud (Zoho): pwsh -File Connect-ZohoServiceDesk.ps1   (stores a refresh token; each run gets a
                      fresh 1-hour access token from it)
  * Metadata only: ID, subject, requester, status, priority, technician, group, category, dates.
    Descriptions and notes are never requested. Card/account-number patterns in subjects are masked.
  * Keeps non-Service-Desk rows already in tickets.json (e.g. a Wrike CSV import).
  * Remembers the last value of technician and priority per ticket in a local state file, so the hub
    can tell when Service Desk changed a field after the hub did (sync conflict -> source wins, logged).

.EXAMPLE
  # Day-one check: can the token read the queues? Writes nothing.
  pwsh -File Sync-ServiceDesk.ps1 -HubFolder '\\server\share\CoreWorkHub' -BaseUrl 'https://servicedesk.example.com' -Groups 'IT Core' -Test

.EXAMPLE
  # Cloud: BaseUrl is the Service Desk address up to and including the portal name.
  pwsh -File Sync-ServiceDesk.ps1 -HubFolder '\\server\share\CoreWorkHub' -BaseUrl 'https://sdpondemand.manageengine.com/app/itdesk' -Edition Cloud -Groups 'Core Team' -Test

.EXAMPLE
  pwsh -File Sync-ServiceDesk.ps1 -HubFolder '\\server\share\CoreWorkHub' -BaseUrl 'https://servicedesk.example.com' -Groups 'IT Core','IT Core - Network'
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string] $HubFolder,
  [Parameter(Mandatory)] [string] $BaseUrl,
  [Parameter(Mandatory)] [string[]] $Groups,
  # OnPrem: header "authtechnician: <key>". Cloud (Zoho SDP On-Demand): "Authorization: Zoho-oauthtoken <token>".
  [ValidateSet('OnPrem', 'Cloud')] [string] $Edition = 'OnPrem',
  [string] $CredentialName = 'CoreWorkHub-SDP',
  [int] $ClosedDays = 90,
  # Link pattern for a ticket; {id} is replaced with the request number.
  [string] $TicketUrl = '',
  [string] $StateFile = (Join-Path $env:LOCALAPPDATA 'CoreWorkHub\sync-state.json'),
  [string] $LogFile = (Join-Path $env:LOCALAPPDATA 'CoreWorkHub\sync.log'),
  # Read each open ticket's latest requester-visible note so the hub can enforce the communication standard.
  # One extra API call per open ticket; turn off with -SkipNotes if the API is rate-limited.
  [switch] $SkipNotes,
  [switch] $Test
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $TicketUrl) {
  $TicketUrl = if ($Edition -eq 'Cloud') { "$($BaseUrl.TrimEnd('/'))/ui/requests/{id}/details" } else { "$($BaseUrl.TrimEnd('/'))/WorkOrder.do?woMode=viewWO&woID={id}" }
}

function Write-Log([string] $Message) {
  $line = '{0:u}  {1}' -f (Get-Date), $Message
  Write-Host $line
  $dir = Split-Path $LogFile
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Add-Content -Path $LogFile -Value $line
}

# --- Windows Credential Manager (generic credential), via advapi32. No extra modules needed.
Add-Type -Namespace CoreWorkHub -Name Cred -MemberDefinition @'
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct CREDENTIAL {
  public int Flags; public int Type; public string TargetName; public string Comment;
  public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
  public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist;
  public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
}
[DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool CredRead(string target, int type, int flags, out IntPtr credential);
[DllImport("advapi32.dll")] public static extern void CredFree(IntPtr buffer);
public static string Read(string target) {
  IntPtr p;
  if (!CredRead(target, 1, 0, out p)) return null;
  try {
    var c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
    return Marshal.PtrToStringUni(c.CredentialBlob, c.CredentialBlobSize / 2);
  } finally { CredFree(p); }
}
'@ -UsingNamespace System.Runtime.InteropServices

$token = [CoreWorkHub.Cred]::Read($CredentialName)
if (-not $token) {
  if ($Edition -eq 'Cloud') { throw "No credential '$CredentialName' in Windows Credential Manager. Run Connect-ZohoServiceDesk.ps1 first." }
  throw "No credential '$CredentialName' in Windows Credential Manager. Run: cmdkey /generic:$CredentialName /user:token /pass:<key>"
}

$headers = @{ Accept = 'application/vnd.manageengine.sdp.v3+json' }
if ($Edition -eq 'OnPrem') {
  $headers['authtechnician'] = $token
} else {
  # Cloud: the stored credential is the refresh token from Connect-ZohoServiceDesk.ps1. Swap it for a
  # 1-hour access token now (Zoho allows about 10 of these per 10 minutes; a 15-minute sync uses 1).
  try { $z = $token | ConvertFrom-Json } catch { $z = $null }
  if (-not $z -or -not $z.PSObject.Properties['refresh_token']) {
    throw "'$CredentialName' doesn't hold a Zoho refresh token (an access token expires after an hour). Run Connect-ZohoServiceDesk.ps1."
  }
  $tok = Invoke-RestMethod -Method Post -Uri "$($z.accounts)/oauth/v2/token" -TimeoutSec 30 -Body @{
    grant_type = 'refresh_token'; refresh_token = $z.refresh_token; client_id = $z.client_id; client_secret = $z.client_secret
  }
  if ($tok.PSObject.Properties['error'] -or -not $tok.PSObject.Properties['access_token']) {
    $e = if ($tok.PSObject.Properties['error']) { $tok.error } else { 'no access token returned' }
    throw "Zoho refused the refresh token ($e). If the Self Client was deleted or access revoked, run Connect-ZohoServiceDesk.ps1 again."
  }
  $headers['Authorization'] = "Zoho-oauthtoken $($tok.access_token)"
  Remove-Variable tok, z
}
$api = "$($BaseUrl.TrimEnd('/'))/api/v3/requests"

function Get-Requests([hashtable] $SearchCriteria) {
  $start = 1
  $all = [System.Collections.Generic.List[object]]::new()
  do {
    $listInfo = @{
      row_count       = 100
      start_index     = $start
      sort_field      = 'created_time'
      sort_order      = 'desc'
      get_total_count = $true
      search_criteria = $SearchCriteria
      fields_required = @('id', 'display_id', 'subject', 'requester', 'status', 'priority', 'technician', 'group', 'category', 'created_time', 'completed_time', 'resolved_time', 'responded_time', 'last_updated_time', 'due_by_time')
    }
    $inputData = @{ list_info = $listInfo } | ConvertTo-Json -Depth 10 -Compress
    $uri = "$api`?input_data=$([uri]::EscapeDataString($inputData))"
    $resp = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 60
    $rs = Get-Val $resp 'response_status'
    $st = @($rs)[0]
    if ($st -and (Get-Val $st 'status') -ne 'success' -and (Get-Val $st 'status_code') -ne 2000) {
      throw "Service Desk error: $($rs | ConvertTo-Json -Compress -Depth 5)"
    }
    foreach ($r in @(Get-Val $resp 'requests')) { if ($r) { $all.Add($r) } }
    $start += 100
    $more = Get-Val (Get-Val $resp 'list_info') 'has_more_rows'
  } while ($more -and $start -lt 20000)
  return $all
}

function Get-Val($obj, [string] $name) {
  if ($null -eq $obj) { return $null }
  $p = $obj.PSObject.Properties[$name]
  if ($null -eq $p) { return $null }
  return $p.Value
}
function Get-Name($obj) { $n = Get-Val $obj 'name'; if ($n) { return [string]$n }; return $null }
function Get-Time($obj) {
  $v = Get-Val $obj 'value'
  if (-not $v) { return $null }
  return [DateTimeOffset]::FromUnixTimeMilliseconds([long]$v).UtcDateTime.ToString('o')
}
function Hide-Numbers([string] $Text) {
  if (-not $Text) { return $Text }
  return [regex]::Replace($Text, '\b\d(?:[ -]?\d){7,18}\b', { param($m) '••••' + (($m.Value -replace '\D', '')[-4..-1] -join '') })
}

# Latest note on a request that the requester can see (show_to_requester), as ISO time. $null if none or on error.
function Get-LastRequesterNote([string] $RequestId) {
  if (-not $RequestId) { return $null }
  try {
    $li = @{ list_info = @{ row_count = 20; start_index = 1; sort_field = 'created_time'; sort_order = 'desc' } } | ConvertTo-Json -Depth 5 -Compress
    $resp = Invoke-RestMethod -Method Get -Uri "$api/$RequestId/notes?input_data=$([uri]::EscapeDataString($li))" -Headers $headers -TimeoutSec 30
    foreach ($n in @(Get-Val $resp 'notes')) {
      if (-not $n) { continue }
      $public = Get-Val $n 'show_to_requester'
      if ($public -eq $false) { continue }
      $t = Get-Time (Get-Val $n 'created_time')
      if ($t) { return $t }
    }
  } catch {
    Write-Log "WARN: could not read notes for request $RequestId : $($_.Exception.Message)"
  }
  return $null
}

$groupCrit = @{ field = 'group.name'; condition = 'is'; values = $Groups }
$sinceMs = [DateTimeOffset]::UtcNow.AddDays(-$ClosedDays).ToUnixTimeMilliseconds()

if ($Test) {
  Write-Log "TEST: reading one page of open requests in: $($Groups -join ', ')"
  $open = Get-Requests @{ field = 'status.in_progress'; condition = 'is'; value = $true; children = @(@{ logical_operator = 'AND' } + $groupCrit) }
  Write-Log "TEST: OK — $($open.Count) open requests visible. Sample subjects (masked):"
  $open | Select-Object -First 5 | ForEach-Object { Write-Log ("  #{0}  {1}  [{2}]" -f ((Get-Val $_ 'display_id') ?? (Get-Val $_ 'id')), (Hide-Numbers ([string](Get-Val $_ 'subject'))), (Get-Name (Get-Val $_ 'status'))) }
  Write-Log 'TEST: nothing was written.'
  return
}

try {
  $openCrit = @{ field = 'status.in_progress'; condition = 'is'; value = $true; children = @(@{ logical_operator = 'AND' } + $groupCrit) }
  $closedCrit = @{ field = 'completed_time'; condition = 'greater than'; value = "$sinceMs"; children = @(@{ logical_operator = 'AND' } + $groupCrit) }
  $rows = @(Get-Requests $openCrit) + @(Get-Requests $closedCrit)
} catch {
  Write-Log "FAILED to read Service Desk: $($_.Exception.Message)"
  exit 1
}

# --- previous state (per-field change timestamps for conflict detection)
$state = @{}
if (Test-Path $StateFile) { (Get-Content $StateFile -Raw | ConvertFrom-Json -AsHashtable).GetEnumerator() | ForEach-Object { $state[$_.Key] = $_.Value } }
$now = [DateTime]::UtcNow.ToString('o')

$seen = @{}
$items = foreach ($r in $rows) {
  $id = [string]((Get-Val $r 'display_id') ?? (Get-Val $r 'id'))
  if ($seen.ContainsKey($id)) { continue }
  $seen[$id] = $true
  $owner = Get-Name (Get-Val $r 'technician')
  $prio = Get-Name (Get-Val $r 'priority')
  $prev = $state[$id]
  $changed = if ($prev -and $prev['changed']) { @{} + $prev['changed'] } else { @{} }
  if ($prev) {
    if ([string]$prev['owner'] -ne [string]$owner) { $changed['source_owner'] = $now }
    if ([string]$prev['priority'] -ne [string]$prio) { $changed['source_priority'] = $now }
  }
  $state[$id] = @{ owner = $owner; priority = $prio; changed = $changed }
  $closed = (Get-Time (Get-Val $r 'completed_time')) ?? (Get-Time (Get-Val $r 'resolved_time'))
  $o = [ordered]@{
    source          = 'SD'
    source_id       = $id
    source_url      = $TicketUrl.Replace('{id}', [uri]::EscapeDataString($id))
    title           = Hide-Numbers ([string](Get-Val $r 'subject'))
    requester       = Get-Name (Get-Val $r 'requester')
    source_status   = (Get-Name (Get-Val $r 'status')) ?? 'Open'
    source_priority = $prio
    source_owner    = $owner
    group           = Get-Name (Get-Val $r 'group')
    category        = Get-Name (Get-Val $r 'category')
    created         = (Get-Time (Get-Val $r 'created_time')) ?? $now
  }
  if ($closed) { $o['closed'] = $closed }
  # Communication standard inputs: first response, last change, last requester-visible note.
  $responded = Get-Time (Get-Val $r 'responded_time')
  if ($responded) { $o['responded'] = $responded }
  $modified = Get-Time (Get-Val $r 'last_updated_time')
  if ($modified) { $o['last_modified'] = $modified }
  $dueBy = Get-Time (Get-Val $r 'due_by_time')
  if ($dueBy) { $o['due_by'] = $dueBy }
  if (-not $SkipNotes -and -not $closed) {
    $note = Get-LastRequesterNote ([string](Get-Val $r 'id'))
    if ($note) { $o['last_note'] = $note }
  }
  if ($changed.Count) { $o['changed'] = $changed }
  [pscustomobject]$o
}

# --- keep rows from other sources (Wrike CSV import etc.)
$ticketsPath = Join-Path $HubFolder 'tickets.json'
$keep = @()
if (Test-Path $ticketsPath) {
  try { $keep = @((Get-Content $ticketsPath -Raw | ConvertFrom-Json -AsHashtable)['items'] | Where-Object { $_['source'] -ne 'SD' }) } catch { Write-Log "WARN: could not read existing tickets.json: $($_.Exception.Message)" }
}

$snapshot = [ordered]@{
  generatedAt = $now
  generatedBy = "sync@$env:COMPUTERNAME"
  mode        = 'api'
  items       = @($keep) + @($items)
}

# Write to a temp file beside the target, then swap it in, so the page never reads half a file.
$tmp = Join-Path $HubFolder ('tickets.json.tmp-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$snapshot | ConvertTo-Json -Depth 8 | Set-Content -Path $tmp -Encoding utf8NoBOM
Move-Item -Path $tmp -Destination $ticketsPath -Force

$stateDir = Split-Path $StateFile
if (-not (Test-Path $stateDir)) { New-Item -ItemType Directory -Path $stateDir -Force | Out-Null }
$state | ConvertTo-Json -Depth 6 | Set-Content -Path $StateFile -Encoding utf8NoBOM
Write-Log "OK: wrote $(@($items).Count) Service Desk items (+$(@($keep).Count) other) to $ticketsPath"
