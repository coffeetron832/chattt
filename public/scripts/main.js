document.getElementById('start-form').addEventListener('submit', function (e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  if (!username) return;

  localStorage.setItem('sollo_username', username);

  // Verifica si el usuario venía de un enlace a una sala
  const pendingRoom = localStorage.getItem('pending_room');
  if (pendingRoom) {
    localStorage.removeItem('pending_room');
    window.location.href = `/sala/${pendingRoom}`;
  } else {
    const roomId = crypto.randomUUID().slice(0, 6); // Crear nueva sala
    window.location.href = `/sala/${roomId}`;
  }
});
