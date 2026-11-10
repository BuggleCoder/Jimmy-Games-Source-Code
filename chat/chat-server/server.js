
const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
}

const MAX_MESSAGES = 100;
const TICK_RATE = 30;

const DB_FILE = path.join(__dirname, "db.json");
const MAIN_DIR = path.resolve(__dirname, "..", "main");

const chatHistory = [];
const players = {};

function loadUsers() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, "{}");
        }

        return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    } catch (error) {
        console.error("Database loading failed:", error);
        return {};
    }
}

let usersDB = loadUsers();

function saveUsers() {
    const tempFile = DB_FILE + ".tmp";

    fs.writeFileSync(tempFile, JSON.stringify(usersDB, null, 2));
    fs.renameSync(tempFile, DB_FILE);
}

function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk.toString();

            if (body.length > 10000) {
                reject(new Error("Request too large"));
                req.destroy();
            }
        });

        req.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(error);
            }
        });

        req.on("error", reject);
    });
}

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
    });

    res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
    let cleanUrl;

    try {
        cleanUrl = decodeURIComponent(req.url.split("?")[0]);
    } catch {
        return sendJSON(res, 400, { error: "Invalid URL" });
    }

    if (req.method === "POST" && cleanUrl === "/api/register") {
        try {
            const { username, password } = await parseJsonBody(req);

            if (
                typeof username !== "string" ||
                typeof password !== "string"
            ) {
                return sendJSON(res, 400, {
                    error: "Username and password required"
                });
            }

            const cleanName = username.trim();

            if (
                cleanName.length < 3 ||
                cleanName.length > 25 ||
                !/^[a-zA-Z0-9_]+$/.test(cleanName)
            ) {
                return sendJSON(res, 400, {
                    error: "Username must be 3-25 characters and contain only letters, numbers, and underscores"
                });
            }

            if (password.length < 8 || password.length > 128) {
                return sendJSON(res, 400, {
                    error: "Password must be 8-128 characters"
                });
            }

            const userKey = cleanName.toLowerCase();

            if (usersDB[userKey]) {
                return sendJSON(res, 409, {
                    error: "Username already taken"
                });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            usersDB[userKey] = {
                username: cleanName,
                password: hashedPassword,
                savedScore: 0
            };

            saveUsers();

            return sendJSON(res, 201, {
                message: "Registered successfully"
            });

        } catch (error) {
            console.error("Registration error:", error);

            return sendJSON(res, 400, {
                error: "Registration failed"
            });
        }
    }

    if (req.method === "POST" && cleanUrl === "/api/login") {
        try {
            const { username, password } = await parseJsonBody(req);

            if (
                typeof username !== "string" ||
                typeof password !== "string"
            ) {
                return sendJSON(res, 400, {
                    error: "Username and password required"
                });
            }

            const user = usersDB[username.trim().toLowerCase()];

            if (
                !user ||
                !(await bcrypt.compare(password, user.password))
            ) {
                return sendJSON(res, 401, {
                    error: "Invalid credentials"
                });
            }

            const token = jwt.sign(
                { username: user.username },
                JWT_SECRET,
                { expiresIn: "24h" }
            );

            return sendJSON(res, 200, {
                token,
                username: user.username
            });

        } catch (error) {
            console.error("Login error:", error);

            return sendJSON(res, 400, {
                error: "Login failed"
            });
        }
    }

    const requestedFile =
        cleanUrl === "/"
            ? "index.html"
            : cleanUrl.replace(/^\/+/, "");

    const filePath = path.resolve(MAIN_DIR, requestedFile);

    if (
        filePath !== MAIN_DIR &&
        !filePath.startsWith(MAIN_DIR + path.sep)
    ) {
        res.writeHead(403);
        return res.end("Forbidden");
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
        ".ico": "image/x-icon"
    };

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404);
            return res.end("File not found");
        }

        res.writeHead(200, {
            "Content-Type":
                mimeTypes[path.extname(filePath)] ||
                "application/octet-stream"
        });

        res.end(content);
    });
});

const wss = new WebSocket.Server({
    server,
    maxPayload: 10000
});

function broadcast(data) {
    const message = JSON.stringify(data);

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function getPlayers() {
    return Object.values(players).map(player => ({
        id: player.id,
        username: player.username,
        connected: player.connected,
        isGuest: player.isGuest
    }));
}

wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    let authenticatedUser = null;

    if (token) {
        try {
            authenticatedUser = jwt.verify(token, JWT_SECRET);
        } catch {
            ws.close(4001, "Invalid or expired token");
            return;
        }

        const account =
            usersDB[authenticatedUser.username.toLowerCase()];

        if (!account) {
            ws.close(4001, "Account not found");
            return;
        }
    }

    const playerId = Math.random().toString(36).substring(2, 9);

    const isGuest = !authenticatedUser;

    const username = authenticatedUser
        ? authenticatedUser.username
        : `Guest_${playerId}`;

    const account = isGuest
        ? null
        : usersDB[username.toLowerCase()];

    players[playerId] = {
        id: playerId,
        username,
        ws,
        connected: true,
        isGuest,
        score: account ? account.savedScore || 0 : 0
    };

    console.log(`Player connected: ${playerId} (${username})`);

    ws.send(JSON.stringify({
        type: "init",
        id: playerId,
        username,
        isGuest,
        score: players[playerId].score
    }));

    ws.send(JSON.stringify({
        type: "history",
        messages: chatHistory
    }));

    ws.on("message", message => {
        try {
            const data = JSON.parse(message.toString());

            if (!data || typeof data.type !== "string") {
                return;
            }

            switch (data.type) {
                case "chat": {
                    if (typeof data.text !== "string") break;

                    const text = data.text.trim().slice(0, 500);

                    if (!text) break;

                    const chatMessage = {
                        type: "chat",
                        id: username,
                        text,
                        timestamp: Date.now()
                    };

                    chatHistory.push(chatMessage);

                    if (chatHistory.length > MAX_MESSAGES) {
                        chatHistory.shift();
                    }

                    broadcast(chatMessage);
                    break;
                }

                case "draw": {
                    break;
                }

                case "action": {
                    break;
                }

                default:
                    console.log("Unknown message type:", data.type);
            }
        } catch (error) {
            console.error("Invalid WebSocket message:", error);
        }
    });

    ws.on("close", () => {
        console.log(`Player disconnected: ${playerId}`);

        const player = players[playerId];

        if (player && !player.isGuest) {
            const user = usersDB[player.username.toLowerCase()];

            if (user) {
                user.savedScore = player.score;

                try {
                    saveUsers();
                } catch (error) {
                    console.error("Could not save user:", error);
                }
            }
        }

        delete players[playerId];
    });

    ws.on("error", error => {
        console.error(`Player ${playerId} error:`, error);
    });
});

setInterval(() => {
    broadcast({
        type: "state",
        players: getPlayers()
    });
}, 1000 / TICK_RATE);

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Loaded ${Object.keys(usersDB).length} accounts`);
});
