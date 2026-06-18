const http = require('http');
const httpProxy = require('http-proxy');

const TARGET = 'http://65.109.89.88:7777';
const PORT = 7778;

const proxy = httpProxy.createProxyServer({
  target: TARGET,
  changeOrigin: true,
});

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  proxy.web(req, res, {}, (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(502);
    res.end('Bad Gateway');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CORS proxy running on http://localhost:${PORT} → ${TARGET}`);
});
