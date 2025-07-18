// public/scripts/chat.js
const socket = io();
const chatBox = document.getElementById('chat-box');
const form = document.getElementById('message-form');
const input = document.getElementById('message-input');

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const username = localStorage.getItem('sollo_username') || 'Anónimo';

document.getElementById('room-id').textContent = roomId;

// Escapar HTML (pequeña protección XSS)
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[match]);
}

socket.emit('joinRoom', { roomId, username });

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (message) {
    socket.emit('chatMessage', message);
    input.value = '';
    input.focus();
  }
});

socket.on('message', ({ sender, text }) => {
  const msg = document.createElement('div');

  if (sender === 'Sollo') {
    msg.innerHTML = `<em><span style="color:#ff77d0;">${escapeHTML(text)}</span></em>`;
  } else {
    msg.innerHTML = `<strong>${escapeHTML(sender)}:</strong> ${escapeHTML(text)}`;
  }

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('roomFull', () => {
  alert('Esta sala ya alcanzó el límite de 10 personas.');
  window.location.href = '/';
});
