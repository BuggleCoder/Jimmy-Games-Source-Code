const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const players = {};

function createAndDistributeDeck(numPlayers, cardsPerPlayer = null) {
  const suits = ["Hearts", "Diamonds", "Clubs", "Spades"];
  const values = [
    "Ace", "2", "3", "4", "5", "6", "7", 
    "8", "9", "10", "Jack", "Queen", "King"
  ];
  
  let deck = [];
  for (let suit of suits) {
    for (let value of values) {
      deck.push({ value, suit });
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const players = Array.from({ length: numPlayers }, () => []);
  
  const maxCards = cardsPerPlayer || Math.floor(deck.length / numPlayers);

  for (let i = 0; i < maxCards; i++) {
    for (let p = 0; p < numPlayers; p++) {
      if (deck.length > 0) {
        players[p].push(deck.pop());
      }
    }
  }

  return { players, remainingDeck: deck };
}

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
