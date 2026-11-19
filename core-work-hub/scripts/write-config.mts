// Regenerates deploy/hub-config.json from src/model/config.ts (run: npx vite-node scripts/write-config.mts).
import { writeFileSync } from 'node:fs';
import { defaultConfig } from '../src/model/config';
writeFileSync('deploy/hub-config.json', JSON.stringify(defaultConfig(), null, 2) + '\n');
