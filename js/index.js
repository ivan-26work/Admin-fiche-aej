// ===== index.js =====
// Version AEJ Desktop - COMPLÈTE avec toutes les fonctionnalités
// Structure claire, fonctions nommées, code commenté

(function() {
  // =============================================
  // 1. CONFIGURATION ET ÉTAT INITIAL
  // =============================================
  
  const SUPABASE_URL = 'https://lnwrwvwunwsqeuluupis.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxud3J3dnd1bndzcWV1bHV1cGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NjU2ODYsImV4cCI6MjA4OTM0MTY4Nn0.gfnPMtR3mNBFMTo3GtZ9t1A9_8gxEHY4loLgLdLJxLs';

  // État global
  let supabase = null;
  let currentUser = null;
  let allFiles = [];
  let categories = [];
  let selectedCategories = new Set(['all']);
  let selectedDates = new Set();
  let searchTimeout = null;
  let currentPreviewFile = null;
  
  // État multi-sélection
  let selectionMode = false;
  let selectedFiles = new Set();
  
  // Upload state (table attente)
  let pendingFiles = [];
  let selectedCategoryId = null;
  let uploadTimer = null;
  let timerInterval = null;
  let uploadExpirationTime = null;

  // =============================================
  // 2. RÉFÉRENCES DOM
  // =============================================
  
  // Header
  const loadingOverlay = document.getElementById('loadingOverlay');
  const settingsBtn = document.getElementById('settingsBtn');
  
  // Colonne gauche
  const searchInput = document.getElementById('searchInput');
  const searchNom = document.getElementById('searchNom');
  const searchMatricule = document.getElementById('searchMatricule');
  const searchCategorie = document.getElementById('searchCategorie');
  const searchDate = document.getElementById('searchDate');
  const categoriesList = document.getElementById('categoriesList');
  const statsFichiers = document.getElementById('statsFichiers');
  const statsCategories = document.getElementById('statsCategories');
  const statsTelechargements = document.getElementById('statsTelechargements');
  const storageUsageSpan = document.getElementById('storageUsage');
  const storageProgressBar = document.getElementById('storageProgressBar');
  const storageWarning = document.getElementById('storageWarning');
  
  // Colonne droite
  const filtersRow = document.getElementById('filtersRow');
  const filesContainer = document.getElementById('filesContainer');
  const selectModeBtn = document.getElementById('selectModeBtn');
  const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const cancelSelectBtn = document.getElementById('cancelSelectBtn');
  const selectCountSpan = document.getElementById('selectCount');
  const uploadBtn = document.getElementById('uploadBtn');
  
  // Overlay upload
  const uploadOverlay = document.getElementById('uploadOverlay');
  const uploadOverlayBackdrop = document.getElementById('uploadOverlayBackdrop');
  const closeUploadOverlayBtn = document.getElementById('closeUploadOverlayBtn');
  const cancelUploadBtn = document.getElementById('cancelUploadBtn');
  const confirmUploadBtn = document.getElementById('confirmUploadBtn');
  const uploadCategoryList = document.getElementById('uploadCategoryList');
  const pendingFilesList = document.getElementById('pendingFilesList');
  const addFilesToUploadBtn = document.getElementById('addFilesToUploadBtn');
  const uploadTimerDisplay = document.getElementById('uploadTimer');
  const fileDetailsContent = document.getElementById('fileDetailsContent');
  
  // Overlay catégories
  const categoryOverlay = document.getElementById('categoryOverlay');
  const categoryOverlayBackdrop = document.getElementById('categoryOverlayBackdrop');
  const closeCategoryOverlayBtn = document.getElementById('closeCategoryOverlayBtn');
  const closeCategoryFooterBtn = document.getElementById('closeCategoryFooterBtn');
  const newCategoryName = document.getElementById('newCategoryName');
  const confirmAddCategory = document.getElementById('confirmAddCategory');
  const categoriesCheckboxList = document.getElementById('categoriesCheckboxList');
  const deleteCategoriesBtn = document.getElementById('deleteCategoriesBtn');
  
  // Overlay aperçu
  const fileOverlay = document.getElementById('fileOverlay');
  const overlayBackdrop = document.getElementById('overlayBackdrop');
  const overlayCloseBtn = document.getElementById('overlayCloseBtn');
  const overlayFilename = document.getElementById('overlayFilename');
  const previewMatricule = document.getElementById('previewMatricule');
  const previewNom = document.getElementById('previewNom');
  const previewPrenom = document.getElementById('previewPrenom');
  const previewDesignation = document.getElementById('previewDesignation');
  const previewTaille = document.getElementById('previewTaille');
  const previewDate = document.getElementById('previewDate');
  const previewCategorie = document.getElementById('previewCategorie');
  const previewFiliere = document.getElementById('previewFiliere');
  const saveMetadataBtn = document.getElementById('saveMetadataBtn');
  const pdfIframe = document.getElementById('pdfIframe');
  const pdfViewer = document.getElementById('pdfViewer');
  const previewDownloadBtn = document.getElementById('previewDownloadBtn');
  const previewDeleteBtn = document.getElementById('previewDeleteBtn');
  const previewFullscreenBtn = document.getElementById('previewFullscreenBtn');
  
  // Loaders
  const syncLoader = document.getElementById('syncLoader');
  const deleteLoader = document.getElementById('deleteLoader');

  // =============================================
  // 3. INITIALISATION
  // =============================================
  
  async function init() {
    try {
      await initSupabase();
      await checkSession();
      setupEventListeners();
      startStorageMonitoring();
    } catch (error) {
      console.error('Erreur initialisation:', error);
      showNotification('Erreur de chargement', 'error');
    }
  }
  
  async function initSupabase() {
    if (window.supabase?.createClient) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      await loadScript();
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  }
  
  function loadScript() {
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      document.head.appendChild(script);
    });
  }
  
  async function checkSession() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = 'auth.html';
        return;
      }
      currentUser = user;
      await loadUserData();
    } catch (error) {
      console.error('Erreur session:', error);
      window.location.href = 'auth.html';
    }
  }
  
  // =============================================
  // 4. CHARGEMENT DES DONNÉES
  // =============================================
  
  async function loadUserData() {
    try {
      loadingOverlay?.classList.remove('hidden');
      await Promise.all([
        loadCategories(),
        loadFiles(),
        loadTelechargementsStats(),
        loadStorageStats()
      ]);
      updateUI();
    } catch (error) {
      console.error('Erreur chargement:', error);
      showNotification('Erreur chargement des données', 'error');
    } finally {
      setTimeout(() => loadingOverlay?.classList.add('hidden'), 500);
    }
  }
  
  async function loadCategories() {
    const { data, error } = await supabase
      .from('dossiers')
      .select('*')
      .eq('user_id', currentUser.id)
      .is('parent_id', null)
      .order('nom');
    if (!error) categories = data || [];
    if (statsCategories) statsCategories.textContent = categories.length;
  }
  
  async function loadFiles() {
    const { data: filesData, error: filesError } = await supabase
      .from('fichiers')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('date_upload', { ascending: false });
    if (filesError) return;
    
    const { data: liaisonsData } = await supabase
      .from('dossier_fichiers')
      .select('*')
      .in('fichier_id', filesData.map(f => f.id));
    
    const liaisonsMap = {};
    (liaisonsData || []).forEach(l => liaisonsMap[l.fichier_id] = l.dossier_id);
    
    allFiles = filesData.map(file => ({ ...file, categorie_id: liaisonsMap[file.id] || null }));
    if (statsFichiers) statsFichiers.textContent = allFiles.length;
  }
  
  async function loadTelechargementsStats() {
    try {
      const { data } = await supabase.from('telechargements').select('*');
      if (statsTelechargements) statsTelechargements.textContent = data?.length || 0;
    } catch (e) {
      if (statsTelechargements) statsTelechargements.textContent = '0';
    }
  }
  
  async function loadStorageStats() {
    try {
      const { data } = await supabase.storage.from('fichiers').list();
      let totalSize = 0;
      for (const file of data || []) {
        if (file.metadata?.size) totalSize += file.metadata.size;
      }
      const totalMo = (totalSize / (1024 * 1024)).toFixed(1);
      const maxMo = 1024; // 1 Go
      const percent = (totalSize / (1024 * 1024 * 1024)) * 100;
      if (storageUsageSpan) storageUsageSpan.textContent = `${totalMo} Mo / 1 Go`;
      if (storageProgressBar) storageProgressBar.style.width = `${Math.min(percent, 100)}%`;
      if (storageWarning) {
        if (percent > 90) storageWarning.classList.remove('hidden');
        else storageWarning.classList.add('hidden');
      }
    } catch (e) {
      console.warn('Erreur calcul stockage:', e);
    }
  }
  
  // =============================================
  // 5. MISE À JOUR DE L'INTERFACE
  // =============================================
  
  function updateUI() {
    updateCategoriesUI();
    updateFiltersUI();
    renderFiles();
  }
  
  function updateCategoriesUI() {
    if (!categoriesList) return;
    const fileCount = {};
    categories.forEach(c => fileCount[c.id] = 0);
    allFiles.forEach(f => {
      if (f.categorie_id && fileCount[f.categorie_id] !== undefined) fileCount[f.categorie_id]++;
    });
    
    let html = `<div class="category-item"><label class="checkbox-label"><input type="checkbox" class="category-checkbox" id="catAll" ${selectedCategories.has('all') ? 'checked' : ''}><span class="category-name">Toutes les catégories</span><span class="category-count">${allFiles.length}</span></label></div>`;
    categories.forEach(c => {
      html += `<div class="category-item"><label class="checkbox-label"><input type="checkbox" class="category-checkbox" data-category-id="${c.id}" ${selectedCategories.has(c.id) ? 'checked' : ''}><span class="category-name">${escapeHtml(c.nom)}</span><span class="category-count">${fileCount[c.id] || 0}</span></label></div>`;
    });
    categoriesList.innerHTML = html;
    
    document.getElementById('catAll')?.addEventListener('change', e => {
      if (e.target.checked) {
        selectedCategories.clear();
        selectedCategories.add('all');
      } else {
        selectedCategories.delete('all');
      }
      updateCategoriesUI();
      renderFiles();
    });
    
    document.querySelectorAll('.category-checkbox[data-category-id]').forEach(cb => {
      cb.addEventListener('change', e => {
        const id = e.target.dataset.categoryId;
        if (e.target.checked) {
          selectedCategories.add(id);
          selectedCategories.delete('all');
          const catAll = document.getElementById('catAll');
          if (catAll) catAll.checked = false;
        } else {
          selectedCategories.delete(id);
          if (selectedCategories.size === 0) {
            selectedCategories.add('all');
            const catAll = document.getElementById('catAll');
            if (catAll) catAll.checked = true;
          }
        }
        renderFiles();
      });
    });
  }
  
  function updateFiltersUI() {
    if (!filtersRow) return;
    const filesByDate = {};
    allFiles.forEach(f => {
      const d = formatDateKey(f.date_upload);
      if (!filesByDate[d]) filesByDate[d] = [];
      filesByDate[d].push(f);
    });
    const sorted = Object.keys(filesByDate).sort((a, b) => {
      return new Date(b.split('/').reverse().join('-')) - new Date(a.split('/').reverse().join('-'));
    });
    filtersRow.innerHTML = sorted.map(d => `
      <div class="filter-pill ${selectedDates.has(d) ? 'active' : ''}" data-date="${d}">
        <i class="fas fa-calendar"></i>
        <span>${d}</span>
        <span class="filter-count">(${filesByDate[d].length})</span>
      </div>
    `).join('');
    
    document.querySelectorAll('.filter-pill').forEach(p => {
      p.addEventListener('click', () => {
        const date = p.dataset.date;
        if (selectedDates.has(date)) selectedDates.delete(date);
        else selectedDates.add(date);
        updateFiltersUI();
        renderFiles();
      });
    });
  }
  
  function getFilteredFiles() {
    let filtered = [...allFiles];
    
    // Filtre catégories
    if (!selectedCategories.has('all') && selectedCategories.size > 0) {
      filtered = filtered.filter(f => f.categorie_id && selectedCategories.has(f.categorie_id));
    }
    
    // Filtre dates
    if (selectedDates.size > 0) {
      filtered = filtered.filter(f => selectedDates.has(formatDateKey(f.date_upload)));
    }
    
    // Recherche avancée
    const term = searchInput?.value.toLowerCase().trim();
    if (term) {
      filtered = filtered.filter(f => {
        const { nom, prenom, matricule } = extraireMetadonnees(f.nom);
        const categorie = categories.find(c => c.id === f.categorie_id)?.nom || '';
        const date = formatDateKey(f.date_upload);
        
        if (searchNom?.checked && (`${nom} ${prenom}`).toLowerCase().includes(term)) return true;
        if (searchMatricule?.checked && matricule.toLowerCase().includes(term)) return true;
        if (searchCategorie?.checked && categorie.toLowerCase().includes(term)) return true;
        if (searchDate?.checked && date.includes(term)) return true;
        return false;
      });
    }
    
    return filtered;
  }
  
  function renderFiles() {
    if (!filesContainer) return;
    const filtered = getFilteredFiles();
    
    if (!categories.length) {
      filesContainer.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>Créez votre première catégorie</p></div>';
      return;
    }
    if (!filtered.length) {
      filesContainer.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>Aucun fichier trouvé</p></div>';
      return;
    }
    
    const byCat = {};
    categories.forEach(c => byCat[c.id] = []);
    filtered.forEach(f => {
      if (f.categorie_id && byCat[f.categorie_id]) byCat[f.categorie_id].push(f);
    });
    
    let html = '';
    categories.forEach(cat => {
      const catFiles = byCat[cat.id] || [];
      if (!catFiles.length) return;
      html += `<div class="category-group"><h4><i class="fas fa-folder"></i> ${escapeHtml(cat.nom)} (${catFiles.length})</h4><div class="files-grid">`;
      catFiles.forEach(f => {
        const { matricule, nom, prenom } = extraireMetadonnees(f.nom);
        html += `
          <div class="file-item ${selectionMode ? 'select-mode' : ''} ${selectedFiles.has(f.id) ? 'selected' : ''}" data-id="${f.id}" data-file='${JSON.stringify(f).replace(/'/g, "&apos;")}'>
            <div class="file-select"><input type="checkbox" class="file-checkbox" data-id="${f.id}" ${selectedFiles.has(f.id) ? 'checked' : ''}></div>
            <div class="file-icon"><i class="fas fa-file-pdf"></i></div>
            <div class="file-matricule">${escapeHtml(matricule || '')}</div>
            <div class="file-nom">${escapeHtml(nom || '')} ${escapeHtml(prenom || '')}</div>
            <div class="file-actions">
              <button class="file-action-btn download" data-id="${f.id}" title="Télécharger"><i class="fas fa-download"></i></button>
              <button class="file-action-btn delete" data-id="${f.id}" title="Supprimer"><i class="fas fa-trash"></i></button>
              <button class="file-action-btn preview" data-id="${f.id}" title="Aperçu"><i class="fas fa-eye"></i></button>
            </div>
          </div>
        `;
      });
      html += `</div></div>`;
    });
    filesContainer.innerHTML = html;
    attachFileEvents();
  }
  
  function attachFileEvents() {
    document.querySelectorAll('.file-item').forEach(item => {
      const id = item.dataset.id;
      item.addEventListener('click', e => {
        if (e.target.closest('.file-action-btn')) return;
        if (selectionMode) {
          const cb = item.querySelector('.file-checkbox');
          if (cb) cb.click();
        } else {
          const file = allFiles.find(f => f.id === id);
          if (file) openFilePreview(file);
        }
      });
      const cb = item.querySelector('.file-checkbox');
      if (cb) {
        cb.addEventListener('click', e => {
          e.stopPropagation();
          toggleFileSelection(id, cb.checked);
        });
      }
    });
    
    document.querySelectorAll('.file-action-btn.download').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const file = allFiles.find(f => f.id === id);
        if (file) downloadFile(file);
      });
    });
    
    document.querySelectorAll('.file-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const file = allFiles.find(f => f.id === id);
        if (file) confirmDeleteFile(file);
      });
    });
    
    document.querySelectorAll('.file-action-btn.preview').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const file = allFiles.find(f => f.id === id);
        if (file) openFilePreview(file);
      });
    });
  }
  
  // =============================================
  // 6. SÉLECTION MULTIPLE
  // =============================================
  
  function toggleFileSelection(id, checked) {
    if (checked) selectedFiles.add(id);
    else selectedFiles.delete(id);
    updateSelectionUI();
  }
  
  function updateSelectionUI() {
    const count = selectedFiles.size;
    if (count === 0) {
      selectCountSpan?.classList.add('hidden');
      downloadSelectedBtn.disabled = true;
      deleteSelectedBtn.disabled = true;
      cancelSelectBtn?.classList.add('hidden');
      if (selectModeBtn) selectModeBtn.innerHTML = '<i class="fas fa-check-square"></i> Sélection multiple';
    } else {
      selectCountSpan.textContent = `${count} sélectionné${count > 1 ? 's' : ''}`;
      selectCountSpan.classList.remove('hidden');
      downloadSelectedBtn.disabled = false;
      deleteSelectedBtn.disabled = false;
      cancelSelectBtn.classList.remove('hidden');
      if (selectModeBtn) selectModeBtn.innerHTML = `<i class="fas fa-check-square"></i> ${count} sélectionné${count > 1 ? 's' : ''}`;
    }
    
    document.querySelectorAll('.file-item').forEach(item => {
      const id = item.dataset.id;
      if (selectedFiles.has(id)) item.classList.add('selected');
      else item.classList.remove('selected');
      const cb = item.querySelector('.file-checkbox');
      if (cb) cb.checked = selectedFiles.has(id);
    });
  }
  
  function toggleSelectionMode() {
    selectionMode = !selectionMode;
    if (!selectionMode) {
      selectedFiles.clear();
      updateSelectionUI();
    }
    document.querySelectorAll('.file-item').forEach(item => {
      if (selectionMode) item.classList.add('select-mode');
      else item.classList.remove('select-mode');
    });
    updateSelectionUI();
  }
  
  // =============================================
  // 7. TÉLÉCHARGEMENT ET SUPPRESSION
  // =============================================
  
  async function downloadFile(file) {
    try {
      const { data: urlData } = supabase.storage.from(file.bucket || 'fichiers').getPublicUrl(file.chemin_storage);
      const a = document.createElement('a');
      a.href = urlData.publicUrl;
      a.download = file.nom;
      a.click();
      showNotification('Téléchargement démarré', 'success');
    } catch (e) {
      showNotification('Erreur téléchargement', 'error');
    }
  }
  
  async function downloadSelected() {
    const filesToDownload = allFiles.filter(f => selectedFiles.has(f.id));
    for (const file of filesToDownload) await downloadFile(file);
    toggleSelectionMode();
    showNotification(`${filesToDownload.length} fichier(s) téléchargé(s)`, 'success');
  }
  
  async function confirmDeleteFile(file) {
    if (!confirm(`Supprimer définitivement "${file.nom}" ?`)) return;
    showDeleteLoader(file.nom);
    try {
      await supabase.from('dossier_fichiers').delete().eq('fichier_id', file.id);
      await supabase.storage.from('fichiers').remove([file.chemin_storage]);
      await supabase.from('fichiers').delete().eq('id', file.id);
      await loadFiles();
      updateUI();
      showNotification('Fichier supprimé', 'success');
    } catch (e) {
      showNotification('Erreur suppression', 'error');
    } finally {
      hideDeleteLoader();
    }
  }
  
  async function deleteSelected() {
    const filesToDelete = allFiles.filter(f => selectedFiles.has(f.id));
    if (!filesToDelete.length) return;
    if (!confirm(`Supprimer définitivement ${filesToDelete.length} fichier(s) ?`)) return;
    showDeleteLoader(`${filesToDelete.length} fichiers`);
    for (const file of filesToDelete) {
      await supabase.from('dossier_fichiers').delete().eq('fichier_id', file.id);
      await supabase.storage.from('fichiers').remove([file.chemin_storage]);
      await supabase.from('fichiers').delete().eq('id', file.id);
    }
    await loadFiles();
    updateUI();
    toggleSelectionMode();
    showNotification(`${filesToDelete.length} fichier(s) supprimé(s)`, 'success');
    hideDeleteLoader();
  }
  
  // =============================================
  // 8. OVERLAY CATÉGORIES
  // =============================================
  
  function openCategoryOverlay() {
    categoryOverlay.classList.remove('hidden');
    renderCategoriesCheckboxList();
  }
  
  function closeCategoryOverlay() {
    categoryOverlay.classList.add('hidden');
  }
  
  function renderCategoriesCheckboxList() {
    if (!categoriesCheckboxList) return;
    let html = '';
    categories.forEach(c => {
      const count = allFiles.filter(f => f.categorie_id === c.id).length;
      html += `<label class="category-checkbox-item"><input type="checkbox" value="${c.id}"><span>${escapeHtml(c.nom)}</span><span class="cat-count">(${count})</span></label>`;
    });
    categoriesCheckboxList.innerHTML = html;
    const checkboxes = categoriesCheckboxList.querySelectorAll('input');
    checkboxes.forEach(cb => cb.addEventListener('change', () => {
      const hasSelection = Array.from(checkboxes).some(c => c.checked);
      deleteCategoriesBtn.disabled = !hasSelection;
    }));
    deleteCategoriesBtn.disabled = true;
  }
  
  async function createCategory() {
    const nom = newCategoryName?.value.trim();
    if (!nom) { showNotification('Entrez un nom', 'error'); return; }
    if (categories.some(c => c.nom.toLowerCase() === nom.toLowerCase())) {
      showNotification('Catégorie existe déjà', 'error');
      return;
    }
    try {
      await supabase.from('dossiers').insert({ user_id: currentUser.id, nom, parent_id: null });
      await loadCategories();
      updateCategoriesUI();
      statsCategories.textContent = categories.length;
      newCategoryName.value = '';
      showNotification('Catégorie créée', 'success');
      renderCategoriesCheckboxList();
    } catch (e) { showNotification('Erreur création', 'error'); }
  }
  
  async function deleteSelectedCategories() {
    const selected = Array.from(categoriesCheckboxList.querySelectorAll('input:checked')).map(cb => cb.value);
    if (!selected.length) return;
    const filesToDelete = allFiles.filter(f => selected.includes(f.categorie_id));
    if (!confirm(`Supprimer ${selected.length} catégorie(s) et ${filesToDelete.length} fichier(s) ?`)) return;
    showDeleteLoader('catégories');
    for (const id of selected) {
      const catFiles = allFiles.filter(f => f.categorie_id === id);
      for (const f of catFiles) {
        await supabase.from('dossier_fichiers').delete().eq('fichier_id', f.id);
        await supabase.storage.from('fichiers').remove([f.chemin_storage]);
        await supabase.from('fichiers').delete().eq('id', f.id);
      }
      await supabase.from('dossiers').delete().eq('id', id);
    }
    await loadCategories();
    await loadFiles();
    updateUI();
    renderCategoriesCheckboxList();
    showNotification('Suppression terminée', 'success');
    hideDeleteLoader();
  }
  
  // =============================================
  // 9. OVERLAY UPLOAD (avec table attente)
  // =============================================
  
  function openUploadOverlay() {
    renderCategoryRadioList();
    renderPendingFilesList();
    startUploadTimer();
    uploadOverlay.classList.remove('hidden');
  }
  
  function closeUploadOverlay() {
    uploadOverlay.classList.add('hidden');
    stopUploadTimer();
  }
  
  function renderCategoryRadioList() {
    if (!uploadCategoryList) return;
    let html = '';
    categories.forEach(c => {
      html += `<label class="category-radio-item"><input type="radio" name="uploadCategory" value="${c.id}"><span>${escapeHtml(c.nom)}</span></label>`;
    });
    uploadCategoryList.innerHTML = html;
    uploadCategoryList.querySelectorAll('input').forEach(radio => {
      radio.addEventListener('change', () => {
        selectedCategoryId = radio.value;
        updateConfirmButton();
      });
    });
  }
  
  function renderPendingFilesList() {
    if (!pendingFilesList) return;
    if (!pendingFiles.length) {
      pendingFilesList.innerHTML = '<p class="empty-pending">Aucun fichier en attente</p>';
      if (fileDetailsContent) fileDetailsContent.innerHTML = '<p class="no-selection">Sélectionnez un fichier pour le modifier</p>';
      return;
    }
    let html = '';
    pendingFiles.forEach((file, idx) => {
      const isValid = validerNomFichier(file.name);
      const isDuplicate = file.isDuplicate;
      let statusClass = 'valid';
      let statusText = '✅ Valide';
      if (!isValid) { statusClass = 'error'; statusText = '⚠️ Format invalide'; }
      if (isDuplicate) { statusClass = 'duplicate'; statusText = '⚠️ Doublon'; }
      html += `
        <div class="pending-file-item" data-index="${idx}">
          <span class="pending-file-name">${escapeHtml(file.name)}</span>
          <span class="pending-file-status ${statusClass}">${statusText}</span>
        </div>
      `;
    });
    pendingFilesList.innerHTML = html;
    
    pendingFilesList.querySelectorAll('.pending-file-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index);
        selectPendingFile(idx);
      });
    });
  }
  
  function selectPendingFile(index) {
    const file = pendingFiles[index];
    if (!file) return;
    
    const { matricule, nom, prenom, designation } = extraireMetadonnees(file.name);
    const isValid = validerNomFichier(file.name);
    const finalName = `${matricule} ${nom} ${prenom} ${designation}.pdf`.replace(/\s+/g, ' ').trim();
    
    let editorHtml = `
      <div class="editor-fields">
        <div class="editor-field">
          <label>Matricule (8 chiffres + lettre)</label>
          <input type="text" id="editMatricule" value="${escapeHtml(matricule)}" placeholder="19167122 F">
        </div>
        <div class="editor-field">
          <label>Nom</label>
          <input type="text" id="editNom" value="${escapeHtml(nom)}" placeholder="IPOTE">
        </div>
        <div class="editor-field">
          <label>Prénom</label>
          <input type="text" id="editPrenom" value="${escapeHtml(prenom)}" placeholder="IVAN GAËL">
        </div>
        <div class="editor-field">
          <label>Désignation</label>
          <input type="text" id="editDesignation" value="${escapeHtml(designation)}" placeholder="fiche">
        </div>
      </div>
      <div class="nom-final ${isValid ? 'valid' : 'invalid'}">
        <strong>✅ Nom final :</strong> ${escapeHtml(finalName)}
      </div>
    `;
    
    if (file.isDuplicate) {
      editorHtml += `
        <div class="duplicate-actions">
          <p class="warning-text">⚠️ Ce fichier existe déjà dans la base</p>
          <div class="editor-actions">
            <button class="btn-apply" id="replaceDuplicateBtn">🔄 Remplacer l'ancien</button>
            <button class="btn-ignore" id="ignoreDuplicateBtn">❌ Ignorer ce fichier</button>
          </div>
        </div>
      `;
    } else if (!isValid) {
      editorHtml += `
        <div class="editor-actions">
          <button class="btn-apply" id="applyCorrectionBtn">🔄 Appliquer la correction</button>
          <button class="btn-ignore" id="ignoreCorrectionBtn">❌ Ignorer</button>
        </div>
      `;
    }
    
    if (fileDetailsContent) fileDetailsContent.innerHTML = editorHtml;
    
    if (!isValid) {
      document.getElementById('applyCorrectionBtn')?.addEventListener('click', () => applyCorrection(index));
      document.getElementById('ignoreCorrectionBtn')?.addEventListener('click', () => ignoreFile(index));
    }
    if (file.isDuplicate) {
      document.getElementById('replaceDuplicateBtn')?.addEventListener('click', () => replaceDuplicate(index));
      document.getElementById('ignoreDuplicateBtn')?.addEventListener('click', () => ignoreFile(index));
    }
    
    const editMatricule = document.getElementById('editMatricule');
    const editNom = document.getElementById('editNom');
    const editPrenom = document.getElementById('editPrenom');
    const editDesignation = document.getElementById('editDesignation');
    const updatePreview = () => {
      const newMat = editMatricule?.value || '';
      const newNom = editNom?.value || '';
      const newPrenom = editPrenom?.value || '';
      const newDesignation = editDesignation?.value || '';
      const newFinal = `${newMat} ${newNom} ${newPrenom} ${newDesignation}.pdf`.replace(/\s+/g, ' ').trim();
      const previewDiv = document.querySelector('.nom-final');
      if (previewDiv) {
        previewDiv.innerHTML = `<strong>✅ Nom final :</strong> ${escapeHtml(newFinal)}`;
        const newIsValid = validerNomFichier(newFinal);
        previewDiv.className = `nom-final ${newIsValid ? 'valid' : 'invalid'}`;
      }
    };
    editMatricule?.addEventListener('input', updatePreview);
    editNom?.addEventListener('input', updatePreview);
    editPrenom?.addEventListener('input', updatePreview);
    editDesignation?.addEventListener('input', updatePreview);
  }
  
  function applyCorrection(index) {
    const newMat = document.getElementById('editMatricule')?.value || '';
    const newNom = document.getElementById('editNom')?.value || '';
    const newPrenom = document.getElementById('editPrenom')?.value || '';
    const newDesignation = document.getElementById('editDesignation')?.value || '';
    const newName = `${newMat} ${newNom} ${newPrenom} ${newDesignation}.pdf`.replace(/\s+/g, ' ').trim();
    
    if (!validerNomFichier(newName)) {
      showNotification('Nom toujours invalide', 'error');
      return;
    }
    
    const file = pendingFiles[index];
    const newFile = new File([file], newName, { type: 'application/pdf' });
    pendingFiles[index] = newFile;
    pendingFiles[index].isDuplicate = false;
    renderPendingFilesList();
    showNotification('Correction appliquée', 'success');
  }
  
  function ignoreFile(index) {
    pendingFiles.splice(index, 1);
    renderPendingFilesList();
    if (fileDetailsContent) fileDetailsContent.innerHTML = '<p class="no-selection">Sélectionnez un fichier pour le modifier</p>';
    showNotification('Fichier ignoré', 'info');
  }
  
  async function replaceDuplicate(index) {
    const file = pendingFiles[index];
    const { matricule } = extraireMetadonnees(file.name);
    const { data: existing } = await supabase
      .from('fichiers')
      .select('id, chemin_storage')
      .eq('user_id', currentUser.id)
      .filter('nom', 'ilike', `${matricule}%`);
    
    for (const old of existing || []) {
      await supabase.from('dossier_fichiers').delete().eq('fichier_id', old.id);
      await supabase.storage.from('fichiers').remove([old.chemin_storage]);
      await supabase.from('fichiers').delete().eq('id', old.id);
    }
    
    pendingFiles[index].isDuplicate = false;
    showNotification('Ancien fichier supprimé, prêt à uploader', 'success');
    renderPendingFilesList();
  }
  
  function validerNomFichier(nom) {
    const base = nom.replace(/\.pdf$/i, '');
    const parties = base.split(' ');
    if (parties.length < 4) return false;
    const matPart = parties[0];
    const lettrePart = parties[1];
    const nomPart = parties[2];
    if (!/^\d{8,9}$/.test(matPart)) return false;
    if (!/^[A-Z]$/.test(lettrePart)) return false;
    if (nomPart.length < 2) return false;
    return true;
  }
  
  async function addFilesToUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      
      for (const file of files) {
        const { matricule } = extraireMetadonnees(file.name);
        const { data: existing } = await supabase
          .from('fichiers')
          .select('id')
          .eq('user_id', currentUser.id)
          .filter('nom', 'ilike', `${matricule}%`);
        
        pendingFiles.push(file);
        if (existing?.length) pendingFiles[pendingFiles.length - 1].isDuplicate = true;
        else pendingFiles[pendingFiles.length - 1].isDuplicate = false;
      }
      
      renderPendingFilesList();
      updateConfirmButton();
      startUploadTimer();
    };
    input.click();
  }
  
  function updateConfirmButton() {
    confirmUploadBtn.disabled = !selectedCategoryId || pendingFiles.length === 0;
  }
  
  function startUploadTimer() {
    if (timerInterval) clearInterval(timerInterval);
    uploadExpirationTime = Date.now() + 10 * 60 * 1000;
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);
  }
  
  function updateTimerDisplay() {
    if (!uploadTimerDisplay) return;
    const remaining = Math.max(0, uploadExpirationTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    uploadTimerDisplay.querySelector('span').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    if (remaining <= 0) {
      stopUploadTimer();
      cleanupExpiredFiles();
      closeUploadOverlay();
      showNotification('Temps expiré, fichiers supprimés', 'error');
    }
  }
  
  function stopUploadTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }
  
  async function cleanupExpiredFiles() {
    for (const file of pendingFiles) {
      if (file._uploaded) continue;
    }
    pendingFiles = [];
    renderPendingFilesList();
  }
  
  async function uploadFiles() {
    if (!selectedCategoryId || !pendingFiles.length) return;
    
    showSyncLoader(pendingFiles.length);
    let success = 0;
    let errors = 0;
    
    for (const file of pendingFiles) {
      if (file.isDuplicate) continue;
      try {
        const { matricule } = extraireMetadonnees(file.name);
        const { data: existing } = await supabase
          .from('fichiers')
          .select('id, chemin_storage')
          .eq('user_id', currentUser.id)
          .filter('nom', 'ilike', `${matricule}%`);
        
        for (const old of existing || []) {
          await supabase.from('dossier_fichiers').delete().eq('fichier_id', old.id);
          await supabase.storage.from('fichiers').remove([old.chemin_storage]);
          await supabase.from('fichiers').delete().eq('id', old.id);
        }
        
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\s+/g, '_');
        const path = `${currentUser.id}/${Date.now()}_${safeName}`;
        await supabase.storage.from('fichiers').upload(path, file);
        
        const { data: newFile } = await supabase
          .from('fichiers')
          .insert({
            user_id: currentUser.id,
            nom: file.name,
            type_mime: 'application/pdf',
            taille: file.size,
            chemin_storage: path,
            bucket: 'fichiers'
          })
          .select()
          .single();
        
        await supabase.from('dossier_fichiers').insert({
          dossier_id: selectedCategoryId,
          fichier_id: newFile.id
        });
        success++;
        file._uploaded = true;
      } catch (e) {
        console.error('Upload error:', e);
        errors++;
      }
      updateSyncLoader(success + errors, pendingFiles.length);
    }
    
    hideSyncLoader();
    await loadFiles();
    updateUI();
    closeUploadOverlay();
    
    pendingFiles = [];
    selectedCategoryId = null;
    showNotification(`${success} fichier(s) uploadé(s), ${errors} erreur(s)`, success > 0 ? 'success' : 'error');
  }
  
  // =============================================
  // 10. OVERLAY APERÇU PDF
  // =============================================
  
  function openFilePreview(file) {
    currentPreviewFile = file;
    const { publicUrl } = supabase.storage.from(file.bucket || 'fichiers').getPublicUrl(file.chemin_storage).data;
    const { matricule, nom, prenom, designation } = extraireMetadonnees(file.nom);
    
    overlayFilename.textContent = file.nom;
    previewMatricule.value = matricule || '';
    previewNom.value = nom || '';
    previewPrenom.value = prenom || '';
    previewDesignation.value = designation || '';
    previewTaille.textContent = formatFileSize(file.taille);
    previewDate.textContent = formatDateDisplay(file.date_upload);
    const cat = categories.find(c => c.id === file.categorie_id);
    previewCategorie.textContent = cat?.nom || '-';
    previewFiliere.textContent = '-';
    
    const loadingDiv = pdfViewer?.querySelector('.pdf-loading');
    if (loadingDiv) loadingDiv.classList.remove('hidden');
    pdfIframe.classList.add('hidden');
    pdfIframe.src = publicUrl;
    pdfIframe.onload = () => {
      if (loadingDiv) loadingDiv.classList.add('hidden');
      pdfIframe.classList.remove('hidden');
    };
    
    fileOverlay.classList.remove('hidden');
    setMetadataReadOnly(true);
  }
  
  function setMetadataReadOnly(readonly) {
    previewMatricule.readOnly = readonly;
    previewNom.readOnly = readonly;
    previewPrenom.readOnly = readonly;
    previewDesignation.readOnly = readonly;
    saveMetadataBtn.style.display = readonly ? 'none' : 'flex';
  }
  
  function enableMetadataEdit() {
    setMetadataReadOnly(false);
  }
  
  async function saveMetadata() {
    if (!currentPreviewFile) return;
    const newMat = previewMatricule.value.trim();
    const newNom = previewNom.value.trim();
    const newPrenom = previewPrenom.value.trim();
    const newDesignation = previewDesignation.value.trim();
    const nouveauNom = `${newMat} ${newNom} ${newPrenom} ${newDesignation}.pdf`.replace(/\s+/g, ' ').trim();
    
    if (!validerNomFichier(nouveauNom)) {
      showNotification('Nom invalide', 'error');
      return;
    }
    
    try {
      const { data: urlData } = supabase.storage.from(currentPreviewFile.bucket || 'fichiers').getPublicUrl(currentPreviewFile.chemin_storage);
      const response = await fetch(urlData.publicUrl);
      const blob = await response.blob();
      await supabase.storage.from('fichiers').remove([currentPreviewFile.chemin_storage]);
      const safeName = nouveauNom.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\s+/g, '_');
      const path = `${currentUser.id}/${Date.now()}_${safeName}`;
      await supabase.storage.from('fichiers').upload(path, blob);
      await supabase.from('fichiers').update({ nom: nouveauNom, chemin_storage: path }).eq('id', currentPreviewFile.id);
      await loadFiles();
      updateUI();
      showNotification('Métadonnées sauvegardées', 'success');
      closeFilePreview();
    } catch (e) {
      showNotification('Erreur sauvegarde', 'error');
    }
  }
  
  function closeFilePreview() {
    fileOverlay.classList.add('hidden');
    pdfIframe.src = '';
    currentPreviewFile = null;
  }
  
  // =============================================
  // 11. UTILITAIRES
  // =============================================
  
  function extraireMetadonnees(nom) {
    const base = nom.replace(/\.pdf$/i, '');
    const parties = base.split(' ');
    if (parties.length < 4) {
      return { matricule: parties[0] || '', nom: parties[2] || '', prenom: parties.slice(3).join(' ') || '', designation: parties[parties.length - 1] || '' };
    }
    return {
      matricule: parties[0] + (parties[1] ? ' ' + parties[1] : ''),
      nom: parties[2] || '',
      prenom: parties.slice(3, -1).join(' ') || '',
      designation: parties[parties.length - 1] || ''
    };
  }
  
  function formatFileSize(bytes) {
    if (!bytes) return '?';
    const units = ['o', 'Ko', 'Mo'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }
  
  function formatDateKey(date) {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  
  function formatDateDisplay(date) {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
  }
  
  function showNotification(message, type = 'info') {
    const notif = document.createElement('div');
    notif.className = `temp-notification ${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => { notif.style.opacity = '0'; setTimeout(() => notif.remove(), 300); }, 3000);
  }
  
  function showSyncLoader(total) {
    syncLoader.classList.remove('hidden');
    updateSyncLoader(0, total);
  }
  
  function updateSyncLoader(current, total) {
    const count = syncLoader.querySelector('.sync-count');
    if (count) count.textContent = `${current}/${total}`;
  }
  
  function hideSyncLoader() {
    syncLoader.classList.add('hidden');
  }
  
  function showDeleteLoader(msg) {
    const text = deleteLoader.querySelector('.delete-loader-text');
    if (text) text.textContent = `Suppression ${msg}...`;
    deleteLoader.classList.remove('hidden');
  }
  
  function hideDeleteLoader() {
    deleteLoader.classList.add('hidden');
  }
  
  function startStorageMonitoring() {
    setInterval(() => loadStorageStats(), 60000);
  }
  
  // =============================================
  // 12. ÉCOUTEURS D'ÉVÉNEMENTS
  // =============================================
  
  function setupEventListeners() {
    settingsBtn?.addEventListener('click', () => window.location.href = 'para.html');
    uploadBtn?.addEventListener('click', openUploadOverlay);
    selectModeBtn?.addEventListener('click', toggleSelectionMode);
    downloadSelectedBtn?.addEventListener('click', downloadSelected);
    deleteSelectedBtn?.addEventListener('click', deleteSelected);
    cancelSelectBtn?.addEventListener('click', toggleSelectionMode);
    searchInput?.addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(renderFiles, 300); });
    addFilesToUploadBtn?.addEventListener('click', addFilesToUpload);
    confirmUploadBtn?.addEventListener('click', uploadFiles);
    closeUploadOverlayBtn?.addEventListener('click', closeUploadOverlay);
    cancelUploadBtn?.addEventListener('click', closeUploadOverlay);
    uploadOverlayBackdrop?.addEventListener('click', closeUploadOverlay);
    
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    addCategoryBtn?.addEventListener('click', openCategoryOverlay);
    closeCategoryOverlayBtn?.addEventListener('click', closeCategoryOverlay);
    closeCategoryFooterBtn?.addEventListener('click', closeCategoryOverlay);
    categoryOverlayBackdrop?.addEventListener('click', closeCategoryOverlay);
    confirmAddCategory?.addEventListener('click', createCategory);
    deleteCategoriesBtn?.addEventListener('click', deleteSelectedCategories);
    
    overlayCloseBtn?.addEventListener('click', closeFilePreview);
    overlayBackdrop?.addEventListener('click', closeFilePreview);
    saveMetadataBtn?.addEventListener('click', saveMetadata);
    previewDownloadBtn?.addEventListener('click', () => { if (currentPreviewFile) downloadFile(currentPreviewFile); });
    previewDeleteBtn?.addEventListener('click', () => { if (currentPreviewFile) { confirmDeleteFile(currentPreviewFile); closeFilePreview(); } });
    previewFullscreenBtn?.addEventListener('click', () => {
      if (currentPreviewFile) {
        const { publicUrl } = supabase.storage.from(currentPreviewFile.bucket || 'fichiers').getPublicUrl(currentPreviewFile.chemin_storage).data;
        window.open(publicUrl, '_blank');
      }
    });
    
    const editButtons = document.querySelectorAll('.edit-field');
    editButtons.forEach(btn => btn.addEventListener('click', enableMetadataEdit));
    
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !fileOverlay.classList.contains('hidden')) closeFilePreview(); });
  }
  
  // =============================================
  // 13. DÉMARRAGE
  // =============================================
  
  init();
})();
