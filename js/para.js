// ===== para.js =====
// Version PC - 30/70 avec mode nuit/jour

(function() {
  // ---------------------------------------------
  // CONFIGURATION
  // ---------------------------------------------
  const SUPABASE_URL = 'https://lnwrwvwunwsqeuluupis.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxud3J3dnd1bndzcWV1bHV1cGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NjU2ODYsImV4cCI6MjA4OTM0MTY4Nn0.gfnPMtR3mNBFMTo3GtZ9t1A9_8gxEHY4loLgLdLJxLs';

  // ---------------------------------------------
  // ÉTAT INTERNE
  // ---------------------------------------------
  let supabase = null;
  let currentUser = null;
  let userMetadata = {};

  // ---------------------------------------------
  // ÉLÉMENTS DOM
  // ---------------------------------------------
  const loadingOverlay = document.getElementById('loadingOverlay');
  const prenomInput = document.getElementById('prenom');
  const nomInput = document.getElementById('nom');
  const emailInput = document.getElementById('email');
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  const statsFichiers = document.getElementById('statsFichiers');
  const statsCategories = document.getElementById('statsCategories');
  const statsTelechargements = document.getElementById('statsTelechargements');
  const themeNight = document.getElementById('themeNight');
  const themeDay = document.getElementById('themeDay');
  const logoutBtn = document.getElementById('logoutBtn');
  const backBtn = document.getElementById('backBtn');
  const gotoVu = document.getElementById('gotoVu');

  // ---------------------------------------------
  // INITIALISATION
  // ---------------------------------------------
  async function init() {
    try {
      loadingOverlay?.classList.remove('hidden');
      await initSupabase();
      await checkSession();
      
      if (currentUser) {
        await loadUserData();
        await loadLocalStats();
        await loadTelechargementsStats();
        setupEventListeners();
        loadThemePreference();
      } else {
        redirectToAuth();
      }
      
    } catch (error) {
      console.error('Erreur initialisation:', error);
      showNotification('Erreur de chargement', 'error');
    } finally {
      setTimeout(() => loadingOverlay?.classList.add('hidden'), 500);
    }
  }

  async function initSupabase() {
    if (window.supabase?.createClient) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      await loadSupabaseScript();
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  }

  function loadSupabaseScript() {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="supabase"]')) {
        const checkInterval = setInterval(() => {
          if (window.supabase) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
        setTimeout(() => reject(new Error('Timeout')), 5000);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = () => window.supabase ? resolve() : reject();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function checkSession() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      if (!user) {
        redirectToAuth();
        return;
      }
      
      currentUser = user;
      userMetadata = user.user_metadata || {};
      
    } catch (error) {
      console.error('Erreur session:', error);
      redirectToAuth();
    }
  }

  function redirectToAuth() {
    setTimeout(() => {
      window.location.href = 'auth.html';
    }, 500);
  }

  // ---------------------------------------------
  // CHARGEMENT DES DONNÉES
  // ---------------------------------------------
  function loadUserData() {
    if (!currentUser) return;
    
    if (emailInput) emailInput.value = currentUser.email || '';
    if (prenomInput) prenomInput.value = userMetadata.first_name || '';
    if (nomInput) nomInput.value = userMetadata.last_name || '';
  }

  async function loadLocalStats() {
    try {
      // Compter les fichiers
      const { count: fichiersCount, error: fichiersError } = await supabase
        .from('fichiers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);
      
      if (fichiersError) throw fichiersError;
      
      // Compter les catégories
      const { count: categoriesCount, error: categoriesError } = await supabase
        .from('dossiers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .is('parent_id', null);
      
      if (categoriesError) throw categoriesError;
      
      if (statsFichiers) statsFichiers.textContent = fichiersCount?.toString() || '0';
      if (statsCategories) statsCategories.textContent = categoriesCount?.toString() || '0';
      
    } catch (error) {
      console.error('Erreur chargement stats locales:', error);
      if (statsFichiers) statsFichiers.textContent = '0';
      if (statsCategories) statsCategories.textContent = '0';
    }
  }

  async function loadTelechargementsStats() {
    try {
      const { count, error } = await supabase
        .from('telechargements')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.warn('Table telechargements non disponible');
        if (statsTelechargements) statsTelechargements.textContent = '0';
        return;
      }
      
      if (statsTelechargements) statsTelechargements.textContent = count?.toString() || '0';
      
    } catch (error) {
      console.warn('Erreur chargement stats téléchargements:', error);
      if (statsTelechargements) statsTelechargements.textContent = '0';
    }
  }

  // ---------------------------------------------
  // SAUVEGARDE DU PROFIL
  // ---------------------------------------------
  async function saveProfile() {
    if (!supabase || !currentUser) return;
    
    const newPrenom = prenomInput?.value.trim() || '';
    const newNom = nomInput?.value.trim() || '';
    
    showNotification('Mise à jour...', 'info');
    
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: newPrenom,
          last_name: newNom
        }
      });
      
      if (error) throw error;
      
      userMetadata.first_name = newPrenom;
      userMetadata.last_name = newNom;
      
      showNotification('Profil mis à jour', 'success');
      
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      showNotification('Erreur lors de la sauvegarde', 'error');
    }
  }

  // ---------------------------------------------
  // GESTION DU THÈME (Mode Nuit/Jour)
  // ---------------------------------------------
  function loadThemePreference() {
    const savedTheme = localStorage.getItem('aej_theme') || 'day';
    setTheme(savedTheme);
  }

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

  // ---------------------------------------------
  // DÉCONNEXION
  // ---------------------------------------------
  async function handleLogout() {
    if (!supabase) return;
    
    logoutBtn.classList.add('logging-out');
    logoutBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Déconnexion...';
    
    try {
      await supabase.auth.signOut();
      
      setTimeout(() => {
        window.location.href = 'auth.html';
      }, 800);
      
    } catch (error) {
      console.error('Erreur déconnexion:', error);
      logoutBtn.classList.remove('logging-out');
      logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Déconnexion';
      showNotification('Erreur lors de la déconnexion', 'error');
    }
  }

  // ---------------------------------------------
  // NOTIFICATIONS
  // ---------------------------------------------
  function showNotification(message, type = 'info', duration = 2000) {
    const notif = document.createElement('div');
    notif.className = `temp-notification ${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);
    
    setTimeout(() => {
      notif.style.opacity = '0';
      setTimeout(() => notif.remove(), 300);
    }, duration);
  }

  // ---------------------------------------------
  // ÉCOUTEURS
  // ---------------------------------------------
  function setupEventListeners() {
    // Sauvegarde profil
    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', saveProfile);
    }
    
    // Mode nuit/jour
    if (themeNight) {
      themeNight.addEventListener('click', () => setTheme('night'));
    }
    
    if (themeDay) {
      themeDay.addEventListener('click', () => setTheme('day'));
    }
    
    // Déconnexion
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Retour à l'accueil
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'index.html';
      });
    }
    
    // Accès rapide Vu.html
    if (gotoVu) {
      gotoVu.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'vu.html';
      });
    }
    
    // Validation par Entrée dans les champs
    [prenomInput, nomInput].forEach(input => {
      if (input) {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            saveProfile();
          }
        });
      }
    });
    
    // Recharger les stats quand la page devient visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        loadLocalStats();
        loadTelechargementsStats();
      }
    });
  }

  // ---------------------------------------------
  // DÉMARRAGE
  // ---------------------------------------------
  init();
})();
