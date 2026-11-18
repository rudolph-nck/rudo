#Requires -Version 7.0
<#
.SYNOPSIS
  Day-one check: does our Wrike license let the API read the tasks we need? Read-only; writes nothing.
  Store the permanent token once with:  cmdkey /generic:CoreWorkHub-Wrike /user:token /pass:<token>
  If any check fails, v1 ships with Service Desk only and Wrike items are entered by hand in the hub.
#>
param([string] $CredentialName = 'CoreWorkHub-Wrike', [string] $Host_ = 'https://www.wrike.com')

Add-Type -Namespace CoreWorkHub -Name WCred -MemberDefinition @'
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct CREDENTIAL { public int Flags; public int Type; public string TargetName; public string Comment;
  public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob;
  public int Persist; public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName; }
[DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool CredRead(string t, int type, int f, out IntPtr c);
[DllImport("advapi32.dll")] public static extern void CredFree(IntPtr b);
public static string Read(string t) { IntPtr p; if (!CredRead(t, 1, 0, out p)) return null;
  try { var c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL)); return Marshal.PtrToStringUni(c.CredentialBlob, c.CredentialBlobSize / 2); } finally { CredFree(p); } }
'@ -UsingNamespace System.Runtime.InteropServices

$token = [CoreWorkHub.WCred]::Read($CredentialName)
if (-not $token) { throw "No credential '$CredentialName'. Run: cmdkey /generic:$CredentialName /user:token /pass:<token>" }
$h = @{ Authorization = "bearer $token" }
$checks = [ordered]@{
  'Account / token valid'     = '/api/v4/contacts?me=true'
  'Spaces'                    = '/api/v4/spaces'
  'Folders and projects'      = '/api/v4/folders?project=true'
  'Tasks (first page)'        = '/api/v4/tasks?pageSize=5&fields=["subTaskIds","responsibleIds"]'
}
$ok = $true
foreach ($c in $checks.GetEnumerator()) {
  try {
    $r = Invoke-RestMethod -Uri ($Host_ + $c.Value) -Headers $h -TimeoutSec 30
    Write-Host ("PASS  {0}  ({1} records)" -f $c.Key, @($r.data).Count)
  } catch {
    $ok = $false
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host ("FAIL  {0}  HTTP {1}: {2}" -f $c.Key, $code, $_.ErrorDetails.Message)
  }
}
if ($ok) { Write-Host 'Wrike API access looks good for Phase 2.' } else { Write-Host 'Wrike API is limited: ship v1 with Service Desk only and enter Wrike items by hand.' }
