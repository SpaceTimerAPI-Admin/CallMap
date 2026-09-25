// Copies public/ to dist/ and fills in your domain and site name.
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.BASE_URL || process.env.URL || 'http://localhost:8888').replace(/\/$/, '');
const NAME = (process.env.SITE_NAME || 'Orlando Call Map').replace(/[<>&"]/g, '');

fs.rmSync('dist', { recursive: true, force: true });
fs.cpSync('public', 'dist', { recursive: true });
for (const f of fs.readdirSync('dist')) {
  if (!f.endsWith('.html')) continue;
  const p = path.join('dist', f);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll('{{BASE_URL}}', BASE).replaceAll('Orlando Call Map', NAME));
}
console.log(`Built dist/ for ${BASE}`);
