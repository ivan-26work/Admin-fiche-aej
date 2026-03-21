// ===== theme.js =====
(function() {
  function applyTheme() {
    const savedTheme = localStorage.getItem('aej_theme') || 'day';
    if (savedTheme === 'night') {
      document.body.classList.add('night-mode');
    } else {
      document.body.classList.remove('night-mode');
    }
  }
  
  window.addEventListener('storage', (e) => {
    if (e.key === 'aej_theme') applyTheme();
  });
  
  applyTheme();
})();
