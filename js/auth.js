// ===== auth.js =====
// Page authentification AEJ - Structure 70/30 avec mode nuit intégré

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
  let currentMode = 'login';
  let codeSecretUnique = null;

  // ---------------------------------------------
  // ÉLÉMENTS DOM
  // ---------------------------------------------
  const loadingOverlay = document.getElementById('loadingOverlay');
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const formLogin = document.getElementById('formLogin');
  const formSignup = document.getElementById('formSignup');
  const forgotLink = document.getElementById('forgotPassword');
  const forgotModal = document.getElementById('forgotModal');
  const cancelReset = document.getElementById('cancelReset');
  const sendReset = document.getElementById('sendReset');
  const resetEmail = document.getElementById('resetEmail');
  
  // Toggle password
  const toggleLoginPassword = document.getElementById('toggleLoginPassword');
  const toggleSignupPassword = document.getElementById('toggleSignupPassword');
  const toggleSignupConfirm = document.getElementById('toggleSignupConfirm');
  const loginPassword = document.getElementById('loginPassword');
  const signupPassword = document.getElementById('signupPassword');
  const signupConfirm = document.getElementById('signupConfirm');

  // ---------------------------------------------
  // NOTIFICATION
  // ---------------------------------------------
  function showNotification(message, type = 'info', duration = 3000) {
    const oldNotif = document.querySelector('.temp-notification');
    if (oldNotif) oldNotif.remove();

    const notif = document.createElement('div');
    notif.className = `temp-notification ${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);

    setTimeout(() => {
      notif.style.animation = 'notif-appear 0.3s ease reverse';
      setTimeout(() => notif.remove(), 300);
    }, duration);
  }

  function shakeForm() {
    const activeForm = currentMode === 'login' ? formLogin : formSignup;
    if (activeForm) {
      activeForm.classList.add('shake');
      setTimeout(() => activeForm.classList.remove('shake'), 500);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }
  }

  // ---------------------------------------------
  // TOGGLE PASSWORD
  // ---------------------------------------------
  function setupTogglePassword() {
    if (toggleLoginPassword && loginPassword) {
      toggleLoginPassword.addEventListener('click', () => {
        const type = loginPassword.type === 'password' ? 'text' : 'password';
        loginPassword.type = type;
        toggleLoginPassword.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
      });
    }

    if (toggleSignupPassword && signupPassword) {
      toggleSignupPassword.addEventListener('click', () => {
        const type = signupPassword.type === 'password' ? 'text' : 'password';
        signupPassword.type = type;
        toggleSignupPassword.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
      });
    }

    if (toggleSignupConfirm && signupConfirm) {
      toggleSignupConfirm.addEventListener('click', () => {
        const type = signupConfirm.type === 'password' ? 'text' : 'password';
        signupConfirm.type = type;
        toggleSignupConfirm.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
      });
    }
  }

  // ---------------------------------------------
  // CHARGEMENT DU CODE SECRET (sans affichage)
  // ---------------------------------------------
  async function loadCodeSecret() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('code_secret_unique')
        .select('code')
        .limit(1)
        .single();
      
      if (error) {
        console.warn('Table code_secret_unique non trouvée');
        return;
      }
      
      if (data && data.code) {
        codeSecretUnique = data.code;
        console.log('Code secret chargé depuis la DB');
      }
    } catch (error) {
      console.warn('Erreur chargement code secret:', error);
    }
  }

  function verifierCodeSecret(codeSaisi) {
    return codeSaisi === codeSecretUnique;
  }

  // ---------------------------------------------
  // INITIALISATION
  // ---------------------------------------------
  async function init() {
    try {
      loadingOverlay?.classList.remove('hidden');
      await waitForDom();
      await initSupabase();
      await loadCodeSecret();
      await checkExistingSession();
      setupTogglePassword();
      setupEventListeners();
      
      // Appliquer le thème sauvegardé
      applySavedTheme();
      
    } catch (error) {
      console.warn('Mode démo - Supabase non disponible');
      setupTogglePassword();
      setupEventListeners();
    } finally {
      setTimeout(() => loadingOverlay?.classList.add('hidden'), 500);
    }
  }

  function applySavedTheme() {
    const savedTheme = localStorage.getItem('aej_theme') || 'day';
    if (savedTheme === 'night') {
      document.body.classList.add('night-mode');
    } else {
      document.body.classList.remove('night-mode');
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

  async function checkExistingSession() {
    if (!supabase) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        window.location.href = 'index.html';
      }
    } catch (error) {
      console.log('Pas de session active');
    }
  }

  // ---------------------------------------------
  // VALIDATIONS
  // ---------------------------------------------
  function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  // ---------------------------------------------
  // GESTION ERREURS
  // ---------------------------------------------
  function showError(element, message) {
    clearError(element);
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.textContent = message;
    element.parentElement.appendChild(errorEl);
    showNotification(message, 'error');
    shakeForm();
  }

  function clearError(element) {
    const errorEl = element.parentElement.querySelector('.error-message');
    if (errorEl) errorEl.remove();
  }

  // ---------------------------------------------
  // CHANGEMENT D'ONGLET
  // ---------------------------------------------
  function switchTab(mode) {
    currentMode = mode;
    if (mode === 'login') {
      tabLogin.classList.add('active');
      tabSignup.classList.remove('active');
      formLogin.classList.remove('hidden');
      formSignup.classList.add('hidden');
    } else {
      tabSignup.classList.add('active');
      tabLogin.classList.remove('active');
      formSignup.classList.remove('hidden');
      formLogin.classList.add('hidden');
    }
  }

  // ---------------------------------------------
  // CONNEXION (avec code secret caché)
  // ---------------------------------------------
  async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail');
    const password = document.getElementById('loginPassword');

    if (!email || !password) return;

    clearError(email);
    clearError(password);

    let hasError = false;

    if (!email.value.trim()) {
      showError(email, 'Email requis');
      hasError = true;
    } else if (!isValidEmail(email.value.trim())) {
      showError(email, 'Email invalide');
      hasError = true;
    }

    if (!password.value) {
      showError(password, 'Mot de passe requis');
      hasError = true;
    }

    if (hasError) return;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Connexion...';

    try {
      // Vérifier le code secret (caché)
      if (!codeSecretUnique) {
        throw new Error('Code secret non disponible');
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value
      });

      if (error) throw error;
      
      showNotification('Connexion réussie', 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 500);
      
    } catch (error) {
      console.error('Erreur connexion:', error);
      showError(password, 'Email ou mot de passe incorrect');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  // ---------------------------------------------
  // INSCRIPTION
  // ---------------------------------------------
  async function handleSignup(e) {
    e.preventDefault();

    const firstname = document.getElementById('signupFirstname');
    const lastname = document.getElementById('signupLastname');
    const email = document.getElementById('signupEmail');
    const password = document.getElementById('signupPassword');
    const confirm = document.getElementById('signupConfirm');
    const terms = document.getElementById('acceptTerms');

    [firstname, lastname, email, password, confirm].forEach(field => {
      if (field) clearError(field);
    });

    let hasError = false;

    if (firstname && !firstname.value.trim()) {
      showError(firstname, 'Prénom requis');
      hasError = true;
    }

    if (lastname && !lastname.value.trim()) {
      showError(lastname, 'Nom requis');
      hasError = true;
    }

    if (email && !email.value.trim()) {
      showError(email, 'Email requis');
      hasError = true;
    } else if (email && !isValidEmail(email.value.trim())) {
      showError(email, 'Email invalide');
      hasError = true;
    }

    if (password && !password.value) {
      showError(password, 'Mot de passe requis');
      hasError = true;
    }

    if (password && confirm && password.value !== confirm.value) {
      showError(confirm, 'Les mots de passe ne correspondent pas');
      hasError = true;
    }

    if (terms && !terms.checked) {
      showNotification('Vous devez accepter les conditions', 'error');
      hasError = true;
    }

    if (hasError) return;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Création...';

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.value.trim(),
        password: password.value,
        options: {
          data: {
            first_name: firstname?.value.trim() || '',
            last_name: lastname?.value.trim() || ''
          }
        }
      });

      if (error) throw error;

      showNotification('Compte créé ! Vérifiez vos emails', 'success');
      
      setTimeout(() => {
        switchTab('login');
        const loginEmail = document.getElementById('loginEmail');
        if (loginEmail && email) {
          loginEmail.value = email.value.trim();
        }
      }, 1500);
      
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      
    } catch (error) {
      console.error('Erreur inscription:', error);
      if (email) showError(email, error.message || 'Erreur inscription');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  // ---------------------------------------------
  // RÉINITIALISATION MOT DE PASSE
  // ---------------------------------------------
  function openForgotModal(e) {
    e.preventDefault();
    if (forgotModal) {
      forgotModal.classList.remove('hidden');
      setTimeout(() => resetEmail?.focus(), 100);
    }
  }

  function closeForgotModal() {
    if (forgotModal) {
      forgotModal.classList.add('hidden');
      if (resetEmail) {
        resetEmail.value = '';
        clearError(resetEmail);
      }
    }
  }

  async function handlePasswordReset() {
    if (!resetEmail) return;

    clearError(resetEmail);

    if (!resetEmail.value.trim()) {
      showError(resetEmail, 'Email requis');
      return;
    }

    if (!isValidEmail(resetEmail.value.trim())) {
      showError(resetEmail, 'Email invalide');
      return;
    }

    const originalText = sendReset.textContent;
    sendReset.disabled = true;
    sendReset.textContent = 'Envoi...';

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        resetEmail.value.trim()
      );

      if (error) throw error;

      showNotification('Email de réinitialisation envoyé', 'success');
      setTimeout(() => closeForgotModal(), 1500);
      
    } catch (error) {
      console.error('Erreur:', error);
      showError(resetEmail, error.message || 'Erreur envoi');
      sendReset.disabled = false;
      sendReset.textContent = originalText;
    }
  }

  // ---------------------------------------------
  // PARAMÈTRES URL
  // ---------------------------------------------
  function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    if (mode === 'login') switchTab('login');
    else if (mode === 'signup') switchTab('signup');
  }

  // ---------------------------------------------
  // ÉCOUTEURS
  // ---------------------------------------------
  function setupEventListeners() {
    if (!tabLogin || !tabSignup || !formLogin || !formSignup) {
      console.error('Éléments DOM manquants');
      return;
    }

    tabLogin.addEventListener('click', () => switchTab('login'));
    tabSignup.addEventListener('click', () => switchTab('signup'));

    formLogin.addEventListener('submit', handleLogin);
    formSignup.addEventListener('submit', handleSignup);

    if (forgotLink) forgotLink.addEventListener('click', openForgotModal);
    if (cancelReset) cancelReset.addEventListener('click', closeForgotModal);
    if (sendReset) sendReset.addEventListener('click', handlePasswordReset);

    if (forgotModal) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !forgotModal.classList.contains('hidden')) {
          closeForgotModal();
        }
      });
      forgotModal.addEventListener('click', (e) => {
        if (e.target === forgotModal) closeForgotModal();
      });
    }

    checkUrlParams();
    
    // Écouter les changements de thème pour synchronisation
    window.addEventListener('storage', (e) => {
      if (e.key === 'aej_theme') {
        applySavedTheme();
      }
    });
  }

  // Style pour animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
      20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    .shake { animation: shake 0.5s ease-in-out; }
  `;
  document.head.appendChild(style);

  // ---------------------------------------------
  // DÉMARRAGE
  // ---------------------------------------------
  init();
})();
