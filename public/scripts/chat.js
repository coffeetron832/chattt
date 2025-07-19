// public/scripts/chat.js
const socket = io();
const chatBox = document.getElementById('chat-box');
const form = document.getElementById('message-form');
const input = document.getElementById('message-input');

// Obtener roomId desde la ruta: /sala/:roomId
const pathParts = window.location.pathname.split('/');
const roomId = pathParts[pathParts.length - 1];

// Nombre guardado en localStorage al generar sala
const username = localStorage.getItem('sollo_username') || 'Anónimo';

if (!username) {
  // Si no hay nombre, redirigir al inicio
  alert('Debes ingresar tu nombre antes de entrar a una sala.');
  window.location.href = '/';
}


window.addEventListener('beforeunload', () => {
  localStorage.removeItem('sollo_username');
});


// Mostrar roomId en la UI
document.getElementById('room-id').textContent = roomId;

deviceCheck(); // opcional: verifica compatibilidad share API

// Proteger contra XSS
function escapeHTML(str) {
  return str.replace(/[&<>\"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[match]);
}

// Unirse a la sala
socket.on('joinRoom', ({ roomId, username }) => {
  socket.join(roomId);
  socket.username = username; // guardar para futuras referencias

  // Notificar a todos excepto al que entra
  socket.to(roomId).emit('message', {
    sender: 'Sollo',
    text: `${username} se ha unido a la sala.`
  });
});


// Enviar mensaje
document.getElementById('send-button').disabled = false;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (message) {
    socket.emit('chatMessage', message);
    input.value = '';
    input.focus();
  }
});

// Recibir mensajes
socket.on('message', ({ sender, text }) => {
  const msg = document.createElement('div');

  if (sender === 'Sollo') {
    msg.innerHTML = `<em><span style=\"color:#ff77d0;\">${escapeHTML(text)}</span></em>`;
  } else {
    msg.innerHTML = `<strong>${escapeHTML(sender)}:</strong> ${escapeHTML(text)}`;
  }

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// Sala llena
socket.on('roomFull', () => {
  alert('Esta sala ya alcanzó el límite de 10 personas.');
  window.location.href = '/';
});

// Manejar solicitud de ingreso: joinRequest
socket.on('joinRequest', ({ requesterId, requesterName }) => {
  // Mostrar toast (ya manejado en HTML)
  document.getElementById('toast-username').textContent = requesterName;
  const toast = document.getElementById('toast');
  toast.style.display = 'flex';

  document.getElementById('accept-btn').onclick = () => {
    socket.emit('joinResponse', { requesterId, accepted: true });
    toast.style.display = 'none';
  };
  document.getElementById('reject-btn').onclick = () => {
    socket.emit('joinResponse', { requesterId, accepted: false });
    toast.style.display = 'none';
  };
});

// Usuario rechazado
socket.on('joinRejected', () => {
  alert('El anfitrión no te permitió unirte a la sala.');
  window.location.href = '/';
});


// Mostrar botón solo si es el anfitrión (primer usuario en entrar)
let isHost = false;

socket.on('youAreHost', () => {
  isHost = true;
  document.getElementById('destroy-room').style.display = 'inline-block';
});

document.getElementById('destroy-room').addEventListener('click', () => {
  if (confirm('¿Estás seguro de que deseas destruir esta sala? Todos serán expulsados.')) {
    socket.emit('destroyRoom', roomId);
  }
});

// Cuando el servidor destruye la sala
socket.on('roomDestroyed', () => {
  alert('La sala fue destruida por el anfitrión.');
  window.location.href = '/';
});
