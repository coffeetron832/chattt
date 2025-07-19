// public/scripts/chat.js
(function() {
  const socket = io();
  const chatBox = document.getElementById('chat-box');
  const form = document.getElementById('message-form');
  const input = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-button');

  // Obtener valores guardados
  const roomId = window.solloRoomId;
  let username = localStorage.getItem('sollo_username');
  const wasAccepted = localStorage.getItem('sollo_accepted') === 'true';
  let isHost = localStorage.getItem('sollo_is_host') === 'true';

  // Si no hay username guardado, tomar del HTML y guardar
  if (!username) {
    username = window.solloUsername;
    localStorage.setItem('sollo_username', username);
  }

  // Permiso de chat
  let canChat = wasAccepted || isHost;

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

  // Conectar o reconectar
  if (wasAccepted || isHost) {
    socket.emit('reconnectToRoom', { roomId, username, isHost });
  } else {
    socket.emit('joinRoom', { roomId, username });
  }

  // Configurar estado inicial del chat
  sendBtn.disabled = !canChat;
  input.disabled = !canChat;

  // Enviar mensajes solo si está aprobado
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!canChat) return;
    const message = input.value.trim();
    if (message) {
      socket.emit('chatMessage', message);
      input.value = '';
      input.focus();
    }
  });

  // Mostrar mensajes
  socket.on('message', ({ sender, text }) => {
    const msg = document.createElement('div');
    const now = new Date();
    const time = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });

    if (sender === 'Sollo') {
      msg.innerHTML = `<em><span style="color:#5C677D;">[${time} - ${date}] ${escapeHTML(text)}</span></em>`;
    } else {
      msg.innerHTML = `<span style="color:gray;">[${time} - ${date}]</span> <strong>${escapeHTML(sender)}</strong>: ${escapeHTML(text)}`;
    }
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
  });

  socket.on('roomFull', () => {
    alert('Esta sala ya alcanzó el límite de 10 personas.');
    window.location.href = '/';
  });

  // Petición de ingreso
  socket.on('joinRequest', ({ requesterId, requesterName }) => {
    document.getElementById('toast-username').textContent = requesterName;
    const toast = document.getElementById('toast');
    toast.style.display = 'flex';
    document.getElementById('accept-btn').onclick = () => {
      socket.emit('joinResponse', { requesterId, accepted: true });
      localStorage.setItem('sollo_accepted', 'true');
      canChat = true;
      sendBtn.disabled = false;
      input.disabled = false;
      toast.style.display = 'none';
    };
    document.getElementById('reject-btn').onclick = () => {
      socket.emit('joinResponse', { requesterId, accepted: false });
      toast.style.display = 'none';
    };
  });

  socket.on('joinRejected', () => {
    localStorage.removeItem('sollo_accepted');
    alert('El anfitrión no te permitió unirte a la sala.');
    window.location.href = '/';
  });

  // Ser nombrado anfitrión
  socket.on('youAreHost', () => {
    isHost = true;
    localStorage.setItem('sollo_is_host', 'true');
    localStorage.setItem('sollo_accepted', 'true');
    document.getElementById('destroy-room').style.display = 'inline-block';
    canChat = true;
    sendBtn.disabled = false;
    input.disabled = false;
  });

  document.getElementById('destroy-room').addEventListener('click', () => {
    if (!isHost) return;
    if (confirm('¿Estás seguro de que deseas destruir esta sala? Todos serán expulsados.')) {
      socket.emit('destroyRoom', roomId);
    }
  });

  socket.on('roomDestroyed', () => {
    localStorage.removeItem('sollo_username');
    localStorage.removeItem('sollo_is_host');
    localStorage.removeItem('sollo_accepted');
    alert('La sala fue destruida por el anfitrión.');
    window.location.href = '/';
  });

  // No limpiar localStorage en recarga para conservar sesión
})();
