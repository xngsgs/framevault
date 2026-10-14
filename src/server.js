import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createStore } from './store.js';
import { HttpError } from './validation.js';
import { aiConfig, suggestTags } from './ai.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
const DEMO = ['portrait', 'moon', 'signal', 'coast', 'outfit', 'garden'];

async function readJson(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Use application/json');
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 15 * 1024 * 1024) throw new HttpError(413, 'Request is too large');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'Invalid JSON'); }
}

export function createApp({ dataDir = process.env.FRAMEVAULT_DATA_DIR || join(root, 'data'), ai = aiConfig(), fetcher = fetch } = {}) {
  const store = createStore(dataDir);
  const busy = new Set();
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    function json(status, body) {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    }
    function serve(path, mime) {
      if (!existsSync(path)) throw new HttpError(404, 'File not found');
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
      res.end(readFileSync(path));
    }
    try {
      const host = req.headers.host || '';
      if (!/^127\.0\.0\.1:\d+$/.test(host) && !/^localhost:\d+$/.test(host)) throw new HttpError(403, 'Localhost access only');
      const origin = req.headers.origin;
      if (origin && origin !== `http://${host}` || req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'Cross-site requests are not allowed');
      const url = new URL(req.url, `http://${host}`);
      const filters = Object.fromEntries(['q','project','type','status'].map(key => [key, url.searchParams.get(key) || '']));
      if (req.method === 'GET') {
        if (url.pathname === '/api/health') return json(200, { ok: true, version: '0.1.0', aiEnabled: !!(ai.key && ai.model), aiProvider: ai.key && ai.model ? new URL(ai.base).origin : null });
        if (url.pathname === '/api/assets') return json(200, { assets: store.list(filters) });
        if (url.pathname === '/api/manifest') {
          res.setHeader('Content-Disposition', 'attachment; filename="framevault-manifest.json"');
          return json(200, store.manifest(filters));
        }
        const single = /^\/api\/assets\/([a-f0-9-]{36})$/.exec(url.pathname);
        if (single) return json(200, store.get(single[1]));
        const staticFiles = { '/': ['index.html','text/html; charset=utf-8'], '/app.js': ['app.js','text/javascript; charset=utf-8'], '/styles.css': ['styles.css','text/css; charset=utf-8'] };
        if (staticFiles[url.pathname]) { const [file, mime] = staticFiles[url.pathname]; return serve(join(root,'public',file), mime); }
        const demo = /^\/demo\/([a-z]+)\.svg$/.exec(url.pathname);
        if (demo && DEMO.includes(demo[1])) return serve(join(root,'public','demo',`${demo[1]}.svg`), 'image/svg+xml');
        const media = /^\/media\/([a-f0-9]{64}\.(png|jpg|webp))$/.exec(url.pathname);
        if (media) return serve(join(store.media, media[1]), MIME[media[2]]);
      }
      if (req.method === 'POST' && url.pathname === '/api/assets') return json(201, store.create(await readJson(req)));
      if (req.method === 'POST' && url.pathname === '/api/demo') { await readJson(req); return json(201, { assets: store.seed() }); }
      const action = /^\/api\/assets\/([a-f0-9-]{36})(?:\/(versions|suggest-tags))?$/.exec(url.pathname);
      if (action) {
        const [, id, suffix] = action;
        if (req.method === 'PATCH' && !suffix) return json(200, store.update(id, await readJson(req)));
        if (req.method === 'POST' && suffix === 'versions') return json(201, store.addVersion(id, await readJson(req)));
        if (req.method === 'POST' && suffix === 'suggest-tags') {
          await readJson(req);
          if (busy.has(id)) throw new HttpError(409, 'This asset already has an AI request running');
          if (busy.size >= 2) throw new HttpError(429, 'Please wait for another AI request to finish');
          busy.add(id);
          try { return json(200, await suggestTags(store.get(id), store.media, ai, fetcher)); }
          finally { busy.delete(id); }
        }
      }
      throw new HttpError(404, 'Not found');
    } catch (error) {
      if (!res.headersSent) json(error.status || 500, { error: error.status ? error.message : 'Internal server error' });
    }
  });
  server.requestTimeout = 60000;
  server.headersTimeout = 10000;
  return { server, store };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 4317);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  const { server, store } = createApp();
  server.on('error', error => { console.error(`FrameVault: ${error.message}`); store.close(); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`FrameVault v0.1.0\nLocal: http://127.0.0.1:${port}\nYour library is stored locally. Press Ctrl+C to stop.`));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
}
