const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret_in_production";
const MAX_MESSAGES = 100;
const TICK_RATE = 30;

const chatHistory = [];
const players = {};
const usersDB = {};

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const cleanUrl = decodeURIComponent(req.url.split("?")[0]);

  if (req.method === "POST" && cleanUrl === "/api/register") {
    try {
      const { username, password } = await parseJsonBody(req);
      if (!username || !password) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Username and password required" }));
      }

      const cleanName = username.trim().slice(0, 25);
      if (usersDB[cleanName.toLowerCase()]) {
        res.writeHead(409, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Username already taken" }));
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      usersDB[cleanName.toLowerCase()] = {
        username: cleanName,
        password: hashedPassword,
        savedScore: 0,
      };

      res.writeHead(201, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Registered successfully" }));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid request body" }));
    }
  }

  if (req.method === "POST" && cleanUrl === "/api/login") {
    try {
      const { username, password } = await parseJsonBody(req);
      const user = usersDB[username?.trim().toLowerCase()];

      if (!user || !(await bcrypt.compare(password, user.password))) {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid credentials" }));
      }

      const token = jwt.sign({ username: user.username }, JWT_SECRET, {
        expiresIn: "24h",
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ token, username: user.username }));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid request body" }));
    }
  }

  const requestedFile =
    cleanUrl === "/" ? "index.html" : cleanUrl.replace(/^\/+/, "");

  const mainDir = path.resolve(__dirname, "..", "main");
  const filePath = path.resolve(mainDir, requestedFile);

  if (!filePath.startsWith(mainDir + path.sep) && filePath !== mainDir) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const mimeTypes = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".json": "application/json",
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      console.error("Could not find:", filePath);
      res.writeHead(404);
      res.end("File not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
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
  return Object.values(players).map((player) => ({
    id: player.id,
    username: player.username,
    connected: player.connected,
    isGuest: player.isGuest,
  }));
}

wss.on("connection", (ws, req) => {
  const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const token = urlParams.get("token");

  let authenticatedUser = null;

  if (token) {
    try {
      authenticatedUser = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      ws.close(4001, "Invalid or expired token");
      return;
    }
  }

  const playerId = Math.random().toString(36).substring(2, 9);
  const isGuest = !authenticatedUser;
  const username = authenticatedUser ? authenticatedUser.username : `Guest_${playerId}`;

  players[playerId] = {
    id: playerId,
    username,
    ws,
    connected: true,
    isGuest,
    score: authenticatedUser ? usersDB[username.toLowerCase()]?.savedScore || 0 : 0,
  };

  console.log(`Player connected: ${playerId} (${username})`);

  ws.send(
    JSON.stringify({
      type: "init",
      id: playerId,
      username,
      isGuest,
    })
  );

  ws.send(
    JSON.stringify({
      type: "history",
      messages: chatHistory,
    })
  );

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case "chat": {
          if (typeof data.text !== "string") break;
          const text = data.text.trim().slice(0, 500);
          if (!text) break;

          const chatMessage = {
            type: "chat",
            id: players[playerId].username,
            text,
            timestamp: Date.now(),
          };

          chatHistory.push(chatMessage);
          if (chatHistory.length > MAX_MESSAGES) {
            chatHistory.shift();
          }

          broadcast(chatMessage);
          break;
        }

        case "draw":
          break;

        case "action":
          break;

        default:
          console.log("Unknown message type:", data.type);
      }
    } catch (error) {
      console.error("Invalid message:", error);
    }
  });

  ws.on("close", () => {
    console.log(`Player disconnected: ${playerId}`);
    if (!players[playerId]?.isGuest && usersDB[username.toLowerCase()]) {
      usersDB[username.toLowerCase()].savedScore = players[playerId].score;
    }
    delete players[playerId];
  });

  ws.on("error", (error) => {
    console.error(`Player ${playerId} error:`, error);
  });
});

setInterval(() => {
  broadcast({
    type: "state",
    players: getPlayers(),
  });
}, 1000 / TICK_RATE);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
