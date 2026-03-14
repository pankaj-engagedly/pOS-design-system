import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 3001;
const GATEWAY_URL = 'http://127.0.0.1:8000';
const ROOT = path.resolve(import.meta.dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Proxy /api/* and /health to the gateway
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
    const proxyReq = http.request(
      `${GATEWAY_URL}${url.pathname}${url.search}`,
      {
        method: req.method,
        headers: { ...req.headers, host: '127.0.0.1:8000' },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );
    proxyReq.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end('{"detail":"Gateway unavailable"}');
    });
    req.pipe(proxyReq);
    return;
  }

  let urlPath = url.pathname;

  // SPA fallback: serve index.html for root
  if (urlPath === '/' || urlPath === '/index.html') {
    urlPath = '/frontend/shell/index.html';
  }

  const filePath = path.join(ROOT, urlPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(ROOT, 'frontend/shell/index.html'), (fallbackErr, fallbackData) => {
          if (fallbackErr) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(fallbackData);
        });
        return;
      }
      res.writeHead(500);
      res.end('Internal Server Error');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`pOS frontend → http://localhost:${PORT}`);
});
