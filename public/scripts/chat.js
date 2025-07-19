// public/scripts/chat.js
(function() {
  const socket = io();
  const chatBox = document.getElementById('chat-box');
  const form = document.getElementById('message-form');
  const input = document.getElementById('message-input');
  
  // Variables globales definidas en chat.html
  const roomId = window.solloRoomId;
  const username = window.solloUsername;

  // Protección XSS
  function escapeHTML(str) {
    return str.replace(/[&<>"']/g, match => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[match]);
  }

  // Unirse a la sala
  socket.emit('joinRoom', { roomId, username });

  // Habilitar envío
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

  // Recibir y mostrar mensajes
  socket.on('message', ({ sender, text }) => {
    const msg = document.createElement('div');
    if (sender === 'Sollo') {
      msg.innerHTML = `<em><span style=\"color:#5C677D;\">${escapeHTML(text)}</span></em>`;
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

  // Solicitud de ingreso
  socket.on('joinRequest', ({ requesterId, requesterName }) => {
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

  // Rechazo de unión
  socket.on('joinRejected', () => {
    alert('El anfitrión no te permitió unirte a la sala.');
    window.location.href = '/';
  });

  // Destruir sala
  let isHost = false;
  socket.on('youAreHost', () => {
    isHost = true;
    document.getElementById('destroy-room').style.display = 'inline-block';
  });

  document.getElementById('destroy-room').addEventListener('click', () => {
    if (!isHost) return;
    if (confirm('¿Estás seguro de que deseas destruir esta sala? Todos serán expulsados.')) {
      socket.emit('destroyRoom', roomId);
    }
  });

  socket.on('roomDestroyed', () => {
    alert('La sala fue destruida por el anfitrión.');
    window.location.href = '/';
  });

  // Limpiar nombre al salir
  window.addEventListener('beforeunload', () => {
    localStorage.removeItem('sollo_username');
  });
})();
