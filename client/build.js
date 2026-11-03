// Builds the static site into dist/. The server address comes from SCREENCAST_SERVER
// (environment variable, or client/.env if present) and is written into dist/config.js.
const fs = require('fs');
const path = require('path');

let server = process.env.SCREENCAST_SERVER;
const envFile = path.join(__dirname, '.env');
if (server === undefined && fs.existsSync(envFile)) {
  const line = fs.readFileSync(envFile, 'utf8').split(/\r?\n/).find((l) => /^\s*SCREENCAST_SERVER\s*=/.test(l));
  if (line) server = line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
}
server = (server || '').trim();

const dist = path.join(__dirname, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
['index.html', '_headers', 'logo'].forEach((f) => fs.cpSync(path.join(__dirname, f), path.join(dist, f), { recursive: true }));
fs.writeFileSync(path.join(dist, 'config.js'), 'window.SCREENCAST_SERVER = ' + JSON.stringify(server) + ';\n');
console.log('Built dist/ with server = ' + (server || '(empty: localhost fallback)'));
