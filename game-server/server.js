const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
    const cleanUrl = req.url.split('?')[0];
    const filePath = path.join(__dirname, '..', 'main', cleanUrl === '/' ? 'index.html' : cleanUrl);

    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg'
    };

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            console.error('Could not find:', filePath);
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
});

const wss = new WebSocket.Server({ server });

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

server.listen(8080, () => {
    console.log('Game and WebSocket server running on port 8080');
});
