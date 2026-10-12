// Réinjecte les dessins isométriques générés par iso.mjs entre les marqueurs
// <!-- iso:nom --> … <!-- /iso --> de index.html.   Usage : node tools/inject.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const file = root + 'index.html';
const html = readFileSync(file, 'utf8').replace(/<!-- iso:(\w+) -->[\s\S]*?<!-- \/iso -->/g, (_, name) => {
  const svg = execFileSync('node', [root + 'tools/iso.mjs', name], { encoding: 'utf8' }).trim();
  return `<!-- iso:${name} -->${svg}<!-- /iso -->`;
});
writeFileSync(file, html);
console.log('dessins injectés');
