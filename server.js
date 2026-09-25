import http from "http";
import crypto from "crypto";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 10000;

const rooms = new Map();

function createRoomCode() {
    return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function send(ws, data) {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(data));
    }
}

function broadcast(room, data, except = null) {
    for (const client of room.clients) {
        if (client !== except) {
            send(client, data);
        }
    }
}

const httpServer = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Watch Together server is running.");
});

const wss = new WebSocketServer({
    server: httpServer
});

wss.on("connection", (ws) => {
    ws.roomCode = null;
    ws.username = "Guest";

    ws.on("message", (raw) => {
        let message;

        try {
            message = JSON.parse(raw.toString());
        } catch {
            send(ws, {
                type: "error",
                message: "Invalid message."
            });

            return;
        }

        /*
         * CREATE ROOM
         */
        if (message.type === "create-room") {
            let roomCode;

            do {
                roomCode = createRoomCode();
            } while (rooms.has(roomCode));

            const room = {
                clients: new Set()
            };

            rooms.set(roomCode, room);

            ws.roomCode = roomCode;
            ws.username = cleanName(message.name);

            room.clients.add(ws);

            send(ws, {
                type: "room-created",
                roomCode
            });

            send(ws, {
                type: "presence",
                count: room.clients.size
            });

            return;
        }

        /*
         * JOIN ROOM
         */
        if (message.type === "join-room") {
            const roomCode = String(message.roomCode || "")
                .trim()
                .toUpperCase();

            const room = rooms.get(roomCode);

            if (!room) {
                send(ws, {
                    type: "error",
                    message: "Room does not exist."
                });

                return;
            }

            if (room.clients.size >= 2) {
                send(ws, {
                    type: "error",
                    message: "This room already has 2 people."
                });

                return;
            }

            ws.roomCode = roomCode;
            ws.username = cleanName(message.name);

            room.clients.add(ws);

            /*
             * Tell the joining client that it successfully joined.
             */
            send(ws, {
                type: "room-joined",
                roomCode
            });

            /*
             * Tell both users how many people are connected.
             */
            broadcast(room, {
                type: "presence",
                count: room.clients.size
            });

            /*
             * Tell the existing user that someone joined.
             * This allows the existing user to send its current
             * video state to the new user.
             */
            broadcast(
                room,
                {
                    type: "peer-joined"
                },
                ws
            );

            return;
        }

        /*
         * Everything below this point requires a room.
         */
        if (!ws.roomCode) {
            send(ws, {
                type: "error",
                message: "You are not in a room."
            });

            return;
        }

        const room = rooms.get(ws.roomCode);

        if (!room) {
            send(ws, {
                type: "error",
                message: "Room no longer exists."
            });

            return;
        }

        /*
         * VIDEO SYNCHRONIZATION
         */
        if (message.type === "video-sync") {
            const action = String(message.action || "");

            if (
                action !== "play" &&
                action !== "pause" &&
                action !== "seek"
            ) {
                return;
            }

            const time = Number(message.time);

            if (!Number.isFinite(time) || time < 0) {
                return;
            }

            broadcast(
                room,
                {
                    type: "video-sync",
                    action,
                    time,
                    sentAt: Date.now()
                },
                ws
            );

            return;
        }

        /*
         * INITIAL VIDEO STATE
         *
         * When somebody joins, the existing user can send its
         * current state to the new user.
         */
        if (message.type === "video-state") {
            const time = Number(message.time);

            if (!Number.isFinite(time) || time < 0) {
                return;
            }

            broadcast(
                room,
                {
                    type: "video-state",
                    action: message.playing ? "play" : "pause",
                    time,
                    sentAt: Date.now()
                },
                ws
            );

            return;
        }

        /*
         * CHAT
         */
        if (message.type === "chat") {
            const text = String(message.message || "").trim();

            if (!text) {
                return;
            }

            if (text.length > 500) {
                return;
            }

            broadcast(room, {
                type: "chat",
                name: ws.username,
                message: text
            });

            return;
        }
    });

    /*
     * DISCONNECT
     */
    ws.on("close", () => {
        if (!ws.roomCode) {
            return;
        }

        const room = rooms.get(ws.roomCode);

        if (!room) {
            return;
        }

        room.clients.delete(ws);

        broadcast(room, {
            type: "presence",
            count: room.clients.size
        });

        if (room.clients.size === 0) {
            rooms.delete(ws.roomCode);
        }
    });
});

function cleanName(name) {
    const value = String(name || "Guest")
        .trim()
        .slice(0, 24);

    return value || "Guest";
}

httpServer.listen(PORT, () => {
    console.log(`Watch Together server running on port ${PORT}`);
});
