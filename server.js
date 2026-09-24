/**
 * LiyuFlix - Realtime Synchronization Room Server Engine
 */
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // Allows any phone app connection to hook in securely
        methods: ["GET", "POST"]
    }
});

let roomTimeState = 0;

io.on('connection', (socket) => {
    console.log(`Connected client token ID: ${socket.id}`);

    // 1. Sync Playback Triggers (Play/Pause/Seek Commands)
    socket.on('sync-action', (data) => {
        roomTimeState = data.time;
        socket.broadcast.emit('sync-action', data);
    });

    // 2. Continuous timeline alignment safety check
    socket.on('heartbeat-check', (data) => {
        if (Math.abs(data.time - roomTimeState) > 2) {
            roomTimeState = data.time;
        }
    });

    // 3. Relay Text Messages
    socket.on('room-message', (msgText) => {
        socket.broadcast.emit('room-message', {
            senderId: socket.id,
            text: msgText
        });
    });

    // 4. Real-time head rotation broadcast channel
    socket.on('head-move', (coords) => {
        socket.broadcast.emit('head-move', coords);
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`LiyuFlix Synchronization Backend live on port: ${PORT}`);
});


