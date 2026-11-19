// Regenerates deploy/hub-config.json (the starter config shipped in the package) from src/model/config.ts.
// Run: npx vite-node scripts/write-config.mts
import { writeFileSync } from 'node:fs';
import { defaultConfig } from '../src/model/config';
import { DEFAULT_STANDARD } from '../src/model/comms';

const c = defaultConfig();
// Fields the admin fills in (see ADMIN-GUIDE.md section 4).
c.people = c.people.map((p) => ({ ...p, sdName: p.sdName ?? '', email: '' }));
c.teamsChannelUrl = '';
c.commStandard = { ...DEFAULT_STANDARD };
writeFileSync('deploy/hub-config.json', JSON.stringify(c, null, 2) + '\n');
console.log('deploy/hub-config.json written');
