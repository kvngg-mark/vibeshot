// Minimal matchmaker server (run: npm i ws uuid)
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: 3000 });
const queue = new Map(); // playerId -> ws

wss.on('connection', (ws) => {
  ws.id = uuidv4();

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'find_match') {
      // If someone waiting, pair them
      const waiting = [...queue.values()].find(s => s !== ws);
      if (!waiting) {
        queue.set(ws.id, ws);
        ws.send(JSON.stringify({ type: 'queued', playerId: ws.id }));
      } else {
        queue.delete(waiting.id);
        const sessionId = uuidv4();
        waiting.send(JSON.stringify({ type: 'match_found', sessionId, opponentId: ws.id }));
        ws.send(JSON.stringify({ type: 'match_found', sessionId, opponentId: waiting.id }));
      }
    }
    // handle other messages (cancel, heartbeat, etc.)
  });

  ws.on('close', () => queue.delete(ws.id));
});

const ws = new WebSocket('ws://localhost:3000');
ws.onopen = () => ws.send(JSON.stringify({ type: 'find_match' }));
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type === 'queued') console.log('queued', msg.playerId);
  if (msg.type === 'match_found') console.log('matched', msg);
  // on match_found -> connect to game server or start peer session
};