// ===== index.js =====
// Version AEJ - Sans compteur de téléchargements

(function() {
  // ---------------------------------------------
  // CONFIGURATION
  // ---------------------------------------------
  const SUPABASE_URL = 'https://lnwrwvwunwsqeuluupis.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxud3J3dnd1bndzcWV1bHV1cGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NjU2ODYsImV4cCI6MjA4OTM0MTY4Nn0.gfnPMtR3mNBFMTo3GtZ9t1A9_8gxEHY4loLgLdLJxLs';

  // ---------------------------------------------
  // ÉTAT INTERNE
  // ---------------------------------------------
  let currentUser = null;
  let allFiles = [];
  let categories = [];
  let selectedCategories = new Set();
  let selectedDates = new Set();
  let supabase = null;
  let currentPreviewFile = null;
  
  // État multi-sélection fichiers
  let selectionMode = false;
  let selectedFiles = new Set();
  let longPressTimer = null;
  const LONG_PRESS_DELAY = 1000;
  
  // État suppression catégorie
  let categoryDeleteMode = false;
  let selectedCategoryForDelete = null;
  let categoryLongPressTimer = null;
  const CATEGORY_LONG_PRESS_DELAY = 1100;
  
  // Cache session
  let sessionCache = {
    timestamp: null,
    user: null
  };
  
  // Upload state
  let uploadState = {
    active: false,
    totalFiles: 0,
    completedFiles: 0,
    currentCategoryId: null
  };

  // ---------------------------------------------
  // ÉLÉMENTS DOM
  // ---------------------------------------------
  const loadingOverlay = document.getElementById('loadingOverlay');
  const syncLoader = document.getElementById('syncLoader');
  const deleteLoader = document.getElementById('deleteLoader');
  const mainContent = document.getElementById('mainContent');
  const searchContainer = document.getElementById('searchContainer');
  const searchInput = document.getElementById('searchInput');
  const multiSelectActions = document.getElementById('multiSelectActions');
  const selectCount = document.getElementById('selectCount');
  const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const cancelSelectBtn = document.getElementById('cancelSelectBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const fabContainer = document.getElementById('fabContainer');
  const uploadBtn = document.getElementById('uploadBtn');
  const statsRow = document.getElementById('statsRow');
  const categoriesRow = document.getElementById('categoriesRow');
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const categoryOverlay = document.getElementById('categoryOverlay');
  const categoryOverlayBackdrop = document.getElementById('categoryOverlayBackdrop');
  const categoryOverlayContent = document.getElementById('categoryOverlayContent');
  
  // Overlay
  const fileOverlay = document.getElementById('fileOverlay');
  const overlayBackdrop = document.getElementById('overlayBackdrop');
  const overlayFilename = document.getElementById('overlayFilename');
  const overlayContent = document.getElementById('overlayContent');
  const overlayMetadata = document.getElementById('overlayMetadata');
  const overlayDownload = document.getElementById('overlayDownload');
  const overlayDelete = document.getElementById('overlayDelete');
  const overlayFullscreen = document.getElementById('overlayFullscreen');
  const overlayClose = document.getElementById('overlayClose');

  // ---------------------------------------------
  // Overlay d'erreur de format
  // ---------------------------------------------
  const formatErrorOverlay = document.createElement('div');
  formatErrorOverlay.className = 'format-error-overlay hidden';
  formatErrorOverlay.innerHTML = `
    <div class="overlay-backdrop"></div>
    <div class="format-error-container">
      <div class="format-error-header">
        <i class="fas fa-exclamation-triangle"></i>
        <span>Format de fichier invalide</span>
      </div>
      <div class="format-error-content">
        <p>Le nom du fichier doit respecter le format :</p>
        <p class="format-example">[Matricule] [Lettre] [Nom] [Désignation].pdf</p>
        <p class="format-example-small">Exemple : 19167122 F IPOTE fiche.pdf</p>
        <p class="format-detail">Détails :</p>
        <ul>
          <li>Matricule : chiffres</li>
          <li>Lettre : une lettre (ex: F, M, ...)</li>
          <li>Nom : au moins 2 lettres majuscules</li>
        </ul>
      </div>
      <div class="format-error-actions">
        <button class="format-error-btn" id="formatErrorClose">Compris</button>
      </div>
    </div>
  `;
  document.body.appendChild(formatErrorOverlay);

  // Style pour l'overlay de format
  const style = document.createElement('style');
  style.textContent = `
    .format-error-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 5000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .format-error-overlay:not(.hidden) {
      opacity: 1;
      pointer-events: all;
    }
    .format-error-container {
      position: relative;
      background: white;
      border-radius: 30px;
      width: 400px;
      max-width: 90vw;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      z-index: 5001;
    }
    .format-error-header {
      background: linear-gradient(135deg, #ff7e9f, #4a90e2);
      color: white;
      padding: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
    }
    .format-error-header i {
      font-size: 1.2rem;
    }
    .format-error-content {
      padding: 1.5rem;
      background: #f8f9fa;
    }
    .format-example {
      font-family: monospace;
      background: #eef0f5;
      padding: 0.5rem;
      border-radius: 8px;
      margin: 0.5rem 0;
      font-weight: 500;
    }
    .format-example-small {
      font-size: 0.9rem;
      color: #666;
      margin-bottom: 1rem;
    }
    .format-detail {
      font-weight: 600;
      margin: 0.5rem 0 0.2rem 0;
    }
    .format-error-content ul {
      margin: 0.2rem 0 0 1.5rem;
      color: #555;
    }
    .format-error-actions {
      padding: 1rem;
      display: flex;
      justify-content: center;
      border-top: 1px solid #eee;
    }
    .format-error-btn {
      padding: 0.5rem 2rem;
      background: linear-gradient(135deg, #4a90e2, #ff7e9f);
      color: white;
      border: none;
      border-radius: 30px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .format-error-btn:hover {
      transform: translateY(-2px);
    }

    /* Barre d'actions pour suppression catégorie */
    .category-delete-actions {
      flex: 1;
      max-width: 400px;
      margin: 0 1.5rem;
      background: white;
      border-radius: 40px;
      box-shadow: var(--neu-shadow-medium);
      height: 46px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1rem;
      transition: all 0.3s;
      border: double 2px transparent;
      background-image: linear-gradient(white, white), 
                        linear-gradient(135deg, #4a90e2, #ff7e9f);
      background-origin: border-box;
      background-clip: padding-box, border-box;
    }
    .category-delete-actions.hidden {
      display: none;
    }
    .category-delete-label {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-dark);
      white-space: nowrap;
    }
    .category-delete-buttons {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .delete-category-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: white;
      box-shadow: var(--neu-shadow-small);
      color: #d32f2f;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .delete-category-btn:hover {
      transform: translateY(-2px);
      box-shadow: var(--neu-shadow-medium);
      background: #ffebee;
    }
    .cancel-category-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: white;
      box-shadow: var(--neu-shadow-small);
      color: var(--text-dark);
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cancel-category-btn:hover {
      transform: translateY(-2px);
      box-shadow: var(--neu-shadow-medium);
      color: var(--primary-pink);
    }
  `;
  document.head.appendChild(style);

  // ---------------------------------------------
  // INITIALISATION
  // ---------------------------------------------
  async function init() {
    try {
      await waitForDom();
      
      const sessionPromise = initSupabase().then(() => checkSession());
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1500));
      
      await Promise.race([sessionPromise, timeoutPromise]);
      
      setupEventListeners();
      setupOverlayListeners();
      setupMultiSelectListeners();
      setupCategoryDeleteListeners();
      setupFormatErrorOverlay();
      
    } catch (error) {
      console.warn('Erreur initialisation, redirection vers auth');
      redirectToAuth();
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

  // ---------------------------------------------
  // VÉRIFICATION SESSION
  // ---------------------------------------------
  async function checkSession() {
    try {
      if (!supabase) throw new Error('Supabase non initialisé');
      
      if (sessionCache.timestamp && (Date.now() - sessionCache.timestamp < 30000)) {
        currentUser = sessionCache.user;
        if (currentUser) {
          loadUserData();
          return;
        }
      }
      
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      if (!user) {
        redirectToAuth();
        return;
      }
      
      currentUser = user;
      sessionCache = {
        timestamp: Date.now(),
        user: user
      };
      
      loadUserData();
      
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
  async function loadUserData() {
    try {
      if (loadingOverlay) loadingOverlay.classList.remove('hidden');
      
      await Promise.all([
        loadCategories(),
        loadFiles()
      ]);
      
      updateUI();
      
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setTimeout(() => {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
      }, 300);
    }
  }

  async function loadCategories() {
    if (!currentUser || !supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('dossiers')
        .select('*')
        .eq('user_id', currentUser.id)
        .is('parent_id', null)
        .order('nom');
      
      if (error) throw error;
      
      categories = data || [];
      
      if (uploadBtn) {
        uploadBtn.disabled = categories.length === 0;
      }
      
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
      categories = [];
    }
  }

  async function loadFiles() {
    if (!currentUser || !supabase) return;
    
    try {
      const { data: filesData, error: filesError } = await supabase
        .from('fichiers')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('date_upload', { ascending: false });
      
      if (filesError) throw filesError;
      
      const { data: liaisonsData, error: liaisonsError } = await supabase
        .from('dossier_fichiers')
        .select('*')
        .in('fichier_id', filesData.map(f => f.id));
      
      if (liaisonsError) throw liaisonsError;
      
      const liaisonsMap = {};
      liaisonsData.forEach(l => {
        liaisonsMap[l.fichier_id] = l.dossier_id;
      });
      
      allFiles = filesData.map(file => ({
        ...file,
        categorie_id: liaisonsMap[file.id] || null
      }));
      
    } catch (error) {
      console.error('Erreur chargement fichiers:', error);
      allFiles = [];
    }
  }

  // ---------------------------------------------
  // GESTION CATÉGORIES
  // ---------------------------------------------
  async function createCategory() {
    const nom = prompt('Nom de la nouvelle catégorie :');
    if (!nom || !nom.trim()) return;
    
    try {
      if (!supabase || !currentUser) return;
      
      const { error } = await supabase
        .from('dossiers')
        .insert({
          user_id: currentUser.id,
          nom: nom.trim(),
          parent_id: null
        });
      
      if (error) throw error;
      
      await loadCategories();
      updateCategoriesUI();
      
      if (categories.length === 1 && uploadBtn) {
        uploadBtn.disabled = false;
      }
      
      showNotification('Catégorie créée', 'success');
      
    } catch (error) {
      console.error('Erreur création catégorie:', error);
      showNotification('Erreur lors de la création', 'error');
    }
  }

  async function deleteCategory(categoryId) {
    if (!categoryId) return;
    
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;
    
    const confirmMsg = `Supprimer définitivement la catégorie "${category.nom}" et TOUS ses fichiers ?`;
    
    if (!confirm(confirmMsg)) return;
    
    showDeleteLoader(`Catégorie ${category.nom}`);
    
    try {
      // Récupérer tous les fichiers de cette catégorie
      const filesToDelete = allFiles.filter(f => f.categorie_id === categoryId);
      
      for (const file of filesToDelete) {
        // Supprimer liaisons
        await supabase
          .from('dossier_fichiers')
          .delete()
          .eq('fichier_id', file.id);
        
        // Supprimer du storage
        await supabase.storage
          .from('fichiers')
          .remove([file.chemin_storage]);
        
        // Supprimer de la table fichiers
        await supabase
          .from('fichiers')
          .delete()
          .eq('id', file.id);
      }
      
      // Supprimer la catégorie
      await supabase
        .from('dossiers')
        .delete()
        .eq('id', categoryId);
      
      await loadCategories();
      await loadFiles();
      updateUI();
      
      showNotification('Catégorie supprimée', 'success');
      
    } catch (error) {
      console.error('Erreur suppression catégorie:', error);
      showNotification('Erreur lors de la suppression', 'error');
    } finally {
      hideDeleteLoader();
      exitCategoryDeleteMode();
    }
  }

  function enterCategoryDeleteMode(categoryId) {
    if (categoryDeleteMode || selectionMode) return;
    
    categoryDeleteMode = true;
    selectedCategoryForDelete = categoryId;
    
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;
    
    // Créer ou montrer la barre d'actions
    let deleteBar = document.getElementById('categoryDeleteActions');
    if (!deleteBar) {
      deleteBar = document.createElement('div');
      deleteBar.id = 'categoryDeleteActions';
      deleteBar.className = 'category-delete-actions';
      deleteBar.innerHTML = `
        <span class="category-delete-label">Supprimer "${category.nom}" ?</span>
        <div class="category-delete-buttons">
          <button class="delete-category-btn" id="confirmDeleteCategory" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
          <button class="cancel-category-btn" id="cancelDeleteCategory" title="Annuler">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      
      // Insérer après la barre de recherche
      if (searchContainer && searchContainer.parentNode) {
        searchContainer.parentNode.insertBefore(deleteBar, searchContainer.nextSibling);
      }
      
      document.getElementById('confirmDeleteCategory')?.addEventListener('click', () => {
        deleteCategory(selectedCategoryForDelete);
      });
      
      document.getElementById('cancelDeleteCategory')?.addEventListener('click', () => {
        exitCategoryDeleteMode();
      });
    } else {
      const label = deleteBar.querySelector('.category-delete-label');
      if (label) label.textContent = `Supprimer "${category.nom}" ?`;
      deleteBar.classList.remove('hidden');
    }
    
    if (searchContainer) searchContainer.classList.add('hidden');
    if (multiSelectActions) multiSelectActions.classList.add('hidden');
  }

  function exitCategoryDeleteMode() {
    categoryDeleteMode = false;
    selectedCategoryForDelete = null;
    
    const deleteBar = document.getElementById('categoryDeleteActions');
    if (deleteBar) deleteBar.classList.add('hidden');
    
    if (searchContainer) searchContainer.classList.remove('hidden');
  }

  // ---------------------------------------------
  // VALIDATION DU FORMAT DE NOM DE FICHIER
  // ---------------------------------------------
  function validateFilenameFormat(filename) {
    const nameWithoutExt = filename.replace(/\.pdf$/i, '');
    const pattern = /^(\d+)\s+([A-Z])\s+([A-Z]{2,})\s+(.+)$/;
    return pattern.test(nameWithoutExt);
  }

  function showFormatErrorOverlay() {
    formatErrorOverlay.classList.remove('hidden');
  }

  function setupFormatErrorOverlay() {
    const closeBtn = document.getElementById('formatErrorClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        formatErrorOverlay.classList.add('hidden');
      });
    }
    
    formatErrorOverlay.addEventListener('click', (e) => {
      if (e.target === formatErrorOverlay) {
        formatErrorOverlay.classList.add('hidden');
      }
    });
  }

  // ---------------------------------------------
  // EXTRACTION MATRICULE
  // ---------------------------------------------
  function extractMatriculeFromFilename(filename) {
    const normalized = filename.replace(/_/g, ' ');
    const parts = normalized.split(' ');
    return parts.length >= 1 ? parts[0] : null;
  }

  async function checkMatriculeExists(matricule) {
    if (!supabase || !currentUser) return false;
    
    try {
      const { data, error } = await supabase
        .from('fichiers')
        .select('id')
        .eq('user_id', currentUser.id)
        .filter('nom', 'ilike', `${matricule}%`);
      
      if (error) throw error;
      return data && data.length > 0;
      
    } catch (error) {
      console.error('Erreur vérification matricule:', error);
      return false;
    }
  }

  // ---------------------------------------------
  // UPLOAD
  // ---------------------------------------------
  function openCategoryOverlay() {
    if (categories.length === 0) {
      showNotification('Créez d\'abord une catégorie', 'error');
      return;
    }
    
    renderCategoryOverlay();
    categoryOverlay.classList.remove('hidden');
  }

  function renderCategoryOverlay() {
    if (!categoryOverlayContent) return;
    
    const fileCountByCategory = {};
    categories.forEach(cat => fileCountByCategory[cat.id] = 0);
    
    allFiles.forEach(file => {
      if (file.categorie_id && fileCountByCategory.hasOwnProperty(file.categorie_id)) {
        fileCountByCategory[file.categorie_id]++;
      }
    });
    
    categoryOverlayContent.innerHTML = categories.map(cat => `
      <div class="category-overlay-item" data-category-id="${cat.id}">
        <span class="category-overlay-name">${cat.nom}</span>
        <span class="category-overlay-count">${fileCountByCategory[cat.id] || 0}</span>
      </div>
    `).join('');
    
    document.querySelectorAll('.category-overlay-item').forEach(item => {
      item.addEventListener('click', () => {
        const categoryId = item.dataset.categoryId;
        closeCategoryOverlay();
        startUpload(categoryId);
      });
    });
  }

  function closeCategoryOverlay() {
    categoryOverlay.classList.add('hidden');
  }

  function startUpload(categoryId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,application/pdf';
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      
      const pdfFiles = files.filter(f => 
        f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );
      
      if (pdfFiles.length === 0) {
        showNotification('Veuillez sélectionner des fichiers PDF', 'error');
        return;
      }
      
      const invalidFiles = pdfFiles.filter(f => !validateFilenameFormat(f.name));
      
      if (invalidFiles.length > 0) {
        showFormatErrorOverlay();
        console.warn('Fichiers au format invalide:', invalidFiles.map(f => f.name));
        return;
      }
      
      uploadState = {
        active: true,
        totalFiles: pdfFiles.length,
        completedFiles: 0,
        currentCategoryId: categoryId
      };
      
      if (searchContainer) searchContainer.classList.add('hidden');
      if (syncLoader) {
        syncLoader.classList.remove('hidden');
        updateSyncLoader();
      }
      
      for (const file of pdfFiles) {
        await processUpload(file, categoryId);
        uploadState.completedFiles++;
        updateSyncLoader();
      }
      
      await loadFiles();
      
      if (syncLoader) syncLoader.classList.add('hidden');
      if (searchContainer) searchContainer.classList.remove('hidden');
      
      updateUI();
      
      if (uploadState.completedFiles < uploadState.totalFiles) {
        showNotification('Certains fichiers n\'ont pas été uploadés', 'error');
      }
    };
    input.click();
  }

  async function processUpload(file, categoryId) {
    try {
      if (!supabase || !currentUser) return;
      
      const matricule = extractMatriculeFromFilename(file.name);
      if (!matricule) return;
      
      const existe = await checkMatriculeExists(matricule);
      
      if (existe) {
        const action = confirm(
          `Le matricule ${matricule} existe déjà.\n\nOK = Remplacer l'ancien fichier\nAnnuler = Ignorer ce fichier`
        );
        
        if (!action) return;
        
        const { data: oldFiles } = await supabase
          .from('fichiers')
          .select('id, chemin_storage')
          .eq('user_id', currentUser.id)
          .filter('nom', 'ilike', `${matricule}%`);
        
        for (const oldFile of oldFiles || []) {
          await supabase
            .from('dossier_fichiers')
            .delete()
            .eq('fichier_id', oldFile.id);
          
          await supabase.storage
            .from('fichiers')
            .remove([oldFile.chemin_storage]);
          
          await supabase
            .from('fichiers')
            .delete()
            .eq('id', oldFile.id);
        }
      }
      
      const safeFileName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\s+/g, '_');
      
      const path = `${currentUser.id}/${Date.now()}_${safeFileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('fichiers')
        .upload(path, file);
      
      if (uploadError) throw uploadError;
      
      const { data: newFile, error: insertError } = await supabase
        .from('fichiers')
        .insert({
          user_id: currentUser.id,
          nom: file.name,
          type_mime: file.type || 'application/pdf',
          taille: file.size,
          chemin_storage: path,
          bucket: 'fichiers'
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      await supabase
        .from('dossier_fichiers')
        .insert({
          dossier_id: categoryId,
          fichier_id: newFile.id
        });
      
    } catch (error) {
      console.error('Erreur upload:', file.name, error);
      showNotification(`Erreur: ${file.name}`, 'error');
    }
  }

  function updateSyncLoader() {
    if (!syncLoader) return;
    const countEl = syncLoader.querySelector('.sync-count');
    if (countEl) {
      countEl.textContent = `${uploadState.completedFiles}/${uploadState.totalFiles}`;
    }
  }

  // ---------------------------------------------
  // FILTRAGE
  // ---------------------------------------------
  function getFilteredFiles() {
    let filtered = [...allFiles];
    
    if (selectedCategories.size > 0) {
      filtered = filtered.filter(file => 
        file.categorie_id && selectedCategories.has(file.categorie_id)
      );
    }
    
    if (selectedDates.size > 0) {
      filtered = filtered.filter(file => {
        const dateStr = formatDateKey(new Date(file.date_upload));
        return selectedDates.has(dateStr);
      });
    }
    
    const searchTerm = searchInput?.value.toLowerCase().trim();
    if (searchTerm) {
      filtered = filtered.filter(file => 
        file.nom.toLowerCase().includes(searchTerm)
      );
    }
    
    return filtered;
  }

  function formatDateKey(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function formatDateDisplay(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // ---------------------------------------------
  // RENDU UI
  // ---------------------------------------------
  function updateUI() {
    updateCategoriesUI();
    updateStatsUI();
    renderFiles();
  }

  function updateCategoriesUI() {
    if (!categoriesRow) return;
    
    const fileCountByCategory = {};
    categories.forEach(cat => fileCountByCategory[cat.id] = 0);
    
    allFiles.forEach(file => {
      if (file.categorie_id && fileCountByCategory.hasOwnProperty(file.categorie_id)) {
        fileCountByCategory[file.categorie_id]++;
      }
    });
    
    categoriesRow.innerHTML = categories.map(cat => `
      <div class="category-pill ${selectedCategories.has(cat.id) ? 'active' : ''}" 
           data-category-id="${cat.id}"
           data-category-name="${cat.nom}">
        <i class="fas fa-folder"></i>
        <span>${cat.nom}</span>
        <span class="category-count">(${fileCountByCategory[cat.id] || 0})</span>
      </div>
    `).join('');
    
    document.querySelectorAll('.category-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        if (categoryDeleteMode) {
          exitCategoryDeleteMode();
          return;
        }
        const catId = pill.dataset.categoryId;
        toggleCategoryFilter(catId);
      });
      
      // Appui long pour suppression catégorie
      let pressTimer;
      
      pill.addEventListener('mousedown', () => {
        if (selectionMode || categoryDeleteMode) return;
        pressTimer = setTimeout(() => {
          const catId = pill.dataset.categoryId;
          enterCategoryDeleteMode(catId);
          if (navigator.vibrate) navigator.vibrate(50);
        }, CATEGORY_LONG_PRESS_DELAY);
      });
      
      pill.addEventListener('mouseup', () => clearTimeout(pressTimer));
      pill.addEventListener('mouseleave', () => clearTimeout(pressTimer));
      
      pill.addEventListener('touchstart', (e) => {
        if (selectionMode || categoryDeleteMode) return;
        pressTimer = setTimeout(() => {
          const catId = pill.dataset.categoryId;
          enterCategoryDeleteMode(catId);
          if (navigator.vibrate) navigator.vibrate(50);
        }, CATEGORY_LONG_PRESS_DELAY);
      }, { passive: true });
      
      pill.addEventListener('touchend', () => clearTimeout(pressTimer));
      pill.addEventListener('touchcancel', () => clearTimeout(pressTimer));
    });
  }

  function toggleCategoryFilter(catId) {
    if (selectedCategories.has(catId)) {
      selectedCategories.delete(catId);
    } else {
      selectedCategories.add(catId);
    }
    updateCategoriesUI();
    renderFiles();
  }

  function updateStatsUI() {
    if (!statsRow) return;
    
    const filesByDate = {};
    allFiles.forEach(file => {
      const dateKey = formatDateKey(new Date(file.date_upload));
      if (!filesByDate[dateKey]) filesByDate[dateKey] = [];
      filesByDate[dateKey].push(file);
    });
    
    const sortedDates = Object.keys(filesByDate).sort((a, b) => {
      const [da, ma, ya] = a.split('/').map(Number);
      const [db, mb, yb] = b.split('/').map(Number);
      return new Date(yb, mb-1, db) - new Date(ya, ma-1, da);
    });
    
    statsRow.innerHTML = sortedDates.map(date => `
      <div class="stat-item ${selectedDates.has(date) ? 'active' : ''}" data-date="${date}">
        <i class="fas fa-calendar"></i>
        <span class="stat-count">${date} (${filesByDate[date].length})</span>
      </div>
    `).join('');
    
    document.querySelectorAll('.stat-item').forEach(item => {
      item.addEventListener('click', () => {
        const date = item.dataset.date;
        toggleDateFilter(date);
      });
    });
  }

  function toggleDateFilter(date) {
    if (selectedDates.has(date)) {
      selectedDates.delete(date);
    } else {
      selectedDates.add(date);
    }
    updateStatsUI();
    renderFiles();
  }

  function renderFiles() {
    if (!mainContent) return;
    
    const filtered = getFilteredFiles();
    
    if (categories.length === 0) {
      mainContent.innerHTML = `
        <div class="empty-category-message">
          <i class="fas fa-folder-open"></i>
          <p>Créez votre première catégorie</p>
        </div>
      `;
      return;
    }
    
    if (filtered.length === 0) {
      mainContent.innerHTML = `
        <div class="empty-state">
          Aucun fichier trouvé
        </div>
      `;
      return;
    }
    
    const filesByDate = {};
    filtered.forEach(file => {
      const dateKey = formatDateKey(new Date(file.date_upload));
      if (!filesByDate[dateKey]) filesByDate[dateKey] = [];
      filesByDate[dateKey].push(file);
    });
    
    const sortedDates = Object.keys(filesByDate).sort((a, b) => {
      const [da, ma, ya] = a.split('/').map(Number);
      const [db, mb, yb] = b.split('/').map(Number);
      return new Date(yb, mb-1, db) - new Date(ya, ma-1, da);
    });
    
    let html = '<div class="files-grid">';
    
    sortedDates.forEach(date => {
      html += `<div class="date-header">${date}</div>`;
      
      filesByDate[date].forEach(file => {
        html += `
          <div class="file-item" data-id="${file.id}" 
               data-file='${JSON.stringify(file).replace(/'/g, "&apos;")}'>
            <div class="file-name-row" title="${file.nom}">
              ${truncateName(file.nom)}
            </div>
            <div class="file-image-row">
              <div class="file-thumbnail-container">
                <i class="fas fa-file-pdf"></i>
              </div>
            </div>
          </div>
        `;
      });
    });
    
    html += '</div>';
    mainContent.innerHTML = html;
    
    setupFileClickListeners();
    setupLongPressListeners();
  }

  // ---------------------------------------------
  // SÉLECTION MULTIPLE FICHIERS
  // ---------------------------------------------
  function enterSelectionMode(fileId) {
    if (selectionMode || categoryDeleteMode) return;
    
    selectionMode = true;
    selectedFiles.clear();
    selectedFiles.add(fileId);
    
    if (searchContainer) searchContainer.classList.add('hidden');
    if (multiSelectActions) {
      multiSelectActions.classList.remove('hidden');
      updateSelectCount();
    }
    
    updateSelectedFilesUI();
  }

  function exitSelectionMode() {
    selectionMode = false;
    selectedFiles.clear();
    
    if (searchContainer) searchContainer.classList.remove('hidden');
    if (multiSelectActions) multiSelectActions.classList.add('hidden');
    
    updateSelectedFilesUI();
  }

  function toggleSelectFile(fileId) {
    if (!selectionMode) return;
    
    if (selectedFiles.has(fileId)) {
      selectedFiles.delete(fileId);
    } else {
      selectedFiles.add(fileId);
    }
    
    updateSelectCount();
    updateSelectedFilesUI();
    
    if (selectedFiles.size === 0) exitSelectionMode();
  }

  function updateSelectCount() {
    if (selectCount) {
      const count = selectedFiles.size;
      selectCount.textContent = count === 1 ? '1 sélectionné' : `${count} sélectionnés`;
    }
  }

  function updateSelectedFilesUI() {
    document.querySelectorAll('.file-item').forEach(item => {
      const fileId = item.dataset.id;
      if (selectionMode && selectedFiles.has(fileId)) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  async function downloadSelected() {
    if (selectedFiles.size === 0) return;
    
    for (const fileId of selectedFiles) {
      const file = allFiles.find(f => f.id === fileId);
      if (file) await forceDownload(file);
    }
    
    exitSelectionMode();
  }

  async function deleteSelected() {
    if (selectedFiles.size === 0) return;
    
    const confirmMsg = selectedFiles.size === 1 
      ? 'Supprimer définitivement ce fichier ?' 
      : `Supprimer définitivement ces ${selectedFiles.size} fichiers ?`;
    
    if (!confirm(confirmMsg)) return;
    
    showDeleteLoader(`${selectedFiles.size} fichiers`);
    
    for (const fileId of selectedFiles) {
      const file = allFiles.find(f => f.id === fileId);
      if (file) {
        try {
          await supabase
            .from('dossier_fichiers')
            .delete()
            .eq('fichier_id', file.id);
          
          await supabase.storage
            .from('fichiers')
            .remove([file.chemin_storage]);
          
          await supabase
            .from('fichiers')
            .delete()
            .eq('id', file.id);
          
        } catch (error) {
          console.error('Erreur suppression:', file.nom, error);
        }
      }
    }
    
    hideDeleteLoader();
    
    await loadFiles();
    updateUI();
    exitSelectionMode();
  }

  function setupLongPressListeners() {
    document.querySelectorAll('.file-item').forEach(item => {
      let pressTimer;
      
      item.addEventListener('mousedown', (e) => {
        if (e.button === 2 || selectionMode || categoryDeleteMode) return;
        pressTimer = setTimeout(() => {
          const fileId = item.dataset.id;
          enterSelectionMode(fileId);
        }, LONG_PRESS_DELAY);
      });
      
      item.addEventListener('mouseup', () => clearTimeout(pressTimer));
      item.addEventListener('mouseleave', () => clearTimeout(pressTimer));
      
      item.addEventListener('touchstart', (e) => {
        if (selectionMode || categoryDeleteMode) return;
        pressTimer = setTimeout(() => {
          const fileId = item.dataset.id;
          enterSelectionMode(fileId);
          if (navigator.vibrate) navigator.vibrate(50);
        }, LONG_PRESS_DELAY);
      }, { passive: true });
      
      item.addEventListener('touchend', () => clearTimeout(pressTimer));
      item.addEventListener('touchcancel', () => clearTimeout(pressTimer));
    });
  }

  function setupFileClickListeners() {
    document.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (selectionMode) {
          const fileId = item.dataset.id;
          toggleSelectFile(fileId);
        } else if (!categoryDeleteMode) {
          const fileData = JSON.parse(item.dataset.file.replace(/&apos;/g, "'"));
          openFilePreview(fileData);
        }
      });
    });
  }

  // ---------------------------------------------
  // TÉLÉCHARGEMENT FORCÉ
  // ---------------------------------------------
  async function forceDownload(file) {
    try {
      showNotification(`Préparation de ${file.nom}...`);
      
      const { data: urlData } = supabase.storage
        .from(file.bucket || 'fichiers')
        .getPublicUrl(file.chemin_storage);
      
      const response = await fetch(urlData.publicUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.nom;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
      
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      showNotification(`Erreur téléchargement ${file.nom}`, 'error');
    }
  }

  // ---------------------------------------------
  // OVERLAY DE VISUALISATION
  // ---------------------------------------------
  function openFilePreview(file) {
    if (selectionMode || categoryDeleteMode) return;
    
    currentPreviewFile = file;
    const { publicUrl } = supabase.storage
      .from(file.bucket || 'fichiers')
      .getPublicUrl(file.chemin_storage).data;
    
    overlayFilename.textContent = file.nom;
    
    overlayContent.innerHTML = `
      <iframe src="https://docs.google.com/viewer?url=${encodeURIComponent(publicUrl)}&embedded=true" 
              class="overlay-pdf-preview"></iframe>
    `;
    
    const date = new Date(file.date_upload);
    overlayMetadata.innerHTML = `
      <span><i class="fas fa-calendar"></i> ${formatDateDisplay(date)}</span>
      <span class="separator">•</span>
      <span><i class="fas fa-clock"></i> ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
      <span class="separator">•</span>
      <span><i class="fas fa-weight-hanging"></i> ${formatFileSize(file.taille)}</span>
    `;
    
    fileOverlay.classList.remove('hidden');
  }

  function closePreview() {
    fileOverlay.classList.add('hidden');
    overlayContent.innerHTML = '';
    currentPreviewFile = null;
  }

  function setupOverlayListeners() {
    if (overlayClose) overlayClose.addEventListener('click', closePreview);
    if (overlayBackdrop) overlayBackdrop.addEventListener('click', closePreview);
    
    if (overlayDownload) {
      overlayDownload.addEventListener('click', () => {
        if (currentPreviewFile) forceDownload(currentPreviewFile);
      });
    }
    
    if (overlayDelete) {
      overlayDelete.addEventListener('click', async () => {
        if (!currentPreviewFile) return;
        
        if (confirm(`Supprimer définitivement "${currentPreviewFile.nom}" ?`)) {
          showDeleteLoader(currentPreviewFile.nom);
          closePreview();
          
          try {
            await supabase
              .from('dossier_fichiers')
              .delete()
              .eq('fichier_id', currentPreviewFile.id);
            
            await supabase.storage
              .from('fichiers')
              .remove([currentPreviewFile.chemin_storage]);
            
            await supabase
              .from('fichiers')
              .delete()
              .eq('id', currentPreviewFile.id);
            
            await loadFiles();
            updateUI();
          } catch (error) {
            console.error('Erreur suppression:', error);
            showNotification('Erreur lors de la suppression', 'error');
          } finally {
            hideDeleteLoader();
          }
        }
      });
    }
    
    if (overlayFullscreen) {
      overlayFullscreen.addEventListener('click', () => {
        if (currentPreviewFile) {
          const { publicUrl } = supabase.storage
            .from(currentPreviewFile.bucket || 'fichiers')
            .getPublicUrl(currentPreviewFile.chemin_storage).data;
          window.open(publicUrl, '_blank');
        }
      });
    }
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !fileOverlay.classList.contains('hidden')) {
        closePreview();
      }
    });
  }

  function setupMultiSelectListeners() {
    if (downloadSelectedBtn) {
      downloadSelectedBtn.addEventListener('click', downloadSelected);
    }
    
    if (deleteSelectedBtn) {
      deleteSelectedBtn.addEventListener('click', deleteSelected);
    }
    
    if (cancelSelectBtn) {
      cancelSelectBtn.addEventListener('click', exitSelectionMode);
    }
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && selectionMode) {
        exitSelectionMode();
      }
      if (e.key === 'Escape' && categoryDeleteMode) {
        exitCategoryDeleteMode();
      }
    });
  }

  function setupCategoryDeleteListeners() {
    // Déjà géré dans updateCategoriesUI
  }

  // ---------------------------------------------
  // LOADERS ET NOTIFICATIONS
  // ---------------------------------------------
  function showDeleteLoader(filename) {
    const loader = document.getElementById('deleteLoader');
    const textEl = loader?.querySelector('.delete-loader-text');
    if (textEl) textEl.textContent = `Suppression ${filename}...`;
    if (loader) loader.classList.remove('hidden');
  }

  function hideDeleteLoader() {
    const loader = document.getElementById('deleteLoader');
    if (loader) loader.classList.add('hidden');
  }

  function showNotification(message, type = 'info', duration = 3000) {
    let notif = document.getElementById('temp-notification');
    if (!notif) {
      notif = document.createElement('div');
      notif.id = 'temp-notification';
      document.body.appendChild(notif);
    }
    
    notif.className = `header-notification ${type}`;
    notif.textContent = message;
    notif.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
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
    
    if (type === 'error') {
      notif.style.borderColor = '#ff7e9f';
      notif.style.background = '#fff0f3';
    } else if (type === 'success') {
      notif.style.borderColor = '#4a90e2';
      notif.style.background = '#e6f0ff';
    } else {
      notif.style.borderColor = '#6c7a8d';
    }
    
    setTimeout(() => {
      if (notif.parentNode) {
        notif.style.animation = 'notif-disappear 0.3s ease forwards';
        setTimeout(() => notif.remove(), 300);
      }
    }, duration);
  }

  // ---------------------------------------------
  // UTILITAIRES
  // ---------------------------------------------
  function truncateName(name, max = 15) {
    if (!name || name.length <= max) return name;
    const dot = name.lastIndexOf('.');
    if (dot === -1) return name.slice(0, max - 3) + '...';
    const ext = name.slice(dot);
    const base = name.slice(0, dot);
    return base.slice(0, max - 3 - ext.length) + '...' + ext;
  }

  function formatFileSize(bytes) {
    if (!bytes) return '?';
    const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  // ---------------------------------------------
  // ÉCOUTEURS GLOBAUX
  // ---------------------------------------------
  function setupEventListeners() {
    if (addCategoryBtn) {
      addCategoryBtn.addEventListener('click', createCategory);
    }
    
    if (uploadBtn) {
      uploadBtn.addEventListener('click', openCategoryOverlay);
    }
    
    if (categoryOverlayBackdrop) {
      categoryOverlayBackdrop.addEventListener('click', closeCategoryOverlay);
    }
    
    if (searchInput) {
      let timeout;
      searchInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          renderFiles();
        }, 300);
      });
    }
    
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'para.html';
      });
    }
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !categoryOverlay.classList.contains('hidden')) {
        closeCategoryOverlay();
      }
    });
  }

  // ---------------------------------------------
  // DÉMARRAGE
  // ---------------------------------------------
  init();
})();