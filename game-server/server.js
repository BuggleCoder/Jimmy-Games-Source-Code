const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const players = {};

wss.on('connection', (ws) => {
    const playerId = Math.random().toString(36).substring(2, 9);
    players[playerId] = {deck: []};
    
    console.log(`Player connected: ${playerId}`);

    ws.send(JSON.stringify({ type: 'init', id: playerId }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'move' && players[playerId]) {
                players[playerId].x += data.dx;
                players[playerId].y += data.dy;
            }
        } catch (err) {
            console.error('Invalid message received:', err);
        }
    });

    ws.on('close', () => {
        console.log(`Player disconnected: ${playerId}`);
        delete players[playerId];
    });
});

const TICK_RATE = 30;
setInterval(() => {
    const gameState = JSON.stringify({
        type: 'state',
        players: players
    });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(gameState);
        }
    });
}, 1000 / TICK_RATE);

console.log('Game server running on ws://localhost:8080');
