(function() {
  const socket = io();
  const chatBox = document.getElementById('chat-box');
  const form = document.getElementById('message-form');
  const input = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-button');

  // Obtener valores guardados
  const roomId = window.solloRoomId;
  let username = localStorage.getItem('sollo_username');
  let isHost = localStorage.getItem('sollo_is_host') === 'true';

  if (!username) {
    username = window.solloUsername;
    localStorage.setItem('sollo_username', username);
  }

  // Variable de permiso
  let canChat = false;

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

  // 🚫 Inicialmente no se puede chatear
  sendBtn.disabled = true;
  input.disabled = true;

  // Petición de ingreso
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

  socket.on('joinRejected', () => {
    alert('El anfitrión no te permitió unirte a la sala.');
    window.location.href = '/';
  });

  // Cuando el anfitrión acepta, se activa el chat
  socket.on('joinAccepted', () => {
    canChat = true;
    sendBtn.disabled = false;
    input.disabled = false;
    input.focus();
  });

  // Ser nombrado anfitrión
  socket.on('youAreHost', () => {
    isHost = true;
    localStorage.setItem('sollo_is_host', 'true');
    document.getElementById('destroy-room').style.display = 'inline-block';

    // El anfitrión sí puede escribir desde el inicio
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
    alert('La sala fue destruida por el anfitrión.');
    window.location.href = '/';
  });

  // Limpiar nombre solo si se sale completamente (no recarga)
  window.addEventListener('beforeunload', (e) => {
    if (!performance.getEntriesByType("navigation")[0].type.includes("reload")) {
      localStorage.removeItem('sollo_username');
      localStorage.removeItem('sollo_is_host');
    }
  });
})();
