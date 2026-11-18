// Copies the single-file build into release/ (the folder Nick copies to the shared drive).
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
mkdirSync('release', { recursive: true });
copyFileSync('dist/index.html', 'release/index.html');
console.log(`release/index.html  ${(statSync('release/index.html').size / 1024).toFixed(0)} KB`);
