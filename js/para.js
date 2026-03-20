// ===== para.js =====
// Version SANS statistiques et SANS mode nuit

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
  const logoutBtn = document.getElementById('logoutBtn');
  const backBtn = document.getElementById('backBtn');
  const gotoVu = document.getElementById('gotoVu');

  // ---------------------------------------------
  // INITIALISATION
  // ---------------------------------------------
  async function init() {
    try {
      await waitForDom();
      await initSupabase();
      await checkSession();
      
      if (currentUser) {
        loadUserData();
        setupEventListeners();
      } else {
        redirectToAuth();
      }
      
    } catch (error) {
      console.error('Erreur initialisation:', error);
      showNotification('Erreur de chargement', 'error');
    } finally {
      setTimeout(() => {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
      }, 300);
    }
  }

  function waitForDom() {
    return new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
  }

  async function initSupabase() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return;
    }
    await loadSupabaseScript();
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Supabase non disponible');
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
      notif.style.animation = 'notif-disappear 0.3s ease forwards';
      setTimeout(() => notif.remove(), 300);
    }, duration);
  }

  // ---------------------------------------------
  // ÉCOUTEURS
  // ---------------------------------------------
  function setupEventListeners() {
    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', saveProfile);
    }
    
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }
    
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'index.html';
      });
    }
    
    if (gotoVu) {
      gotoVu.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'vu.html';
      });
    }
    
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
  }

  // ---------------------------------------------
  // DÉMARRAGE
  // ---------------------------------------------
  init();
})();
