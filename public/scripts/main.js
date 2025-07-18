// public/scripts/main.js
document.getElementById('start-form').addEventListener('submit', function (e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  if (!username) return;

  const roomId = crypto.randomUUID().slice(0, 6); // Sala corta y única
  localStorage.setItem('sollo_username', username);
  window.location.href = `/chat.html?room=${roomId}`;
});
