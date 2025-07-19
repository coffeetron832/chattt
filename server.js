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

  // Unirse por primera vez o recargar
  socket.on('joinRoom', ({ roomId, username, wasAccepted = false, wasHost = false }) => {
    const socketsInRoom = rooms[roomId] || [];

    if (socketsInRoom.length >= 10) {
      socket.emit('roomFull');
      return;
    }

    // Guardar info en socket
    socket.username = username;
    socket.roomId = roomId;
    socketUserMap[socket.id] = username;

    // Sala no existe → se crea y este usuario es el host
    if (!rooms[roomId]) {
      rooms[roomId] = [socket.id];
      roomHostMap[roomId] = socket.id;

      socket.join(roomId);
      socket.accepted = true;

      socket.emit('youAreHost');
      socket.emit('joinAccepted'); // Para permitir enviar mensajes
      io.to(roomId).emit('message', { sender: 'Sollo', text: `${username} ha creado la sala.` });

    } else if (wasAccepted) {
      // Reingreso tras recarga (ya fue aceptado)
      rooms[roomId].push(socket.id);
      socket.join(roomId);
      socket.accepted = true;

      if (wasHost || roomHostMap[roomId] === socket.id) {
        roomHostMap[roomId] = socket.id;
        socket.emit('youAreHost');
      }

      socket.emit('joinAccepted'); // Le permite escribir
      io.to(roomId).emit('message', { sender: 'Sollo', text: `${username} se ha reconectado.` });

    } else {
      // Solicitud a anfitrión
      const hostSocketId = roomHostMap[roomId] || rooms[roomId][0];
      socket.emit('waitingApproval');
      io.to(hostSocketId).emit('joinRequest', {
        requesterId: socket.id,
        requesterName: username
      });
    }
  });

  // Respuesta del anfitrión
  socket.on('joinResponse', ({ requesterId, accepted }) => {
    const targetSocket = io.sockets.sockets.get(requesterId);
    if (!targetSocket) return;

    const roomId = socket.roomId;
    if (accepted) {
      rooms[roomId].push(requesterId);
      targetSocket.join(roomId);
      targetSocket.accepted = true;
      targetSocket.emit('joinAccepted');
      io.to(roomId).emit('message', {
        sender: 'Sollo',
        text: `${socketUserMap[requesterId]} se ha unido.`
      });
    } else {
      targetSocket.emit('joinRejected');
      targetSocket.disconnect();
    }
  });

  // Chat
  socket.on('chatMessage', (msg) => {
    if (!socket.accepted) {
      socket.emit('message', {
        sender: 'Sollo',
        text: 'Debes esperar a ser aceptado para enviar mensajes.'
      });
      return;
    }
    io.to(socket.roomId).emit('message', {
      sender: socket.username,
      text: msg
    });
  });

  // Destruir sala
  socket.on('destroyRoom', (rid) => {
    if (rooms[rid] && roomHostMap[rid] === socket.id) {
      io.to(rid).emit('roomDestroyed');
      io.in(rid).socketsLeave(rid);
      delete rooms[rid];
      delete roomHostMap[rid];
      Object.keys(socketUserMap).forEach(id => delete socketUserMap[id]);
    }
  });

  // Desconexión
  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      const idx = rooms[roomId].indexOf(socket.id);
      if (idx > -1) rooms[roomId].splice(idx, 1);
      io.to(roomId).emit('message', {
        sender: 'Sollo',
        text: `${socket.username} ha salido.`
      });

      // Si era host, transferir rol
      if (roomHostMap[roomId] === socket.id) {
        if (rooms[roomId].length > 0) {
          roomHostMap[roomId] = rooms[roomId][0];
          const newHost = io.sockets.sockets.get(roomHostMap[roomId]);
          if (newHost) newHost.emit('youAreHost');
        } else {
          delete roomHostMap[roomId];
        }
      }

      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
      }
    }
    delete socketUserMap[socket.id];
  });

}); // fin de io.on('connection')


server.listen(PORT, () => {
  console.log(`Sollo está escuchando en http://localhost:${PORT}`);
});

