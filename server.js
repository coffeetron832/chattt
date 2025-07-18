// server.js
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const rooms = {}; // { roomId: [socketId1, socketId2, ...] }

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, username }) => {
    if (!rooms[roomId]) rooms[roomId] = [];

    if (rooms[roomId].length >= 10) {
      socket.emit('roomFull');
      return;
    }

    socket.join(roomId);
    socket.username = username;
    socket.roomId = roomId;
    rooms[roomId].push(socket.id);

    io.to(roomId).emit('message', { sender: 'Sollo', text: `${username} se ha unido.` });

    socket.on('chatMessage', (msg) => {
      io.to(roomId).emit('message', { sender: username, text: msg });
    });

    socket.on('disconnect', () => {
      const index = rooms[roomId]?.indexOf(socket.id);
      if (index > -1) {
        rooms[roomId].splice(index, 1);
        io.to(roomId).emit('message', { sender: 'Sollo', text: `${username} ha salido.` });
        if (rooms[roomId].length === 0) delete rooms[roomId]; // autodestruir sala
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Sollo está escuchando en http://localhost:${PORT}`);
});
