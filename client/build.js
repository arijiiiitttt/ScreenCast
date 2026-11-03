// Writes config.js from SCREENCAST_SERVER (environment variable, or client/.env if present).
const fs = require('fs');
const path = require('path');

let server = process.env.SCREENCAST_SERVER;
const envFile = path.join(__dirname, '.env');
if (server === undefined && fs.existsSync(envFile)) {
  const line = fs.readFileSync(envFile, 'utf8').split(/\r?\n/).find((l) => /^\s*SCREENCAST_SERVER\s*=/.test(l));
  if (line) server = line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
}
server = (server || '').trim();
fs.writeFileSync(path.join(__dirname, 'config.js'), 'window.SCREENCAST_SERVER = ' + JSON.stringify(server) + ';\n');
console.log('config.js written, server = ' + (server || '(empty: localhost fallback)'));
