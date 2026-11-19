#Requires -Version 7.0
<#
.SYNOPSIS
  One-time connection to Service Desk Plus Cloud (Zoho) for the Core Work Hub sync. Run on Nick's PC only.

.DESCRIPTION
  Zoho access tokens expire after 1 hour, so the sync can't store one. Instead this script swaps a
  Self Client "grant code" for a long-lived REFRESH token, and stores it (with the client ID and secret)
  in Windows Credential Manager as 'CoreWorkHub-SDP'. Each sync run then gets a fresh 1-hour access token.

  Nothing is written to the shared folder, the hub page, the logs or the code.

  Before running: Zoho API Console (https://api-console.zoho.com) -> Self Client -> Generate Code tab:
    Scope:        SDPOnDemand.requests.READ
    Time duration: 10 minutes
    Description:  Core Work Hub sync (read-only)
  Copy the code, then run this script straight away (the code works once and expires).

.EXAMPLE
  pwsh -File .\Connect-ZohoServiceDesk.ps1
  pwsh -File .\Connect-ZohoServiceDesk.ps1 -AccountsUrl https://accounts.zoho.eu    # EU data centre
#>
param(
  # Zoho accounts server for your data centre: .com (US), .eu, .in, .com.au, .com.cn, .jp, .ca
  [string] $AccountsUrl = 'https://accounts.zoho.com',
  [string] $CredentialName = 'CoreWorkHub-SDP'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -Namespace CoreWorkHub -Name CredWriter -MemberDefinition @'
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct CREDENTIAL {
  public int Flags; public int Type; public string TargetName; public string Comment;
  public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
  public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist;
  public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
}
[DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool CredWrite([In] ref CREDENTIAL credential, int flags);
public static void Write(string target, string user, string secret) {
  byte[] b = System.Text.Encoding.Unicode.GetBytes(secret);
  var c = new CREDENTIAL();
  c.Type = 1;            // CRED_TYPE_GENERIC
  c.Persist = 2;         // CRED_PERSIST_LOCAL_MACHINE: this Windows user on this PC, survives sign-out
  c.TargetName = target;
  c.UserName = user;
  c.CredentialBlobSize = b.Length;
  c.CredentialBlob = Marshal.AllocHGlobal(b.Length);
  try {
    Marshal.Copy(b, 0, c.CredentialBlob, b.Length);
    if (!CredWrite(ref c, 0)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  } finally { Marshal.FreeHGlobal(c.CredentialBlob); }
}
'@ -UsingNamespace System.Runtime.InteropServices

Write-Host ''
Write-Host 'Core Work Hub - connect to Service Desk Plus Cloud (read-only)' -ForegroundColor Cyan
Write-Host "Zoho accounts server: $AccountsUrl"
Write-Host 'From the Zoho API Console -> Self Client -> Client Secret tab:'
$clientId = (Read-Host 'Client ID').Trim()
$clientSecret = (Read-Host 'Client Secret' -AsSecureString | ConvertFrom-SecureString -AsPlainText).Trim()
Write-Host 'From the Generate Code tab (scope SDPOnDemand.requests.READ):'
$code = (Read-Host 'Grant code').Trim()
if (-not $clientId -or -not $clientSecret -or -not $code) { throw 'Client ID, Client Secret and grant code are all needed.' }

$resp = Invoke-RestMethod -Method Post -Uri "$($AccountsUrl.TrimEnd('/'))/oauth/v2/token" -TimeoutSec 30 -Body @{
  grant_type    = 'authorization_code'
  client_id     = $clientId
  client_secret = $clientSecret
  code          = $code
}
$err = $resp.PSObject.Properties['error']
if ($err) {
  $hint = switch ($err.Value) {
    'invalid_code'   { 'The grant code expired or was already used. Generate a new one and run this again within a few minutes.' }
    'invalid_client' { 'Client ID/secret not recognised here. Check them, or your data centre: try -AccountsUrl https://accounts.zoho.eu (or .in, .com.au).' }
    default          { '' }
  }
  throw "Zoho refused: $($err.Value). $hint"
}
if (-not $resp.PSObject.Properties['refresh_token'] -or -not $resp.refresh_token) {
  throw 'Zoho returned no refresh token. Generate a NEW grant code (each code gives a refresh token once) and run this again.'
}

$secret = @{
  kind          = 'zoho'
  accounts      = $AccountsUrl.TrimEnd('/')
  client_id     = $clientId
  client_secret = $clientSecret
  refresh_token = $resp.refresh_token
} | ConvertTo-Json -Compress
[CoreWorkHub.CredWriter]::Write($CredentialName, 'zoho-oauth', $secret)

Write-Host ''
Write-Host "Connected. Stored in Windows Credential Manager as '$CredentialName' (this Windows user only)." -ForegroundColor Green
if ($resp.PSObject.Properties['api_domain']) { Write-Host "Zoho API domain for this account: $($resp.api_domain)" }
Write-Host 'Next: run Sync-ServiceDesk.ps1 with -Edition Cloud -Test (see ADMIN-GUIDE step 6).'
