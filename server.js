const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
const { nanoid } = require('nanoid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 8080;
const rooms = {};           // { roomId: [socketId, ...] }
const socketUserMap = {};   // socket.id -> username
const roomHostMap = {}; // roomId -> hostSocketId

// Servir archivos estáticos desde /public
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para generar una nueva sala y redirigir
app.get('/crear', (req, res) => {
  const newRoomId = nanoid(8);
  res.redirect(`/sala/${newRoomId}`);
});

// Ruta dinámica para acceder a cualquier sala
app.get('/sala/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// WebSocket
io.on('connection', (socket) => {

  // Unirse por primera vez
  socket.on('joinRoom', ({ roomId, username }) => {
    const socketsInRoom = rooms[roomId] || [];

    if (socketsInRoom.length >= 10) {
      socket.emit('roomFull');
      return;
    }

    // Guardar información en el socket
    socket.username = username;
    socket.roomId = roomId;
    socketUserMap[socket.id] = username;

    // Sala nueva: primer usuario = anfitrión
    if (!rooms[roomId]) {
      rooms[roomId] = [socket.id];
      socket.join(roomId);
      socket.accepted = true;            // anfitrión aceptado
      socket.emit('youAreHost');
      io.to(roomId).emit('message', {
        sender: 'Sollo',
        text: `${username} ha creado la sala.`
      });

    } else {
      // Sala existente: pedir aprobación al anfitrión
      const hostSocketId = rooms[roomId][0];
      socket.emit('waitingApproval');
      io.to(hostSocketId).emit('joinRequest', {
        requesterId: socket.id,
        requesterName: username
      });
    }
  });

  // Reconectar tras recarga
  socket.on('reconnectToRoom', ({ roomId, username, isHost }) => {
    if (!roomId || !username) return;
    if (!rooms[roomId]) {
      socket.emit('roomDestroyed');
      return;
    }

    // Restaurar estado
    socket.roomId = roomId;
    socket.username = username;
    socketUserMap[socket.id] = username;
    rooms[roomId].push(socket.id);
    socket.join(roomId);

    if (isHost) {
      socket.accepted = true;
      socket.emit('youAreHost');
      io.to(roomId).emit('message', {
        sender: 'Sollo',
        text: `${username} se ha reconectado como anfitrión.`
      });
    } else {
      socket.emit('waitingApproval');
      const hostSocketId = rooms[roomId][0];
      io.to(hostSocketId).emit('joinRequest', {
        requesterId: socket.id,
        requesterName: username
      });
    }
  });

  // Manejar respuesta del anfitrión
  socket.on('joinResponse', ({ requesterId, accepted }) => {
    const targetSocket = io.sockets.sockets.get(requesterId);
    if (!targetSocket) return;

    const roomId = socket.roomId;
    if (accepted) {
      rooms[roomId].push(requesterId);
      targetSocket.join(roomId);
      targetSocket.accepted = true;
      io.to(roomId).emit('message', {
        sender: 'Sollo',
        text: `${socketUserMap[requesterId]} se ha unido.`
      });
    } else {
      targetSocket.emit('joinRejected');
      targetSocket.disconnect();
    }
  });

  // Mensajes de chat
  socket.on('chatMessage', (msg) => {
    if (!socket.accepted) {
      socket.emit('message', {
        sender: 'Sollo',
        text: 'Debes esperar a ser aceptado para enviar mensajes.'
      });
      return;
    }
    const roomId = socket.roomId;
    io.to(roomId).emit('message', {
      sender: socket.username,
      text: msg
    });
  });

  // Destruir sala (solo anfitrión)
  socket.on('destroyRoom', (rid) => {
    if (rooms[rid] && rooms[rid][0] === socket.id) {
      io.to(rid).emit('roomDestroyed');
      io.in(rid).socketsLeave(rid);
      delete rooms[rid];
      Object.keys(socketUserMap).forEach(id => {
        if (rooms[rid]?.includes(id)) delete socketUserMap[id];
      });
    }
  });

  // Desconexión
  socket.on('disconnect', () => {
    const room = socket.roomId;
    if (room && rooms[room]) {
      const idx = rooms[room].indexOf(socket.id);
      if (idx > -1) {
        rooms[room].splice(idx, 1);
        io.to(room).emit('message', {
          sender: 'Sollo',
          text: `${socket.username} ha salido.`
        });
        if (rooms[room].length === 0) {
          delete rooms[room];
        }
      }
    }
    delete socketUserMap[socket.id];
  });

}); // fin de io.on('connection')

server.listen(PORT, () => {
  console.log(`Sollo está escuchando en http://localhost:${PORT}`);
});

