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

    // Si la sala ya existe, permitir que se una directamente
    if (!rooms[roomId]) {
  // Sala nueva: primer usuario (anfitrión)
  rooms[roomId] = [socket.id];
  socket.join(roomId);
  socket.accepted = true; // ✅ El anfitrión está aceptado de inmediato
  socket.emit('youAreHost');
  io.to(roomId).emit('message', { sender: 'Sollo', text: `${username} ha creado la sala.` });

} else {
  const socketsInRoom = rooms[roomId];
  const hostSocketId = socketsInRoom[0];

  // Guardar solicitud pendiente
  socket.emit('waitingApproval'); // opcional para mostrar spinner

  io.to(hostSocketId).emit('joinRequest', {
    requesterId: socket.id,
    requesterName: username
  });
}


    // Manejar respuesta del anfitrión
    socket.on('joinResponse', ({ requesterId, accepted }) => {
  const targetSocket = io.sockets.sockets.get(requesterId);
  if (!targetSocket) return;

  if (accepted) {
    rooms[roomId].push(requesterId);
    targetSocket.join(roomId);
    targetSocket.accepted = true; // ✅ Bandera de aceptación

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
  // Bloquear si no ha sido aceptado
  if (!socket.accepted) {
    socket.emit('message', {
      sender: 'Sollo',
      text: '¿Conoces la palabra Paciencia?'
    });
    return;
  }

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
        // limpiar usuarios
        Object.keys(socketUserMap).forEach(id => {
          if (rooms[rid] && rooms[rid].includes(id)) delete socketUserMap[id];
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

          // Si ya no hay nadie en la sala, destruirla
          if (rooms[room].length === 0) {
            delete rooms[room];
          }
        }
      }
      delete socketUserMap[socket.id];
    });

  }); // <-- Cierra socket.on('joinRoom', ...)
});   // <-- Cierra io.on('connection', ...)

server.listen(PORT, () => {
  console.log(`Sollo está escuchando en http://localhost:${PORT}`);
});

