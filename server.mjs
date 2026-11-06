import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 45116);
const LIVE = 'https://hackney-stone.emergent.host';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json',
};

function send(res, code, body, headers = {}) {
  res.writeHead(code, headers);
  res.end(body);
}

function proxyApi(req, res) {
  const url = LIVE + req.url;
  const lib = url.startsWith('https') ? https : http;
  const headers = { ...req.headers, host: 'hackney-stone.emergent.host' };
  delete headers['accept-encoding'];
  const p = lib.request(url, { method: req.method, headers }, (up) => {
    const h = { ...up.headers };
    // allow local page to read
    // same-origin local proxy — no CORS header needed
    res.writeHead(up.statusCode || 502, h);
    up.pipe(res);
  });
  p.on('error', (e) => send(res, 502, 'Bad gateway: ' + e.message));
  req.pipe(p);
}

function safeJoin(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const clean = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  return path.join(ROOT, clean);
}

const server = http.createServer((req, res) => {
  const u = req.url || '/';
  if (u.startsWith('/api/')) return proxyApi(req, res);

  let filePath = safeJoin(u === '/' ? '/index.html' : u);
  // directory → index
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback for client routes
    if (!path.extname(u.split('?')[0])) {
      filePath = path.join(ROOT, 'index.html');
    } else {
      return send(res, 404, 'Not found');
    }
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 500, 'Error');
    send(res, 200, data, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('FF local copy http://127.0.0.1:' + PORT);
});
