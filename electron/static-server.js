// electron/static-server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8',
};

function createStaticServer(rootDir, targetPort) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // Allow CORS for local desktop shell
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
        return;
      }

      const parsedUrl = url.parse(req.url);
      let pathname = decodeURIComponent(parsedUrl.pathname || '/');

      // Prevent directory traversal
      const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
      let filePath = path.join(rootDir, safePath);

      // Check file resolution candidates
      function resolveFile(candidate) {
        try {
          if (fs.existsSync(candidate)) {
            const stat = fs.statSync(candidate);
            if (stat.isFile()) return candidate;
            if (stat.isDirectory()) {
              const indexFile = path.join(candidate, 'index.html');
              if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
                return indexFile;
              }
            }
          }
        } catch (e) {}
        return null;
      }

      let resolved = resolveFile(filePath);

      // Next.js static export route conventions: /dashboard -> /dashboard.html
      if (!resolved && !path.extname(filePath)) {
        resolved = resolveFile(filePath + '.html');
      }

      // SPA fallback to index.html for client-side routing
      if (!resolved) {
        resolved = resolveFile(path.join(rootDir, 'index.html'));
      }

      if (!resolved) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(resolved).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      try {
        const fileStream = fs.createReadStream(resolved);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
        });
        if (req.method === 'HEAD') {
          res.end();
        } else {
          fileStream.pipe(res);
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });

    server.on('error', reject);

    // Bind to fixed port on 127.0.0.1 (default 24888) to preserve origin across launches
    const bindPort = targetPort || parseInt(process.env.PCC_PORT || '24888', 10);
    server.listen(bindPort, '127.0.0.1', () => {
      const port = server.address().port;
      const serverUrl = `http://127.0.0.1:${port}`;
      resolve({
        server,
        port,
        url: serverUrl,
        close: () => new Promise((cb) => server.close(cb)),
      });
    });
  });
}

module.exports = { createStaticServer };
