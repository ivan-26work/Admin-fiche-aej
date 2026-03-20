// ===== vu.js =====
// Page VU - Téléchargements avec jointure telechargements + securite
// Version FINALE - Stagiaires inscrits = total table securite

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
  let allDownloads = [];
  let filteredDownloads = [];
  let selectedDownload = null;
  let selectedDates = new Set();
  let searchTimeout = null;
  let totalStagiaires = 0;

  // ---------------------------------------------
  // ÉLÉMENTS DOM
  // ---------------------------------------------
  const loadingOverlay = document.getElementById('loadingOverlay');
  const searchInput = document.getElementById('searchInput');
  const statTotal = document.getElementById('statTotal');
  const statStagiaires = document.getElementById('statStagiaires');
  const statMois = document.getElementById('statMois');
  const detailsCard = document.getElementById('detailsCard');
  const filtersRow = document.getElementById('filtersRow');
  const downloadsContainer = document.getElementById('downloadsContainer');

  // ---------------------------------------------
  // INITIALISATION
  // ---------------------------------------------
  async function init() {
    try {
      await initSupabase();
      await checkSession();
      await loadTotalStagiaires();
      await loadDownloads();
      setupEventListeners();
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
    } catch (error) {
      console.error('Erreur session:', error);
      window.location.href = 'auth.html';
    }
  }

  // ---------------------------------------------
  // CHARGEMENT DU NOMBRE TOTAL DE STAGIAIRES
  // ---------------------------------------------
  async function loadTotalStagiaires() {
    try {
      const { count, error } = await supabase
        .from('securite')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      totalStagiaires = count || 0;
      if (statStagiaires) statStagiaires.textContent = totalStagiaires;
      
    } catch (error) {
      console.error('Erreur chargement total stagiaires:', error);
      if (statStagiaires) statStagiaires.textContent = '0';
    }
  }

  // ---------------------------------------------
  // CHARGEMENT DES TÉLÉCHARGEMENTS
  // ---------------------------------------------
  async function loadDownloads() {
    try {
      // Récupérer tous les téléchargements avec jointure sur securite
      const { data, error } = await supabase
        .from('telechargements')
        .select(`
          id,
          date_telechargement,
          categorie,
          filiere,
          user_id,
          securite!inner (
            nom,
            prenom,
            matricule,
            telephone,
            filiere
          )
        `)
        .order('date_telechargement', { ascending: false });

      if (error) throw error;

      // Formater les données
      allDownloads = (data || []).map(item => {
        const securite = item.securite;
        return {
          id: item.id,
          date: item.date_telechargement,
          dateFormatted: formatDateDisplay(item.date_telechargement),
          dateKey: formatDateKey(item.date_telechargement),
          categorie: item.categorie || 'Fiche',
          filiere: item.filiere || securite?.filiere || '-',
          nom: securite?.nom || '-',
          prenom: securite?.prenom || '-',
          matricule: securite?.matricule || '-',
          telephone: securite?.telephone || '-',
          user_id: item.user_id
        };
      });

      filteredDownloads = [...allDownloads];
      updateStats();
      updateFiltersUI();
      renderDownloads();
      
    } catch (error) {
      console.error('Erreur chargement téléchargements:', error);
      showNotification('Erreur chargement des données', 'error');
    }
  }

  // ---------------------------------------------
  // STATISTIQUES
  // ---------------------------------------------
  function updateStats() {
    // Total téléchargements
    if (statTotal) statTotal.textContent = allDownloads.length;

    // Stagiaires uniques = total stagiaires (déjà chargé)
    // (statStagiaires déjà mis à jour dans loadTotalStagiaires)

    // Téléchargements du mois
    const now = new Date();
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    const downloadsMois = allDownloads.filter(d => new Date(d.date) >= debutMois);
    if (statMois) statMois.textContent = downloadsMois.length;
  }

  // ---------------------------------------------
  // FILTRES DATES
  // ---------------------------------------------
  function updateFiltersUI() {
    if (!filtersRow) return;

    // Grouper par date
    const datesMap = new Map();
    allDownloads.forEach(d => {
      if (!datesMap.has(d.dateKey)) {
        datesMap.set(d.dateKey, { count: 0, date: d.date });
      }
      datesMap.get(d.dateKey).count++;
    });

    // Trier par date décroissante
    const sortedDates = Array.from(datesMap.entries()).sort((a, b) => {
      return new Date(b[1].date) - new Date(a[1].date);
    });

    filtersRow.innerHTML = sortedDates.map(([dateKey, info]) => `
      <div class="filter-pill ${selectedDates.has(dateKey) ? 'active' : ''}" data-date="${dateKey}">
        <i class="fas fa-calendar"></i>
        <span>${dateKey}</span>
        <span class="filter-count">(${info.count})</span>
      </div>
    `).join('');

    // Ajouter les écouteurs
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const date = pill.dataset.date;
        if (selectedDates.has(date)) {
          selectedDates.delete(date);
        } else {
          selectedDates.add(date);
        }
        applyFilters();
      });
    });
  }

  function applyFilters() {
    let filtered = [...allDownloads];

    // Filtre par date
    if (selectedDates.size > 0) {
      filtered = filtered.filter(d => selectedDates.has(d.dateKey));
    }

    // Filtre par recherche
    const searchTerm = searchInput?.value.toLowerCase().trim();
    if (searchTerm) {
      filtered = filtered.filter(d => 
        d.nom.toLowerCase().includes(searchTerm) ||
        d.prenom.toLowerCase().includes(searchTerm) ||
        d.matricule.toLowerCase().includes(searchTerm)
      );
    }

    filteredDownloads = filtered;
    renderDownloads();
  }

  // ---------------------------------------------
  // RECHERCHE
  // ---------------------------------------------
  function setupSearch() {
    if (!searchInput) return;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => applyFilters(), 300);
    });
  }

  // ---------------------------------------------
  // AFFICHAGE DES TÉLÉCHARGEMENTS
  // ---------------------------------------------
  function renderDownloads() {
    if (!downloadsContainer) return;

    if (filteredDownloads.length === 0) {
      downloadsContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-download"></i>
          <p>Aucun téléchargement trouvé</p>
        </div>
      `;
      return;
    }

    // Grouper par date
    const groupedByDate = new Map();
    filteredDownloads.forEach(d => {
      if (!groupedByDate.has(d.dateKey)) {
        groupedByDate.set(d.dateKey, []);
      }
      groupedByDate.get(d.dateKey).push(d);
    });

    // Trier les dates par ordre décroissant
    const sortedDates = Array.from(groupedByDate.keys()).sort((a, b) => {
      const [da, ma, ya] = a.split('/').map(Number);
      const [db, mb, yb] = b.split('/').map(Number);
      return new Date(yb, mb-1, db) - new Date(ya, ma-1, da);
    });

    let html = '';
    sortedDates.forEach(dateKey => {
      const downloads = groupedByDate.get(dateKey);
      html += `
        <div class="date-group">
          <div class="date-header">📁 ${dateKey}</div>
          <div class="downloads-grid">
      `;

      downloads.forEach(d => {
        const isSelected = selectedDownload && selectedDownload.id === d.id;
        html += `
          <div class="download-card ${isSelected ? 'selected' : ''}" data-id="${d.id}">
            <div class="card-nom">${escapeHtml(d.prenom)} ${escapeHtml(d.nom)}</div>
            <div class="card-matricule">${escapeHtml(d.matricule)}</div>
            <div class="card-phone">
              <i class="fas fa-phone-alt"></i>
              ${formatPhoneNumber(d.telephone)}
            </div>
            <div class="card-actions">
              <a href="https://wa.me/${formatPhoneForWhatsApp(d.telephone)}" target="_blank" class="card-action-btn whatsapp" title="WhatsApp">
                <i class="fab fa-whatsapp"></i>
              </a>
              <a href="tel:${formatPhoneForCall(d.telephone)}" class="card-action-btn call" title="Appeler">
                <i class="fas fa-phone-alt"></i>
              </a>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    downloadsContainer.innerHTML = html;

    // Ajouter les écouteurs de clic sur les cartes
    document.querySelectorAll('.download-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const download = filteredDownloads.find(d => d.id === id);
        if (download) {
          selectDownload(download);
        }
      });
    });
  }

  // ---------------------------------------------
  // SÉLECTION D'UN TÉLÉCHARGEMENT
  // ---------------------------------------------
  async function selectDownload(download) {
    selectedDownload = download;
    
    // Mettre à jour l'affichage de la carte sélectionnée
    renderDetailsCard(download);
    
    // Mettre à jour les cartes pour afficher la sélection
    document.querySelectorAll('.download-card').forEach(card => {
      const id = card.dataset.id;
      if (id === download.id) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  function renderDetailsCard(download) {
    if (!detailsCard) return;

    // Récupérer le lien du fichier
    getFileUrl(download.matricule).then(fileUrl => {
      const html = `
        <div class="details-content">
          <div class="detail-row">
            <i class="fas fa-user"></i>
            <strong>${escapeHtml(download.prenom)} ${escapeHtml(download.nom)}</strong>
          </div>
          <div class="detail-row">
            <i class="fas fa-id-card"></i>
            <span>${escapeHtml(download.matricule)}</span>
          </div>
          <div class="detail-row">
            <i class="fas fa-phone-alt"></i>
            <span>${formatPhoneNumber(download.telephone)}</span>
          </div>
          <div class="detail-row">
            <i class="fas fa-graduation-cap"></i>
            <span>${escapeHtml(download.filiere)}</span>
          </div>
          <div class="detail-row">
            <i class="fas fa-calendar"></i>
            <span>${download.dateFormatted}</span>
          </div>
          <div class="detail-row">
            <i class="fas fa-tag"></i>
            <span>${escapeHtml(download.categorie)}</span>
          </div>
          <div class="detail-actions">
            <a href="https://wa.me/${formatPhoneForWhatsApp(download.telephone)}" target="_blank" class="detail-btn whatsapp">
              <i class="fab fa-whatsapp"></i> WhatsApp
            </a>
            <a href="tel:${formatPhoneForCall(download.telephone)}" class="detail-btn call">
              <i class="fas fa-phone-alt"></i> Appeler
            </a>
            ${fileUrl ? `<a href="${fileUrl}" target="_blank" class="detail-btn file">
              <i class="fas fa-file-pdf"></i> Voir la fiche
            </a>` : ''}
          </div>
        </div>
      `;
      detailsCard.innerHTML = html;
    }).catch(() => {
      const html = `
        <div class="details-content">
          <div class="detail-row">
            <i class="fas fa-user"></i>
            <strong>${escapeHtml(download.prenom)} ${escapeHtml(download.nom)}</strong>
          </div>
          <div class="detail-row">
            <i class="fas fa-id-card"></i>
            <span>${escapeHtml(download.matricule)}</span>
          </div>
          <div class="detail-row">
            <i class="fas fa-phone-alt"></i>
            <span>${formatPhoneNumber(download.telephone)}</span>
          </div>
          <div class="detail-row">
            <i class="fas fa-graduation-cap"></i>
            <span>${escapeHtml(download.filiere)}</span>
          </div>
          <div class="detail-row">
            <i class="fas fa-calendar"></i>
            <span>${download.dateFormatted}</span>
          </div>
          <div class="detail-actions">
            <a href="https://wa.me/${formatPhoneForWhatsApp(download.telephone)}" target="_blank" class="detail-btn whatsapp">
              <i class="fab fa-whatsapp"></i> WhatsApp
            </a>
            <a href="tel:${formatPhoneForCall(download.telephone)}" class="detail-btn call">
              <i class="fas fa-phone-alt"></i> Appeler
            </a>
          </div>
        </div>
      `;
      detailsCard.innerHTML = html;
    });
  }

  async function getFileUrl(matricule) {
    try {
      const { data, error } = await supabase
        .from('fichiers')
        .select('chemin_storage, bucket')
        .filter('nom', 'ilike', `${matricule}%`)
        .limit(1);
      
      if (error || !data || data.length === 0) return null;
      
      const { data: urlData } = supabase.storage
        .from(data[0].bucket || 'fichiers')
        .getPublicUrl(data[0].chemin_storage);
      
      return urlData.publicUrl;
    } catch (e) {
      return null;
    }
  }

  // ---------------------------------------------
  // UTILITAIRES
  // ---------------------------------------------
  function formatDateKey(date) {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  function formatDateDisplay(date) {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function formatPhoneNumber(phone) {
    if (!phone || phone === '-') return '-';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }
    return phone;
  }

  function formatPhoneForWhatsApp(phone) {
    if (!phone || phone === '-') return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `225${cleaned}`;
    }
    return cleaned;
  }

  function formatPhoneForCall(phone) {
    if (!phone || phone === '-') return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `+225${cleaned}`;
    }
    return `+${cleaned}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

  function showNotification(message, type = 'info') {
    const notif = document.createElement('div');
    notif.className = `temp-notification ${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => {
      notif.style.opacity = '0';
      setTimeout(() => notif.remove(), 300);
    }, 3000);
  }

  // ---------------------------------------------
  // ÉCOUTEURS
  // ---------------------------------------------
  function setupEventListeners() {
    setupSearch();
    
    // Retour à l'accueil
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'index.html';
      });
    }
    
    // Paramètres
    const settingsBtn = document.querySelector('.settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'para.html';
      });
    }
  }

  // ---------------------------------------------
  // DÉMARRAGE
  // ---------------------------------------------
  init();
})();
