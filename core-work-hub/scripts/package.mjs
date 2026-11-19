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

cpSync('dist/index.html', join(stage, 'CoreWorkHub', 'index.html'));
cpSync('deploy/hub-config.json', join(stage, 'CoreWorkHub', 'hub-config.json'));
writeFileSync(join(stage, 'CoreWorkHub', 'changes', 'README.txt'), 'Each person\'s change file (<username>.jsonl) is created here by the hub. Do not edit or delete them: together they are the audit trail.\r\n');
for (const f of ['ADMIN-GUIDE.md', 'USER-GUIDE.md']) cpSync(join('deploy', f), join(stage, 'Setup', f));
for (const f of ['Sync-ServiceDesk.ps1', 'Register-SyncTask.ps1', 'Test-WrikeAccess.ps1']) cpSync(join('sync', f), join(stage, 'Setup', 'sync', f));
writeFileSync(join(stage, 'README.txt'), `Core Work Hub ${version}\r\n\r\nStart with Setup\\ADMIN-GUIDE.md. Copy the CoreWorkHub folder to the shared drive.\r\n`);

mkdirSync('release', { recursive: true });
const zip = join('release', `${name}.zip`);
rmSync(zip, { force: true });
execSync(`cd build/package && zip -qr ../../${zip} ${name}`);
console.log(`${zip} written`);
