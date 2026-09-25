/**
 * LiyuFlix - Final Isolated Realtime Sync Room Backend Engine
 * Handles private rooms, sync timelines, text chats, and 3D head rotation relays.
 */
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // Allows any phone browser or packaged app connection to securely map in
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log(`Connected client connection ID: ${socket.id}`);

    // 1. Group connection pipes into dynamic isolated paths based on room code names
    socket.on('join-room', (roomCode) => {
        socket.join(roomCode);
        console.log(`Client ${socket.id} locked into private room: ${roomCode}`);
    });

    // 2. Room-isolated Play/Pause/Seek command routing
    socket.on('sync-action', (data) => {
        // Forwards timestamp to the opposing device in the exact same room channel
        socket.to(data.room).emit('sync-action', data);
    });

    // 3. Room-isolated Text message chat routing
    socket.on('room-message', (data) => {
        socket.to(data.room).emit('room-message', data);
    });

    // 4. Room-isolated real-time head rotation update routing
    socket.on('head-move', (data) => {
        // Relays X and Y angles straight to your friend's Roblox avatar head
        socket.to(data.room).emit('head-move', data);
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected from server: ${socket.id}`);
    });
});

// Deploy platforms like Render provide their own live ports automatically
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`LiyuFlix Room Routing Pipeline live on Port: ${PORT}`);
});
