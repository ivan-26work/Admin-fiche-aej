// ===== auth.js =====
// Version avec CODE SECRET + NOTIFICATIONS HEADER + SHAKE

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
  let codeSecretUnique = 'ipote233@'; // Valeur par défaut (sera remplacée par la table)

  // ---------------------------------------------
  // ÉLÉMENTS DOM
  // ---------------------------------------------
  const header = document.querySelector('.header');
  const logoCircle = document.querySelector('.logo-circle');
  const siteName = document.querySelector('.site-name-3d');
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const formLogin = document.getElementById('formLogin');
  const formSignup = document.getElementById('formSignup');
  const forgotLink = document.getElementById('forgotPassword');
  const forgotModal = document.getElementById('forgotModal');
  const cancelReset = document.getElementById('cancelReset');
  const sendReset = document.getElementById('sendReset');
  const resetEmail = document.getElementById('resetEmail');
  const resetCodeSecret = document.getElementById('resetCodeSecret');

  // ---------------------------------------------
  // NOTIFICATION DANS LE HEADER
  // ---------------------------------------------
  function showNotification(message, type = 'info', duration = 3000) {
    // Supprimer toute notification existante
    const oldNotif = document.querySelector('.header-notification');
    if (oldNotif) oldNotif.remove();

    // Créer la notification
    const notif = document.createElement('div');
    notif.className = `header-notification ${type}`;
    notif.textContent = message;
    notif.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      height: 45px;
      border-radius: 45px;
      background: white;
      box-shadow: 0 5px 15px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 20px;
      font-size: 0.9rem;
      font-weight: 500;
      color: #2c3e50;
      border: 2px solid;
      z-index: 1100;
      white-space: nowrap;
      animation: notif-appear 0.3s ease;
    `;

    // Couleur selon type
    if (type === 'error') {
      notif.style.borderColor = '#ff7e9f';
      notif.style.background = '#fff0f3';
    } else if (type === 'success') {
      notif.style.borderColor = '#4a90e2';
      notif.style.background = '#e6f0ff';
    } else {
      notif.style.borderColor = '#6c7a8d';
    }

    // Ajouter au header
    header.style.position = 'relative';
    header.appendChild(notif);

    // Animation de shake si erreur
    if (type === 'error') {
      shakeForm();
    }

    // Disparition automatique
    setTimeout(() => {
      if (notif.parentNode) {
        notif.style.animation = 'notif-disappear 0.3s ease forwards';
        setTimeout(() => notif.remove(), 300);
      }
    }, duration);
  }

  // Style des animations (à ajouter dans le head)
  const style = document.createElement('style');
  style.textContent = `
    @keyframes notif-appear {
      from { opacity: 0; transform: translate(-50%, -40%); }
      to { opacity: 1; transform: translate(-50%, -50%); }
    }
    @keyframes notif-disappear {
      from { opacity: 1; transform: translate(-50%, -50%); }
      to { opacity: 0; transform: translate(-50%, -40%); }
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
      20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    .shake {
      animation: shake 0.5s ease-in-out;
    }
  `;
  document.head.appendChild(style);

  function shakeForm() {
    const activeForm = currentMode === 'login' ? formLogin : formSignup;
    if (activeForm) {
      activeForm.classList.add('shake');
      setTimeout(() => activeForm.classList.remove('shake'), 500);
      
      // Vibration si supportée
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  }

  // ---------------------------------------------
  // CHARGEMENT DU CODE SECRET DEPUIS LA TABLE
  // ---------------------------------------------
  async function loadCodeSecret() {
    if (!supabase) return;
    
    try {
      // Tentative de récupération depuis la table
      const { data, error } = await supabase
        .from('code_secret_unique')
        .select('code')
        .limit(1)
        .single();
      
      if (error) {
        console.warn('Table code_secret_unique non trouvée, utilisation valeur par défaut');
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

  // ---------------------------------------------
  // VÉRIFICATION DU CODE SECRET
  // ---------------------------------------------
  function verifierCodeSecret(codeSaisi) {
    return codeSaisi === codeSecretUnique;
  }

  // ---------------------------------------------
  // INITIALISATION
  // ---------------------------------------------
  async function init() {
    try {
      await waitForDom();
      await initSupabase();
      await loadCodeSecret(); // Charger le code secret depuis la table
      await checkExistingSession();
      setupEventListeners();
    } catch (error) {
      console.warn('Mode démo - Supabase non disponible');
      setupEventListeners();
    }
  }

  // ---------------------------------------------
  // ATTENDRE QUE LE DOM SOIT PRÊT
  // ---------------------------------------------
  function waitForDom() {
    return new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
  }

  // ---------------------------------------------
  // INITIALISATION SUPABASE
  // ---------------------------------------------
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

  // ---------------------------------------------
  // CHARGEMENT DYNAMIQUE SUPABASE
  // ---------------------------------------------
  function loadSupabaseScript() {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="supabase"]')) {
        const checkInterval = setInterval(() => {
          if (window.supabase) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
        setTimeout(() => reject(new Error('Timeout chargement Supabase')), 5000);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = () => window.supabase ? resolve() : reject();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // ---------------------------------------------
  // VÉRIFICATION SESSION EXISTANTE
  // ---------------------------------------------
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
  // INITIALISATION ÉCOUTEURS
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

    if (forgotLink) {
      forgotLink.addEventListener('click', openForgotModal);
    }

    if (cancelReset) {
      cancelReset.addEventListener('click', closeForgotModal);
    }

    if (sendReset) {
      sendReset.addEventListener('click', handlePasswordReset);
    }

    if (forgotModal) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !forgotModal.classList.contains('hidden')) {
          closeForgotModal();
        }
      });
      forgotModal.addEventListener('click', (e) => {
        if (e.target === forgotModal) {
          closeForgotModal();
        }
      });
    }

    checkUrlParams();
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
  // VALIDATION EMAIL
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
    errorEl.style.color = '#ff7e9f';
    errorEl.style.fontSize = '0.8rem';
    errorEl.style.marginTop = '0.3rem';
    errorEl.style.paddingLeft = '1rem';
    element.parentElement.appendChild(errorEl);
    
    // Notification dans le header
    showNotification(message, 'error');
  }

  function clearError(element) {
    const errorEl = element.parentElement.querySelector('.error-message');
    if (errorEl) errorEl.remove();
  }

  // ---------------------------------------------
  // CONNEXION
  // ---------------------------------------------
  async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail');
    const password = document.getElementById('loginPassword');
    const codeSecret = document.getElementById('loginCodeSecret');

    if (!email || !password || !codeSecret) return;

    [email, password, codeSecret].forEach(field => clearError(field));

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

    if (!codeSecret.value) {
      showError(codeSecret, 'Code secret requis');
      hasError = true;
    } else if (!verifierCodeSecret(codeSecret.value)) {
      showError(codeSecret, 'Code secret incorrect');
      hasError = true;
    }

    if (hasError) return;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Connexion...';

    try {
      if (supabase) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.value.trim(),
          password: password.value
        });

        if (error) throw error;
        
        showNotification('Connexion réussie', 'success');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 500);
      } else {
        // Mode démo
        setTimeout(() => {
          showNotification('Mode démo: Connexion réussie', 'success');
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 500);
        }, 1000);
      }
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
    const codeSecret = document.getElementById('signupCodeSecret');
    const password = document.getElementById('signupPassword');
    const confirm = document.getElementById('signupConfirm');
    const terms = document.getElementById('acceptTerms');

    [firstname, lastname, email, codeSecret, password, confirm].forEach(field => {
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

    if (codeSecret && !codeSecret.value) {
      showError(codeSecret, 'Code secret requis');
      hasError = true;
    } else if (codeSecret && !verifierCodeSecret(codeSecret.value)) {
      showError(codeSecret, 'Code secret incorrect');
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
      if (supabase) {
        const { error } = await supabase.auth.signUp({
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
        
        // Basculer vers l'onglet de connexion
        setTimeout(() => {
          switchTab('login');
          const loginEmail = document.getElementById('loginEmail');
          if (loginEmail && email) {
            loginEmail.value = email.value.trim();
          }
        }, 1500);
        
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        
      } else {
        // Mode démo
        setTimeout(() => {
          showNotification('Mode démo: Inscription réussie', 'success');
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 500);
        }, 1000);
      }
    } catch (error) {
      console.error('Erreur inscription:', error);
      if (email) showError(email, error.message || 'Erreur inscription');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  // ---------------------------------------------
  // MODALE RÉINITIALISATION
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
      if (resetCodeSecret) {
        resetCodeSecret.value = '';
        clearError(resetCodeSecret);
      }
    }
  }

  async function handlePasswordReset() {
    if (!resetEmail || !resetCodeSecret) return;

    clearError(resetEmail);
    clearError(resetCodeSecret);

    let hasError = false;

    if (!resetEmail.value.trim()) {
      showError(resetEmail, 'Email requis');
      hasError = true;
    } else if (!isValidEmail(resetEmail.value.trim())) {
      showError(resetEmail, 'Email invalide');
      hasError = true;
    }

    if (!resetCodeSecret.value) {
      showError(resetCodeSecret, 'Code secret requis');
      hasError = true;
    } else if (!verifierCodeSecret(resetCodeSecret.value)) {
      showError(resetCodeSecret, 'Code secret incorrect');
      hasError = true;
    }

    if (hasError) return;

    const originalText = sendReset.textContent;
    sendReset.disabled = true;
    sendReset.textContent = 'Envoi...';

    try {
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(
          resetEmail.value.trim()
        );

        if (error) throw error;

        showNotification('Email de réinitialisation envoyé', 'success');
        setTimeout(() => closeForgotModal(), 1500);
      } else {
        // Mode démo
        setTimeout(() => {
          showNotification('Mode démo: Email envoyé', 'success');
          setTimeout(() => closeForgotModal(), 1500);
        }, 1000);
      }
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
  // DÉMARRAGE
  // ---------------------------------------------
  init();
})();