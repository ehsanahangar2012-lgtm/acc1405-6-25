import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const directDist = resolve(scriptDir, 'dist');
const webRoot = existsSync(join(directDist, 'index.html')) ? directDist : resolve(scriptDir, '../dist');
const indexFile = join(webRoot, 'index.html');

if (!existsSync(indexFile)) {
  console.error('Browser preview files are missing. Build with: bun run build:browser-preview');
  process.exit(1);
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8'
};

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'"
};

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  let requestPath;
  try {
    requestPath = decodeURIComponent(new URL(request.url || '/', `http://${host}:${port}`).pathname);
  } catch {
    response.writeHead(400, securityHeaders);
    response.end('Bad request');
    return;
  }

  let filePath = resolve(webRoot, `.${requestPath}`);
  if (filePath !== webRoot && !filePath.startsWith(webRoot + sep)) {
    response.writeHead(403, securityHeaders);
    response.end('Forbidden');
    return;
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    if (extname(requestPath)) {
      response.writeHead(404, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    filePath = indexFile;
  }

  const contentType = mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream';
  response.writeHead(200, { ...securityHeaders, 'Content-Type': contentType });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(filePath).on('error', () => {
    if (!response.headersSent) response.writeHead(500, securityHeaders);
    response.end('Unable to read preview file');
  }).pipe(response);
});

server.on('error', (error) => {
  console.error(`Could not start browser preview on ${host}:${port}: ${error.message}`);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`AshkeGhalam browser preview: http://${host}:${port}`);
  console.log('Local-only mode active; remote API requests are blocked by Content-Security-Policy.');
  console.log('Press Ctrl+C to stop.');
});
