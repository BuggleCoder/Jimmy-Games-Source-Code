
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const MAX_MESSAGES = 100;
const TICK_RATE = 30;

const chatHistory = [];
const players = {};

const server = http.createServer((req, res) => {
    const cleanUrl = decodeURIComponent(req.url.split('?')[0]);

    const requestedFile = cleanUrl === '/'
        ? 'index.html'
        : cleanUrl.replace(/^\/+/, '');

    const mainDir = path.resolve(__dirname, '..', 'main');
    const filePath = path.resolve(mainDir, requestedFile);

    if (!filePath.startsWith(mainDir + path.sep) && filePath !== mainDir) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.json': 'application/json'
    };

    fs.readFile(filePath, (err, content) => {
        if (err) {
            console.error('Could not find:', filePath);
            res.writeHead(404);
            res.end('File not found');
            return;
        }

        const ext = path.extname(filePath);

        res.writeHead(200, {
            'Content-Type': mimeTypes[ext] || 'application/octet-stream'
        });

        res.end(content);
    });
});

const wss = new WebSocket.Server({ server });

function broadcast(data) {
    const message = JSON.stringify(data);

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function getPlayers() {
    return Object.values(players).map(player => ({
        id: player.id,
        connected: player.connected
    }));
}

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

    console.log(`Sending ${chatHistory.length} saved messages`);

    ws.send(JSON.stringify({
        type: 'history',
        messages: chatHistory
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());

            console.log(`${playerId}:`, data);

            switch (data.type) {
                case 'chat': {
                    if (typeof data.text !== 'string') break;

                    const text = data.text.trim().slice(0, 500);

                    if (!text) break;

                    const chatMessage = {
                        type: 'chat',
                        id: playerId,
                        text,
                        timestamp: Date.now()
                    };

                    chatHistory.push(chatMessage);

                    if (chatHistory.length > MAX_MESSAGES) {
                        chatHistory.shift();
                    }

                    console.log('Broadcasting:', text);

                    broadcast(chatMessage);
                    break;
                }

                case 'turn':
                    break;

                case 'action':
                    break;

                default:
                    console.log('Unknown message type:', data.type);
            }

        } catch (error) {
            console.error('Invalid message:', error);
        }
    });

    ws.on('close', () => {
        console.log(`Player disconnected: ${playerId}`);
        delete players[playerId];
    });

    ws.on('error', (error) => {
        console.error(`Player ${playerId} error:`, error);
    });
});

setInterval(() => {
    broadcast({
        type: 'state',
        players: getPlayers()
    });
}, 1000 / TICK_RATE);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Game and WebSocket server running on port ${PORT}`);
});
