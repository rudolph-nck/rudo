// Builds the deployment zip: release/CoreWorkHub-v<version>.zip. Run after `npm run build`.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
if (!existsSync('dist/index.html')) throw new Error('Run `npm run build` first.');
const name = `CoreWorkHub-v${version}`;
const stage = join('build', 'package', name);
rmSync(join('build', 'package'), { recursive: true, force: true });
mkdirSync(join(stage, 'CoreWorkHub', 'changes'), { recursive: true });
mkdirSync(join(stage, 'Setup', 'sync'), { recursive: true });
mkdirSync(join(stage, 'CoreWorkHub', 'app'), { recursive: true });
mkdirSync(join(stage, 'CoreWorkHub', 'import'), { recursive: true });
writeFileSync(join(stage, 'CoreWorkHub', 'import', 'README.txt'), 'Drop the hourly Service Desk export here as "Core - All.csv" (Setup\\sync\\Register-ExportCopyTask.ps1 does it for you). Any open hub imports it automatically when it changes.\r\n');

cpSync('dist/index.html', join(stage, 'CoreWorkHub', 'index.html'));
cpSync('deploy/hub-config.json', join(stage, 'CoreWorkHub', 'hub-config.json'));
writeFileSync(join(stage, 'CoreWorkHub', 'changes', 'README.txt'), 'Each person\'s change file (<username>.jsonl) is created here by the hub. Do not edit or delete them: together they are the audit trail.\r\n');
// Python launcher: desktop icon → hub_server.py (local helper that reads and writes the shared folder)
for (const f of ['hub_server.py', 'Install-DesktopIcon.ps1', 'CoreWorkHub.ico']) cpSync(join('launcher', f), join(stage, 'CoreWorkHub', 'app', f));
for (const f of ['Core Work Hub.bat', 'Install desktop icon.bat']) cpSync(join('launcher', f), join(stage, 'CoreWorkHub', f));
for (const f of ['ADMIN-GUIDE.md', 'USER-GUIDE.md']) cpSync(join('deploy', f), join(stage, 'Setup', f));
for (const f of ['Sync-ServiceDesk.ps1', 'Connect-ZohoServiceDesk.ps1', 'Copy-ExportToHub.ps1', 'Register-ExportCopyTask.ps1', 'Register-SyncTask.ps1', 'Test-WrikeAccess.ps1']) cpSync(join('sync', f), join(stage, 'Setup', 'sync', f));
writeFileSync(join(stage, 'README.txt'), `Core Work Hub ${version}\r\n\r\nStart with Setup\\ADMIN-GUIDE.md. Copy the CoreWorkHub folder to the shared drive.\r\nEach person then double-clicks \"Install desktop icon.bat\" in that folder once (needs Python 3.8+).\r\n`);

mkdirSync('release', { recursive: true });
const zip = join('release', `${name}.zip`);
rmSync(zip, { force: true });
execSync(`cd build/package && zip -qr ../../${zip} ${name}`);
console.log(`${zip} written`);
