const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
const { nanoid } = require('nanoid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 8080;

const rooms = {}; // { roomId: [socketId, ...] }
const socketUserMap = {}; // socket.id -> username

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Ruta raíz: crea y redirige a una sala aleatoria
app.get('/', (req, res) => {
  const newRoomId = nanoid(8); // por ejemplo: Yk3xA7bq
  res.redirect(`/sala/${newRoomId}`);
});

// Ruta dinámica de sala
app.get('/sala/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// SOCKETS
io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, username }) => {
    const socketsInRoom = rooms[roomId] || [];

    if (socketsInRoom.length >= 10) {
      socket.emit('roomFull');
      return;
    }

    socket.username = username;
    socket.roomId = roomId;
    socketUserMap[socket.id] = username;

    if (socketsInRoom.length === 0) {
      rooms[roomId] = [socket.id];
      socket.join(roomId);
      io.to(roomId).emit('message', { sender: 'Sollo', text: `${username} se ha unido.` });
    } else {
      const hostSocketId = socketsInRoom[0];
      io.to(hostSocketId).emit('joinRequest', {
        requesterId: socket.id,
        requesterName: username
      });
    }

    socket.on('joinResponse', ({ requesterId, accepted }) => {
      const targetSocket = io.sockets.sockets.get(requesterId);
      if (!targetSocket) return;

      if (accepted) {
        rooms[roomId].push(requesterId);
        targetSocket.join(roomId);
        io.to(roomId).emit('message', {
          sender: 'Sollo',
          text: `${socketUserMap[requesterId]} se ha unido.`
        });
      } else {
        targetSocket.emit('joinRejected');
        targetSocket.disconnect();
      }
    });

    socket.on('chatMessage', (msg) => {
      io.to(roomId).emit('message', {
        sender: socket.username,
        text: msg
      });
    });

    socket.on('disconnect', () => {
      const room = socket.roomId;
      if (room && rooms[room]) {
        const index = rooms[room].indexOf(socket.id);
        if (index > -1) {
          rooms[room].splice(index, 1);
          io.to(room).emit('message', {
            sender: 'Sollo',
            text: `${socket.username} ha salido.`
          });
          if (rooms[room].length === 0) delete rooms[room];
        }
      }
      delete socketUserMap[socket.id];
    });
  });
});

server.listen(PORT, () => {
  console.log(`Sollo está escuchando en http://localhost:${PORT}`);
});
