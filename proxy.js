// Local relay for the SMS gateway UI.  Run:  node proxy.js   (leave it running)
//
// Why it exists: ngrok's free tier answers requests from a browser with its
// "you are about to visit..." warning page instead of your gateway's JSON, and
// the browser can't send the SmsSkipBrowserWarning header past the gateway's
// CORS policy.  A native client (Dart, curl) is unaffected.  This relay runs on
// the PC, adds the skip header, and returns plain CORS so the page can call it.
const http = require('http');
const https = require('https');

const PORT = 3000;

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  const target = new URL(req.url, 'http://x').searchParams.get('target');
  if (!target) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end('{"error":"missing target"}');
  }

  let t;
  try { t = new URL(target); } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end('{"error":"bad target"}');
  }

  const headers = { 'ngrok-skip-browser-warning': 'true' };
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
  if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'];

  const body = [];
  req.on('data', c => body.push(c));
  req.on('end', () => {
    const mod = t.protocol === 'https:' ? https : http;
    const up = mod.request({
      hostname: t.hostname,
      port: t.port || (t.protocol === 'https:' ? 443 : 80),
      path: t.pathname + t.search,
      method: req.method,
      headers,
    }, r => {
      res.writeHead(r.statusCode, { 'Content-Type': r.headers['content-type'] || 'application/json' });
      r.pipe(res);
    });
    up.on('error', e => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    });
    up.end(Buffer.concat(body));
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`SMS relay running on http://127.0.0.1:${PORT}`);
});
