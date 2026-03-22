// Le code de gestion du thème est déjà dans para.js
// Il utilise localStorage.setItem('aej_theme', theme)
// Et theme.js s'occupe de l'appliquer sur toutes les pages

function setTheme(theme) {
  if (theme === 'night') {
    document.body.classList.add('night-mode');
    themeNight?.classList.add('active');
    themeDay?.classList.remove('active');
  } else {
    document.body.classList.remove('night-mode');
    themeDay?.classList.add('active');
    themeNight?.classList.remove('active');
  }
  localStorage.setItem('aej_theme', theme);
}
