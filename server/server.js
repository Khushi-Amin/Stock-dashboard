// Run this with: node server.js

const http = require('http');
const WebSocket = require('ws');

// Supported tickers
const SUPPORTED = ['GOOG', 'TSLA', 'AMZN', 'META', 'NVDA'];

// Initial price seeds
const basePrices = {
  GOOG: 2850,
  TSLA: 700,
  AMZN: 3300,
  META: 320,
  NVDA: 450
};

// Current simulated prices
const prices = { ...basePrices };

// Function to randomly update prices (random walk)
function tickPrices() {
  for (const t of SUPPORTED) {
    const drift = (Math.random() - 0.5) * 0.02;  // -1% to +1%
    const noise = (Math.random() - 0.5) * 2;     // ±1 random noise
    prices[t] = Math.max(1, +(prices[t] * (1 + drift) + noise).toFixed(2));
  }
}

// Create HTTP server (needed for WebSocket server to attach)
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Map each connected client => { email, subscriptions: Set }
const clients = new Map();

wss.on('connection', (ws) => {
  console.log('Client connected.');
  clients.set(ws, { email: null, subscriptions: new Set() });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      const meta = clients.get(ws);
      if (!meta) return;

      if (msg.type === 'login') {
        meta.email = msg.email || "anonymous";
        ws.send(JSON.stringify({ type: 'login_ack', email: meta.email }));

      } else if (msg.type === 'subscribe') {
        if (SUPPORTED.includes(msg.ticker)) {
          meta.subscriptions.add(msg.ticker);
          ws.send(JSON.stringify({ type: 'sub_ack', ticker: msg.ticker }));
        }

      } else if (msg.type === 'unsubscribe') {
        if (meta.subscriptions.has(msg.ticker)) {
          meta.subscriptions.delete(msg.ticker);
          ws.send(JSON.stringify({ type: 'unsub_ack', ticker: msg.ticker }));
        }

      } else if (msg.type === 'get_state') {
        const current = {};
        for (const t of meta.subscriptions) current[t] = prices[t];
        ws.send(JSON.stringify({ type: 'prices', prices: current }));
      }

    } catch (e) {
      console.log("Bad message from client", e);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected.');
    clients.delete(ws);
  });
});

// Broadcast updated prices every 1 second
setInterval(() => {
  tickPrices();

  for (const [ws, meta] of clients.entries()) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (meta.subscriptions.size === 0) continue;

    const payload = {};
    for (const t of meta.subscriptions) {
      payload[t] = prices[t];
    }

    ws.send(JSON.stringify({
      type: 'prices',
      prices: payload,
      ts: Date.now()
    }));
  }
}, 1000);

// Start server
const PORT = process.env.PORT || 4000;

server.listen(PORT, "0.0.0.0", () => {
    console.log("Price server running on port", PORT);
});

