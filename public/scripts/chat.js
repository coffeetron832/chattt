// public/scripts/chat.js
const socket = io();
const chatBox = document.getElementById('chat-box');
const form = document.getElementById('message-form');
const input = document.getElementById('message-input');

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const username = localStorage.getItem('sollo_username') || 'Anónimo';

document.getElementById('room-id').textContent = roomId;

socket.emit('joinRoom', { roomId, username });

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (message) {
    socket.emit('chatMessage', message);
    input.value = '';
  }
});

socket.on('message', ({ sender, text }) => {
  const msg = document.createElement('div');
  msg.textContent = `[${sender}]: ${text}`;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('roomFull', () => {
  alert('Esta sala ya alcanzó el límite de 10 personas.');
  window.location.href = '/';
});


// ...código existente...
const roomLink = document.getElementById('room-link');
const toast = document.getElementById('user-toast');
const toastMsg = document.getElementById('toast-message');
const acceptBtn = document.getElementById('accept-user');
const rejectBtn = document.getElementById('reject-user');

// Mostrar el enlace para compartir
roomLink.textContent = `${window.location.origin}/chat.html?room=${roomId}`;

// Notificación tipo toast cuando alguien entra
socket.on('userJoined', (newUser) => {
  toastMsg.textContent = `${newUser} quiere unirse a la sala.`;
  toast.style.display = 'block';

  acceptBtn.onclick = () => {
    socket.emit('acceptUser', { username: newUser });
    toast.style.display = 'none';
  };

  rejectBtn.onclick = () => {
    socket.emit('rejectUser', { username: newUser });
    toast.style.display = 'none';
  };
});
