// Screen Cast signaling server. Video goes directly between browsers (WebRTC);
// this server only introduces them to each other and serves the web page.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const MAX_ROOMS = parseInt(process.env.MAX_ROOMS || '200', 10);
const MAX_VIEWERS = parseInt(process.env.MAX_VIEWERS || '20', 10);

// Default: free public STUN. For strict corporate/school networks add a TURN server:
// ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:HOST:3478","username":"u","credential":"p"}]'
let ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
if (process.env.ICE_SERVERS) {
  try { ICE = JSON.parse(process.env.ICE_SERVERS); } catch (e) { console.error('ICE_SERVERS is not valid JSON, using defaults'); }
}

const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
const HEAD = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' };

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, HEAD));
    res.end(html);
  } else if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
const rooms = new Map();   // code -> { host, passHash, hasPass, viewers:Map, nextId }
const fails = new Map();   // ip -> { n, t }

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const ROOM_RE = /^[a-z0-9][a-z0-9-]{2,31}$/;
const WINDOW = 5 * 60 * 1000;

function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function ipOf(req) { return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress; }
function blocked(ip) { const f = fails.get(ip); return !!f && f.n >= 10 && Date.now() - f.t < WINDOW; }
function noteFail(ip) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.t >= WINDOW) fails.set(ip, { n: 1, t: Date.now() }); else f.n++;
}
function err(ws, code, msg) { send(ws, { t: 'error', code, msg }); }

function onHost(ws, m) {
  if (ws.role) return;
  const room = String(m.room || '').toLowerCase().trim();
  const pass = String(m.pass || '').slice(0, 64);
  if (!ROOM_RE.test(room)) return err(ws, 'bad-request', 'Room code must be 3-32 letters, numbers or dashes.');
  if (rooms.has(room)) return err(ws, 'busy', 'That room code is already in use. Pick another.');
  if (rooms.size >= MAX_ROOMS) return err(ws, 'busy', 'Server is busy. Try again later.');
  rooms.set(room, { host: ws, passHash: sha(pass), hasPass: pass.length > 0, viewers: new Map(), nextId: 1 });
  ws.role = 'host';
  ws.room = room;
  send(ws, { t: 'hosting', room, ice: ICE });
}

function onJoin(ws, m) {
  if (ws.role) return;
  if (blocked(ws.ip)) return err(ws, 'blocked', 'Too many wrong attempts. Wait a few minutes.');
  const room = String(m.room || '').toLowerCase().trim();
  const pass = String(m.pass || '').slice(0, 64);
  const r = rooms.get(room);
  if (!r) { noteFail(ws.ip); return err(ws, 'no-room', 'Room not found. Check the code, and make sure the host has started sharing.'); }
  if (r.hasPass) {
    if (!pass) return err(ws, 'need-pass', 'This room needs a password.');
    if (!crypto.timingSafeEqual(sha(pass), r.passHash)) { noteFail(ws.ip); return err(ws, 'bad-pass', 'Wrong password.'); }
  }
  if (r.viewers.size >= MAX_VIEWERS) return err(ws, 'full', 'This room is full.');
  const id = String(r.nextId++);
  ws.role = 'viewer';
  ws.room = room;
  ws.id = id;
  r.viewers.set(id, ws);
  send(ws, { t: 'joined', id, ice: ICE });
  send(r.host, { t: 'viewer', id, count: r.viewers.size });
}

function onSig(ws, m) {
  const r = rooms.get(ws.room);
  if (!r) return;
  if (ws.role === 'host') send(r.viewers.get(String(m.to)), { t: 'sig', data: m.data });
  else if (ws.role === 'viewer') send(r.host, { t: 'sig', from: ws.id, data: m.data });
}

function onClose(ws) {
  const r = rooms.get(ws.room);
  if (!r) return;
  if (ws.role === 'host' && r.host === ws) {
    r.viewers.forEach((v) => { send(v, { t: 'ended' }); try { v.close(); } catch (e) {} });
    rooms.delete(ws.room);
  } else if (ws.role === 'viewer' && r.viewers.get(ws.id) === ws) {
    r.viewers.delete(ws.id);
    send(r.host, { t: 'gone', id: ws.id, count: r.viewers.size });
  }
}

wss.on('connection', (ws, req) => {
  ws.ip = ipOf(req);
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'host') onHost(ws, m);
    else if (m.t === 'join') onJoin(ws, m);
    else if (m.t === 'sig') onSig(ws, m);
  });
  ws.on('close', () => onClose(ws));
  ws.on('error', () => {});
});

setInterval(() => {
  wss.clients.forEach((ws) => { if (!ws.alive) return ws.terminate(); ws.alive = false; try { ws.ping(); } catch (e) {} });
  const now = Date.now();
  fails.forEach((f, ip) => { if (now - f.t >= WINDOW) fails.delete(ip); });
}, 25000);

server.listen(PORT, () => console.log('Screen Cast running on port ' + PORT));
