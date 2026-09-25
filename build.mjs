// Copies public/ to dist/ and fills in your domain and site name.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BASE = (process.env.BASE_URL || process.env.URL || 'http://localhost:8888').replace(/\/$/, '');
const NAME = (process.env.SITE_NAME || 'Orlando Call Map').replace(/[<>&"]/g, '');

// Fingerprint scripts and styles. Links become /styles.css?v=<hash>, so whenever a file changes,
// every browser downloads the new copy instead of reusing an old saved one.
const assets = fs.readdirSync('public').filter((f) => /\.(js|css)$/.test(f)).sort();
const VERSION = crypto.createHash('sha1').update(assets.map((f) => fs.readFileSync(path.join('public', f))).join('\n')).digest('hex').slice(0, 10);
fs.writeFileSync('src/asset-version.js', `// Overwritten by build.mjs on every deploy.\nexport default '${VERSION}';\n`);

fs.rmSync('dist', { recursive: true, force: true });
fs.cpSync('public', 'dist', { recursive: true });
for (const f of fs.readdirSync('dist')) {
  if (!f.endsWith('.html')) continue;
  const p = path.join('dist', f);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll('{{BASE_URL}}', BASE).replaceAll('Orlando Call Map', NAME)
    .replace(/(href|src)="\/([\w-]+\.(?:css|js))"/g, `$1="/$2?v=${VERSION}"`));
}
// ads.txt tells ad buyers your AdSense account is authorized to sell ads on this site
const client = (process.env.ADSENSE_CLIENT || '').trim();
if (client) fs.writeFileSync('dist/ads.txt', `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);
console.log(`Built dist/ for ${BASE}${client ? ' (ads on)' : ''}, assets v=${VERSION}`);
