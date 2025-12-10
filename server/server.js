const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const http = require("http");

const PORT = process.env.PORT || 4000;

// Load user database
const usersPath = path.join(__dirname, "users.json");
let { users } = JSON.parse(fs.readFileSync(usersPath, "utf8"));

function saveUsers() {
    fs.writeFileSync(usersPath, JSON.stringify({ users }, null, 2));
}

const server = http.createServer((req, res) => {
    if (req.method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            const data = JSON.parse(body);

            // Signup
            if (req.url === "/signup") {
                if (users.find(u => u.email === data.email)) {
                    res.writeHead(400, {"Content-Type": "application/json"});
                    return res.end(JSON.stringify({ error: "Email exists" }));
                }
                users.push({ email: data.email, password: data.password });
                saveUsers();
                res.writeHead(200, {"Content-Type": "application/json"});
                return res.end(JSON.stringify({ success: true }));
            }

            // Login
            if (req.url === "/login") {
                const user = users.find(u => u.email === data.email && u.password === data.password);
                if (!user) {
                    res.writeHead(401, {"Content-Type": "application/json"});
                    return res.end(JSON.stringify({ error: "Invalid login" }));
                }
                res.writeHead(200, {"Content-Type": "application/json"});
                return res.end(JSON.stringify({ success: true }));
            }
        });
    } else {
        res.writeHead(404);
        res.end("Not Found");
    }
});

// WebSocket server
const wss = new WebSocket.Server({ server });

let clients = {};

wss.on("connection", (ws) => {
    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        if (data.type === "login") {
            clients[data.email] = ws;
        }
    });
});

server.listen(PORT, () => console.log("Secure server running on PORT " + PORT));
