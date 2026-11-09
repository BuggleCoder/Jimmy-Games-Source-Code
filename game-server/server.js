const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const players = {};

wss.on('connection', (ws) => {
    const playerId = Math.random().toString(36).substring(2, 9);

    players[playerId] = {
        id: playerId,
        ws,
        connected: true
    };

    console.log(`Player connected: ${playerId}`);

    ws.send(JSON.stringify({
        type: 'init',
        id: playerId
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log(`${playerId}:`, data);

            switch (data.type) {
                case 'turn':
                    break;
                case 'chat':
                    break;
                case 'action':
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (err) {
            console.error('Invalid message:', err);
        }
    });

    ws.on('close', () => {
        console.log(`Player disconnected: ${playerId}`);
        delete players[playerId];
    });

    ws.on('error', (err) => {
        console.error(`Player ${playerId} error:`, err);
    });
});

function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function getPlayers() {
    return Object.keys(players).map(id => ({
        id,
        connected: players[id].connected
    }));
}

const TICK_RATE = 30;

setInterval(() => {
    broadcast({
        type: 'state',
        players: getPlayers()
    });
}, 1000 / TICK_RATE);

console.log('Server running on port 8080');
