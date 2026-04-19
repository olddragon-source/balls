/**
 * Serves the static folder over HTTP (optional: LAN access for phones on the same Wi-Fi).
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function safeJoin(rel) {
  const base = path.resolve(root);
  const target = path.resolve(base, rel);
  const relToBase = path.relative(base, target);
  if (relToBase.startsWith('..') || path.isAbsolute(relToBase)) return null;
  return target;
}

/** @param {number} port */
function printListenUrls(port) {
  console.log(`This PC:    http://127.0.0.1:${port}/`);
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const ni of list) {
      const fam = ni.family;
      const isV4 = fam === 'IPv4' || fam === 4;
      if (isV4 && !ni.internal) {
        console.log(`LAN / phone: http://${ni.address}:${port}/`);
      }
    }
  }
  console.log('Stop: Ctrl+C');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) {
      rel = rel === '' ? 'index.html' : `${rel}index.html`;
    }
    const filePath = safeJoin(rel);
    if (!filePath) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.writeHead(200).end(data);
  } catch (e) {
    if (/** @type {NodeJS.ErrnoException} */ (e).code === 'ENOENT') {
      res.writeHead(404).end('Not found');
    } else {
      res.writeHead(500).end('Server error');
    }
  }
});

const requestedPort = Number(process.env.PORT) || 5173;
const host = process.env.HOST || '0.0.0.0';
let currentPort = requestedPort;
let listenAttempt = 0;

function listenOn(port) {
  currentPort = port;
  listenAttempt += 1;
  const attemptId = listenAttempt;
  server.listen(port, host, () => {
    if (attemptId !== listenAttempt) return;
    console.log('Lines - open in a browser:');
    printListenUrls(port);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && !process.env.PORT) {
    const nextPort = currentPort + 1;
    console.log(`Port ${currentPort} is busy, trying ${nextPort}...`);
    listenOn(nextPort);
    return;
  }

  throw err;
});

listenOn(requestedPort);
