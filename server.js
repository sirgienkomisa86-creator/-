// Relay-сервер лобби для ХУГ СГО. Запуск: npm install && npm start
// Порт берётся из переменной PORT (Render/Railway/Fly задают её сами).
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const MAX_PLAYERS = +process.env.MAX_PLAYERS || 16;
const TICK_MS = 50;            // рассылка ~20 раз/с
const MAX_MSG = 4096;          // байт на сообщение
const BAD = new Set(['__proto__', 'constructor', 'prototype']);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end('hug-sgo lobby OK, players: ' + clients.size + '\n');
});
const wss = new WebSocketServer({ server, maxPayload: MAX_MSG });

let nextId = 1;
const clients = new Map();     // id -> { ws, pres, dirty, msgs, t }
const gone = new Set();

function clean(v, depth = 0) {
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.slice(0, 64);
  if (depth > 3) return null;
  if (Array.isArray(v)) return v.slice(0, 16).map(x => clean(x, depth + 1));
  if (typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).slice(0, 32)) if (!BAD.has(k)) o[k] = clean(v[k], depth + 1);
    return o;
  }
  return null;
}

wss.on('connection', ws => {
  if (clients.size >= MAX_PLAYERS) { ws.close(1013, 'full'); return; }
  const id = 'p' + (nextId++);
  const c = { ws, pres: {}, dirty: false, msgs: 0, t: Date.now() };
  clients.set(id, c);
  // hello + текущий снимок всех игроков
  const snap = {};
  for (const [pid, pc] of clients) if (pid !== id) snap[pid] = pc.pres;
  ws.send(JSON.stringify({ t: 'hello', id, peers: snap }));

  ws.on('message', raw => {
    const now = Date.now();
    if (now - c.t > 1000) { c.t = now; c.msgs = 0; }
    if (++c.msgs > 60) return;                       // антифлуд
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || m.t !== 'p' || typeof m.d !== 'object' || !m.d) return;
    const d = clean(m.d);
    const next = Object.assign({}, c.pres, d);       // новый объект => клиент видит изменение
    if (JSON.stringify(next).length > 2048) return;
    c.pres = next; c.dirty = true;
  });
  const drop = () => { if (clients.delete(id)) gone.add(id); };
  ws.on('close', drop); ws.on('error', drop);
});

setInterval(() => {
  const upd = {};
  let any = false;
  for (const [id, c] of clients) if (c.dirty) { upd[id] = c.pres; c.dirty = false; any = true; }
  if (!any && !gone.size) return;
  const msg = { t: 'u', upd, gone: [...gone] };
  gone.clear();
  for (const [id, c] of clients) {
    if (c.ws.readyState !== 1) continue;
    // не отправляем игроку его же состояние
    const own = id in upd ? Object.assign({}, upd) : upd;
    if (own !== upd) delete own[id];
    c.ws.send(JSON.stringify({ t: 'u', upd: own, gone: msg.gone }));
  }
}, TICK_MS);

// пинг, чтобы хостинг не рвал неактивные соединения
setInterval(() => { for (const c of clients.values()) if (c.ws.readyState === 1) c.ws.ping(); }, 25000);

server.listen(PORT, () => console.log('Lobby on :' + PORT));
