// ===== info.js =====
// Page d'information AEJ - Version finale
// Layout 30/70 - Desktop first

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
  let publications = [];
  let filteredPublications = [];
  let adminNom = 'Admin AEJ';
  let pendingFile = null; // { file, type, bucket, url, fileName, storagePath }
  let searchTerm = '';
  let selectionMode = false;
  let selectedPublications = new Set();
  let currentEditPublicationId = null;
  let currentFullscreenPub = null;

  // ---------------------------------------------
  // ÉLÉMENTS DOM
  // ---------------------------------------------
  const loadingOverlay = document.getElementById('loadingOverlay');
  const headerContent = document.getElementById('headerContent');
  const searchWrapper = document.getElementById('searchWrapper');
  const searchInput = document.getElementById('searchInput');
  const notificationMsg = document.getElementById('notificationMessage');
  const pendingFileInfo = document.getElementById('pendingFileInfo');
  const pendingFileNameSpan = document.getElementById('pendingFileName');
  const selectionModeBar = document.getElementById('selectionModeBar');
  const selectionCountSpan = document.getElementById('selectionCount');
  const selectionDeleteBtn = document.getElementById('selectionDeleteBtn');
  const selectionCancelBtn = document.getElementById('selectionCancelBtn');
  const selectionModeBtn = document.getElementById('selectionModeBtn');
  const themeToggle = document.getElementById('themeToggle');
  const dashboardBtn = document.getElementById('dashboardBtn');
  const attachBtn = document.getElementById('attachBtn');
  const composeInput = document.getElementById('composeInput');
  const sendBtn = document.getElementById('sendBtn');
  const fileInput = document.getElementById('fileInput');
  const feedContainer = document.getElementById('feedContainer');
  const adminNameSpan = document.getElementById('adminName');
  const adminStatsSpan = document.getElementById('adminStats');
  const totalVuesSpan = document.getElementById('totalVues');
  const totalLikesSpan = document.getElementById('totalLikes');
  const statsOverlay = document.getElementById('statsOverlay');
  const statsBackdrop = document.getElementById('statsBackdrop');
  const statsClose = document.getElementById('statsClose');
  const statsTotalVues = document.getElementById('statsTotalVues');
  const statsTotalLikes = document.getElementById('statsTotalLikes');
  const statsTotalPublications = document.getElementById('statsTotalPublications');
  const statsDetailsDiv = document.getElementById('statsDetails');
  const editOverlay = document.getElementById('editOverlay');
  const editBackdrop = document.getElementById('editBackdrop');
  const editClose = document.getElementById('editClose');
  const editTextarea = document.getElementById('editTextarea');
  const editSaveBtn = document.getElementById('editSaveBtn');

  // ---------------------------------------------
  // INITIALISATION
  // ---------------------------------------------
  async function init() {
    try {
      await waitForDom();
      await initSupabase();
      
      const isAdmin = await checkAdminSession();
      if (!isAdmin) {
        window.location.href = 'auth.html';
        return;
      }
      
      await loadPublications();
      await loadStatsGlobal();
      await updateSidebarStats();
      
      setupEventListeners();
      renderPublicationsGrid();
      
      if (composeInput) {
        composeInput.addEventListener('input', () => {
          autoResizeTextarea();
          updateSendButtonState();
        });
      }
      
      updateSendButtonState();
      
    } catch (error) {
      console.error('Erreur initialisation:', error);
      showNotification('Erreur de chargement', 'error');
    } finally {
      setTimeout(() => {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
      }, 500);
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

  async function checkAdminSession() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return false;
      
      currentUser = user;
      
      const { data: adminData } = await supabase
        .from('securite')
        .select('nom, prenom')
        .eq('id', user.id)
        .single();
      
      if (adminData && adminData.prenom) {
        adminNom = `${adminData.prenom} ${adminData.nom || ''}`;
      } else if (user.user_metadata) {
        adminNom = `${user.user_metadata.first_name || ''} ${user.user_metadata.last_name || ''}`.trim() || 'Admin AEJ';
      }
      
      if (adminNameSpan) adminNameSpan.textContent = adminNom;
      
      return true;
    } catch (error) {
      console.error('Erreur vérification session:', error);
      return false;
    }
  }

  async function loadPublications() {
    try {
      const { data, error } = await supabase
        .from('publications')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      publications = data || [];
      filterPublications();
      
    } catch (error) {
      console.error('Erreur chargement publications:', error);
      publications = [];
      filteredPublications = [];
    }
  }

  async function loadStatsGlobal() {
    try {
      const { data: vuesData } = await supabase
        .from('vu_publications')
        .select('id', { count: 'exact' });
      
      const { data: likesData } = await supabase
        .from('likes_publications')
        .select('id', { count: 'exact' });
      
      if (totalVuesSpan) totalVuesSpan.textContent = vuesData?.length || 0;
      if (totalLikesSpan) totalLikesSpan.textContent = likesData?.length || 0;
      
    } catch (error) {
      console.error('Erreur stats globales:', error);
    }
  }

  async function loadPendingFile() {
    try {
      const { data, error } = await supabase
        .from('publications_pending')
        .select('*')
        .eq('admin_id', currentUser.id)
        .single();
      
      if (error || !data) {
        pendingFile = null;
      } else {
        pendingFile = {
          type: data.type,
          bucket: data.bucket,
          url: data.contenu,
          fileName: data.chemin_storage.split('/').pop(),
          storagePath: data.chemin_storage
        };
      }
      updateHeaderDisplay();
      updateSendButtonState();
    } catch (error) {
      console.error('Erreur chargement fichier en attente:', error);
    }
  }

  function filterPublications() {
    if (!searchTerm.trim()) {
      filteredPublications = [...publications];
    } else {
      const term = searchTerm.toLowerCase();
      filteredPublications = publications.filter(pub => 
        pub.texte?.toLowerCase().includes(term) ||
        (pub.type === 'audio' && 'message vocal'.includes(term))
      );
    }
    renderPublicationsGrid();
  }

  function autoResizeTextarea() {
    if (composeInput) {
      composeInput.style.height = 'auto';
      const newHeight = Math.min(composeInput.scrollHeight, 100);
      composeInput.style.height = newHeight + 'px';
    }
  }

  function updateSendButtonState() {
    const hasText = composeInput?.value.trim().length > 0;
    const hasPending = pendingFile !== null;
    
    if (sendBtn) {
      if (hasPending) {
        if (hasText) {
          sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
          sendBtn.classList.remove('cancel-mode');
        } else {
          sendBtn.innerHTML = '<i class="fas fa-times"></i>';
          sendBtn.classList.add('cancel-mode');
        }
      } else {
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        sendBtn.classList.remove('cancel-mode');
      }
    }
    
    // Bordure rouge si fichier en attente
    const inputWrapper = document.querySelector('.compose-input-wrapper');
    if (inputWrapper) {
      if (hasPending) {
        inputWrapper.classList.add('pending-mode');
      } else {
        inputWrapper.classList.remove('pending-mode');
      }
    }
  }

  function updateHeaderDisplay() {
    // Vérifier si notification active
    if (!notificationMsg.classList.contains('hidden')) return;
    
    // Mode sélection
    if (selectionMode) {
      if (searchWrapper) searchWrapper.classList.add('hidden');
      if (pendingFileInfo) pendingFileInfo.classList.add('hidden');
      if (selectionModeBar) selectionModeBar.classList.remove('hidden');
      return;
    }
    
    // Fichier en attente
    if (pendingFile) {
      if (searchWrapper) searchWrapper.classList.add('hidden');
      if (pendingFileInfo) {
        pendingFileNameSpan.textContent = pendingFile.fileName;
        pendingFileInfo.classList.remove('hidden');
      }
      if (selectionModeBar) selectionModeBar.classList.add('hidden');
      return;
    }
    
    // Normal - barre recherche
    if (searchWrapper) searchWrapper.classList.remove('hidden');
    if (pendingFileInfo) pendingFileInfo.classList.add('hidden');
    if (selectionModeBar) selectionModeBar.classList.add('hidden');
  }

  function showHeaderNotification(message, type = 'info') {
    if (searchWrapper) searchWrapper.classList.add('hidden');
    if (pendingFileInfo) pendingFileInfo.classList.add('hidden');
    if (selectionModeBar) selectionModeBar.classList.add('hidden');
    
    notificationMsg.textContent = message;
    notificationMsg.className = `notification-message ${type}`;
    notificationMsg.classList.remove('hidden');
    
    setTimeout(() => {
      notificationMsg.classList.add('hidden');
      updateHeaderDisplay();
    }, 3000);
  }

  function renderPublicationsGrid() {
    if (!feedContainer) return;
    
    if (filteredPublications.length === 0) {
      feedContainer.innerHTML = `
        <div class="empty-feed">
          <i class="fas fa-newspaper"></i>
          <p>Aucune publication trouvée</p>
        </div>
      `;
      return;
    }
    
    const gridHtml = `
      <div class="publications-grid">
        ${filteredPublications.map(pub => renderPublicationCard(pub)).join('')}
      </div>
    `;
    
    feedContainer.innerHTML = gridHtml;
    
    // Écouteurs pour les audios
    setupAudioPlayers();
    setupMenuListeners();
    setupCardClickListeners();
    setupFullscreenListeners();
    setupSeeMoreListeners();
  }

  function renderPublicationCard(pub) {
    const date = new Date(pub.created_at);
    const formattedDate = `${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    const isSelected = selectionMode && selectedPublications.has(pub.id);
    
    let mediaHtml = '';
    if (pub.type === 'image' && pub.contenu) {
      mediaHtml = `<div class="publication-media"><img src="${pub.contenu}" alt="Image" loading="lazy"></div>`;
    } else if (pub.type === 'video' && pub.contenu) {
      mediaHtml = `<div class="publication-media"><video src="${pub.contenu}" controls></video></div>`;
    } else if (pub.type === 'pdf' && pub.contenu) {
      mediaHtml = `<div class="publication-media"><iframe src="https://docs.google.com/viewer?url=${encodeURIComponent(pub.contenu)}&embedded=true"></iframe></div>`;
    } else if (pub.type === 'audio' && pub.contenu) {
      mediaHtml = `
        <div class="publication-media">
          <div class="audio-player-wrapper" data-audio="${pub.contenu}">
            <div class="audio-player">
              <button class="audio-play-btn"><i class="fas fa-play"></i></button>
              <audio src="${pub.contenu}" preload="metadata"></audio>
              <span class="audio-label">Message vocal</span>
              <span class="audio-duration">--:--</span>
            </div>
          </div>
        </div>
      `;
    }
    
    const texteHtml = pub.texte ? `
      <div class="publication-text collapsed" id="text-${pub.id}">${escapeHtml(pub.texte)}</div>
      ${pub.texte.length > 100 ? `<button class="see-more-btn" data-id="${pub.id}">Voir plus</button>` : ''}
    ` : '';
    
    return `
      <div class="publication-card ${isSelected ? 'selected' : ''}" data-id="${pub.id}">
        <div class="publication-header">
          <div class="publication-user">
            <div class="publication-avatar">
              <i class="fas fa-user-circle"></i>
            </div>
            <div class="publication-author">${escapeHtml(adminNom)}</div>
          </div>
          <div class="publication-date">${formattedDate}</div>
        </div>
        ${texteHtml}
        ${mediaHtml}
        <div class="publication-footer">
          <div class="publication-stats">
            <span class="stat-display"><i class="fas fa-eye"></i> ${pub.vu_count || 0}</span>
            <span class="stat-display"><i class="fas fa-heart"></i> ${pub.likes_count || 0}</span>
          </div>
          <div class="publication-menu">
            <button class="menu-dots-btn" data-id="${pub.id}">
              <i class="fas fa-ellipsis-v"></i>
            </button>
            <div class="menu-dropdown" id="menu-${pub.id}">
              <div class="menu-dropdown-item edit-item" data-id="${pub.id}">
                <i class="fas fa-edit"></i> Modifier
              </div>
              <div class="menu-dropdown-item delete-item" data-id="${pub.id}">
                <i class="fas fa-trash"></i> Supprimer
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function setupAudioPlayers() {
    document.querySelectorAll('.audio-player-wrapper').forEach(wrapper => {
      const audio = wrapper.querySelector('audio');
      const playBtn = wrapper.querySelector('.audio-play-btn');
      const durationSpan = wrapper.querySelector('.audio-duration');
      
      if (audio && playBtn) {
        audio.addEventListener('loadedmetadata', () => {
          if (durationSpan && !isNaN(audio.duration)) {
            const minutes = Math.floor(audio.duration / 60);
            const seconds = Math.floor(audio.duration % 60);
            durationSpan.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          }
        });
        
        audio.addEventListener('ended', () => {
          playBtn.innerHTML = '<i class="fas fa-play"></i>';
        });
        
        playBtn.addEventListener('click', () => {
          if (audio.paused) {
            document.querySelectorAll('audio').forEach(otherAudio => {
              if (otherAudio !== audio && !otherAudio.paused) {
                otherAudio.pause();
                const otherWrapper = otherAudio.closest('.audio-player-wrapper');
                const otherBtn = otherWrapper?.querySelector('.audio-play-btn');
                if (otherBtn) otherBtn.innerHTML = '<i class="fas fa-play"></i>';
              }
            });
            audio.play();
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';
          } else {
            audio.pause();
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
          }
        });
      }
    });
  }

  function setupMenuListeners() {
    document.querySelectorAll('.menu-dots-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const menu = document.getElementById(`menu-${id}`);
        if (menu) {
          document.querySelectorAll('.menu-dropdown').forEach(m => {
            if (m !== menu) m.classList.remove('show');
          });
          menu.classList.toggle('show');
        }
      });
    });
    
    document.querySelectorAll('.edit-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = item.dataset.id;
        const pub = publications.find(p => p.id === id);
        if (pub) {
          openEditModal(pub);
        }
        document.querySelectorAll('.menu-dropdown').forEach(m => m.classList.remove('show'));
      });
    });
    
    document.querySelectorAll('.delete-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = item.dataset.id;
        if (confirm('Supprimer définitivement cette publication ?')) {
          await deletePublication(id);
        }
        document.querySelectorAll('.menu-dropdown').forEach(m => m.classList.remove('show'));
      });
    });
    
    document.addEventListener('click', () => {
      document.querySelectorAll('.menu-dropdown').forEach(m => m.classList.remove('show'));
    });
  }

  function setupCardClickListeners() {
    document.querySelectorAll('.publication-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.menu-dots-btn') || e.target.closest('.menu-dropdown-item')) return;
        if (e.target.closest('.see-more-btn')) return;
        
        const id = card.dataset.id;
        if (selectionMode) {
          if (selectedPublications.has(id)) {
            selectedPublications.delete(id);
            card.classList.remove('selected');
          } else {
            selectedPublications.add(id);
            card.classList.add('selected');
          }
          updateSelectionCount();
        } else {
          const pub = publications.find(p => p.id === id);
          if (pub) openFullscreen(pub);
        }
      });
    });
  }

  function setupSeeMoreListeners() {
    document.querySelectorAll('.see-more-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const textDiv = document.getElementById(`text-${id}`);
        if (textDiv) {
          textDiv.classList.toggle('collapsed');
          btn.textContent = textDiv.classList.contains('collapsed') ? 'Voir plus' : 'Voir moins';
        }
      });
    });
  }

  function setupFullscreenListeners() {
    // Déjà géré dans card click
  }

  function openFullscreen(pub) {
    currentFullscreenPub = pub;
    const date = new Date(pub.created_at);
    const formattedDate = `${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    
    let mediaHtml = '';
    if (pub.type === 'image' && pub.contenu) {
      mediaHtml = `<div class="fullscreen-media"><img src="${pub.contenu}" alt="Image"></div>`;
    } else if (pub.type === 'video' && pub.contenu) {
      mediaHtml = `<div class="fullscreen-media"><video src="${pub.contenu}" controls autoplay></video></div>`;
    } else if (pub.type === 'pdf' && pub.contenu) {
      mediaHtml = `<div class="fullscreen-media"><iframe src="https://docs.google.com/viewer?url=${encodeURIComponent(pub.contenu)}&embedded=true"></iframe></div>`;
    } else if (pub.type === 'audio' && pub.contenu) {
      mediaHtml = `<div class="fullscreen-media audio-full"><audio src="${pub.contenu}" controls autoplay></audio></div>`;
    } else if (pub.type === 'texte') {
      mediaHtml = `<div class="fullscreen-text-only">${escapeHtml(pub.texte || '')}</div>`;
    }
    
    const fullscreenOverlay = document.createElement('div');
    fullscreenOverlay.className = 'fullscreen-overlay';
    fullscreenOverlay.innerHTML = `
      <div class="fullscreen-backdrop"></div>
      <div class="fullscreen-container">
        <button class="fullscreen-close"><i class="fas fa-times"></i></button>
        <div class="fullscreen-layout">
          <div class="fullscreen-left">
            <div class="fullscreen-author-info">
              <div class="fullscreen-avatar"><i class="fas fa-user-circle"></i></div>
              <div class="fullscreen-author-name">${escapeHtml(adminNom)}</div>
              <div class="fullscreen-date">${formattedDate}</div>
            </div>
            <div class="fullscreen-text-content">
              ${pub.texte ? `<div class="fullscreen-text">${escapeHtml(pub.texte)}</div>` : ''}
            </div>
            <div class="fullscreen-actions">
              <button class="fullscreen-edit-btn" data-id="${pub.id}">
                <i class="fas fa-edit"></i> Modifier
              </button>
              <button class="fullscreen-delete-btn" data-id="${pub.id}">
                <i class="fas fa-trash"></i> Supprimer
              </button>
            </div>
          </div>
          <div class="fullscreen-right">
            ${mediaHtml}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(fullscreenOverlay);
    document.body.style.overflow = 'hidden';
    
    const closeBtn = fullscreenOverlay.querySelector('.fullscreen-close');
    const backdrop = fullscreenOverlay.querySelector('.fullscreen-backdrop');
    const editBtn = fullscreenOverlay.querySelector('.fullscreen-edit-btn');
    const deleteBtn = fullscreenOverlay.querySelector('.fullscreen-delete-btn');
    
    const closeFullscreen = () => {
      fullscreenOverlay.remove();
      document.body.style.overflow = '';
    };
    
    closeBtn?.addEventListener('click', closeFullscreen);
    backdrop?.addEventListener('click', closeFullscreen);
    editBtn?.addEventListener('click', () => {
      closeFullscreen();
      openEditModal(pub);
    });
    deleteBtn?.addEventListener('click', async () => {
      if (confirm('Supprimer définitivement cette publication ?')) {
        await deletePublication(pub.id);
        closeFullscreen();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.contains(fullscreenOverlay)) {
        closeFullscreen();
      }
    });
  }

  function openEditModal(pub) {
    currentEditPublicationId = pub.id;
    editTextarea.value = pub.texte || '';
    editOverlay.classList.remove('hidden');
  }

  async function saveEdit() {
    if (!currentEditPublicationId) return;
    
    const newText = editTextarea.value.trim();
    
    const { error } = await supabase
      .from('publications')
      .update({ texte: newText || null })
      .eq('id', currentEditPublicationId);
    
    if (error) {
      showHeaderNotification('Erreur lors de la modification', 'error');
      return;
    }
    
    const pub = publications.find(p => p.id === currentEditPublicationId);
    if (pub) pub.texte = newText || null;
    
    filterPublications();
    editOverlay.classList.add('hidden');
    showHeaderNotification('Publication modifiée', 'success');
  }

  async function deletePublication(id) {
    const pub = publications.find(p => p.id === id);
    if (!pub) return;
    
    // Supprimer le fichier du storage si présent
    if (pub.contenu && pub.type !== 'texte') {
      let bucket = '';
      if (pub.type === 'image') bucket = 'publications_images';
      else if (pub.type === 'video') bucket = 'publications_videos';
      else if (pub.type === 'pdf') bucket = 'publications_pdfs';
      else if (pub.type === 'audio') bucket = 'publications_audios';
      
      if (bucket && pub.contenu) {
        const path = pub.contenu.split('/').pop();
        const fullPath = `${currentUser.id}/${path}`;
        await supabase.storage.from(bucket).remove([fullPath]);
      }
    }
    
    // Supprimer les likes associés
    await supabase.from('likes_publications').delete().eq('publication_id', id);
    
    // Supprimer la publication
    const { error } = await supabase.from('publications').delete().eq('id', id);
    
    if (error) {
      showHeaderNotification('Erreur lors de la suppression', 'error');
      return;
    }
    
    publications = publications.filter(p => p.id !== id);
    filterPublications();
    await loadStatsGlobal();
    await updateSidebarStats();
    showHeaderNotification('Publication supprimée', 'success');
  }

  // ---------------------------------------------
  // PUBLICATION
  // ---------------------------------------------
  async function publishText(text) {
    if (!text.trim()) return false;
    
    try {
      const { data, error } = await supabase
        .from('publications')
        .insert({
          admin_id: currentUser.id,
          type: 'texte',
          texte: text.trim(),
          contenu: null,
          vu_count: 0,
          likes_count: 0
        })
        .select()
        .single();
      
      if (error) throw error;
      
      publications.unshift(data);
      filterPublications();
      await loadStatsGlobal();
      await updateSidebarStats();
      showHeaderNotification('Message publié', 'success');
      return true;
      
    } catch (error) {
      console.error('Erreur publication texte:', error);
      showHeaderNotification('Erreur lors de la publication', 'error');
      return false;
    }
  }

  async function publishWithFile(text) {
    if (!pendingFile) return false;
    
    try {
      const { data, error } = await supabase
        .from('publications')
        .insert({
          admin_id: currentUser.id,
          type: pendingFile.type,
          texte: text?.trim() || null,
          contenu: pendingFile.url,
          vu_count: 0,
          likes_count: 0
        })
        .select()
        .single();
      
      if (error) throw error;
      
      publications.unshift(data);
      filterPublications();
      await loadStatsGlobal();
      await updateSidebarStats();
      
      // Supprimer le fichier en attente de la table
      await supabase
        .from('publications_pending')
        .delete()
        .eq('admin_id', currentUser.id);
      
      pendingFile = null;
      
      if (composeInput) composeInput.value = '';
      autoResizeTextarea();
      updateSendButtonState();
      updateHeaderDisplay();
      
      showHeaderNotification('Publication publiée', 'success');
      return true;
      
    } catch (error) {
      console.error('Erreur publication avec fichier:', error);
      showHeaderNotification('Erreur lors de la publication', 'error');
      return false;
    }
  }

  async function cancelPending() {
    if (!pendingFile) return;
    
    // Supprimer du storage
    await supabase.storage
      .from(pendingFile.bucket)
      .remove([pendingFile.storagePath]);
    
    // Supprimer de la table pending
    await supabase
      .from('publications_pending')
      .delete()
      .eq('admin_id', currentUser.id);
    
    pendingFile = null;
    if (composeInput) composeInput.value = '';
    autoResizeTextarea();
    updateSendButtonState();
    updateHeaderDisplay();
    showHeaderNotification('Publication annulée', 'info');
  }

  async function uploadFile(file) {
    let type = '';
    let bucket = '';
    
    if (file.type.startsWith('image/')) {
      type = 'image';
      bucket = 'publications_images';
    } else if (file.type.startsWith('video/')) {
      type = 'video';
      bucket = 'publications_videos';
    } else if (file.type === 'application/pdf') {
      type = 'pdf';
      bucket = 'publications_pdfs';
    } else {
      showHeaderNotification('Format non supporté (image, vidéo, PDF)', 'error');
      return false;
    }
    
    // Supprimer l'ancien fichier en attente
    if (pendingFile) {
      await cancelPending();
    }
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);
      
      // Enregistrer dans la table pending
      const { error: insertError } = await supabase
        .from('publications_pending')
        .insert({
          admin_id: currentUser.id,
          type: type,
          contenu: urlData.publicUrl,
          bucket: bucket,
          chemin_storage: fileName
        });
      
      if (insertError) throw insertError;
      
      pendingFile = {
        type: type,
        bucket: bucket,
        url: urlData.publicUrl,
        fileName: file.name,
        storagePath: fileName
      };
      
      updateSendButtonState();
      updateHeaderDisplay();
      showHeaderNotification(`Fichier prêt: ${file.name}`, 'info');
      return true;
      
    } catch (error) {
      console.error('Erreur upload:', error);
      showHeaderNotification('Erreur lors de l\'upload', 'error');
      return false;
    }
  }

  // ---------------------------------------------
  // STATISTIQUES
  // ---------------------------------------------
  async function loadStats() {
    try {
      const { data: vuesData } = await supabase
        .from('vu_publications')
        .select('id', { count: 'exact' });
      
      const { data: likesData } = await supabase
        .from('likes_publications')
        .select('id', { count: 'exact' });
      
      if (statsTotalVues) statsTotalVues.textContent = vuesData?.length || 0;
      if (statsTotalLikes) statsTotalLikes.textContent = likesData?.length || 0;
      if (statsTotalPublications) statsTotalPublications.textContent = publications.length;
      
      if (statsDetailsDiv) {
        statsDetailsDiv.innerHTML = publications.slice(0, 10).map(pub => {
          const preview = pub.texte ? pub.texte.substring(0, 40) : (pub.type === 'audio' ? 'Message vocal' : pub.type);
          return `
            <div class="stats-publication">
              <div class="stats-publication-title">${escapeHtml(preview)}</div>
              <div class="stats-publication-count">
                <span><i class="fas fa-eye"></i> ${pub.vu_count || 0}</span>
                <span><i class="fas fa-heart"></i> ${pub.likes_count || 0}</span>
              </div>
            </div>
          `;
        }).join('');
      }
      
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  }

  async function updateSidebarStats() {
    if (adminStatsSpan) {
      adminStatsSpan.textContent = `${publications.length} publication${publications.length !== 1 ? 's' : ''}`;
    }
  }

  // ---------------------------------------------
  // SÉLECTION MULTIPLE
  // ---------------------------------------------
  function toggleSelectionMode() {
    selectionMode = !selectionMode;
    if (!selectionMode) {
      selectedPublications.clear();
      updateSelectionCount();
      document.querySelectorAll('.publication-card').forEach(card => {
        card.classList.remove('selected');
      });
    }
    updateHeaderDisplay();
  }

  function updateSelectionCount() {
    if (selectionCountSpan) {
      const count = selectedPublications.size;
      selectionCountSpan.textContent = `${count} sélectionné${count !== 1 ? 's' : ''}`;
    }
  }

  async function deleteSelected() {
    if (selectedPublications.size === 0) return;
    
    if (!confirm(`Supprimer ${selectedPublications.size} publication${selectedPublications.size !== 1 ? 's' : ''} ?`)) return;
    
    for (const id of selectedPublications) {
      await deletePublication(id);
    }
    
    selectedPublications.clear();
    selectionMode = false;
    updateSelectionCount();
    updateHeaderDisplay();
  }

  function cancelSelection() {
    selectionMode = false;
    selectedPublications.clear();
    updateSelectionCount();
    document.querySelectorAll('.publication-card').forEach(card => {
      card.classList.remove('selected');
    });
    updateHeaderDisplay();
  }

  // ---------------------------------------------
  // NOTIFICATIONS
  // ---------------------------------------------
  function showNotification(message, type = 'info', duration = 3000) {
    const existing = document.querySelector('.temp-notification');
    if (existing) existing.remove();
    
    const notif = document.createElement('div');
    notif.className = `temp-notification ${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);
    
    setTimeout(() => {
      if (notif.parentNode) notif.remove();
    }, duration);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------------------------------------------
  // ÉCOUTEURS
  // ---------------------------------------------
  function setupEventListeners() {
    // Thème
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('night-mode');
        const isNight = document.body.classList.contains('night-mode');
        localStorage.setItem('theme', isNight ? 'night' : 'light');
        themeToggle.innerHTML = isNight ? '<i class="fas fa-sun"></i><span>Thème</span>' : '<i class="fas fa-moon"></i><span>Thème</span>';
      });
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'night') {
        document.body.classList.add('night-mode');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i><span>Thème</span>';
      }
    }
    
    // Dashboard
    if (dashboardBtn) {
      dashboardBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }
    
    // Sélection multiple
    if (selectionModeBtn) {
      selectionModeBtn.addEventListener('click', toggleSelectionMode);
    }
    
    if (selectionDeleteBtn) {
      selectionDeleteBtn.addEventListener('click', deleteSelected);
    }
    
    if (selectionCancelBtn) {
      selectionCancelBtn.addEventListener('click', cancelSelection);
    }
    
    // Upload fichier
    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', () => {
        fileInput.accept = 'image/*,video/*,application/pdf';
        fileInput.click();
      });
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) await uploadFile(file);
        fileInput.value = '';
      });
    }
    
    // Envoi publication
    if (sendBtn && composeInput) {
      sendBtn.addEventListener('click', async () => {
        const text = composeInput.value;
        if (pendingFile) {
          if (text.trim()) {
            await publishWithFile(text);
            composeInput.value = '';
            autoResizeTextarea();
          } else {
            await cancelPending();
          }
        } else if (text.trim()) {
          await publishText(text);
          composeInput.value = '';
          autoResizeTextarea();
        }
      });
      
      composeInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          sendBtn.click();
        }
      });
    }
    
    // Recherche
    if (searchInput) {
      let timeout;
      searchInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          searchTerm = searchInput.value;
          filterPublications();
        }, 300);
      });
    }
    
    // Statistiques
    const statsBtn = document.getElementById('statistiquesBtn');
    if (statsBtn) {
      statsBtn.addEventListener('click', async () => {
        await loadStats();
        statsOverlay.classList.remove('hidden');
      });
    }
    
    if (statsClose) statsClose.addEventListener('click', () => statsOverlay.classList.add('hidden'));
    if (statsBackdrop) statsBackdrop.addEventListener('click', () => statsOverlay.classList.add('hidden'));
    
    // Édition
    if (editClose) editClose.addEventListener('click', () => editOverlay.classList.add('hidden'));
    if (editBackdrop) editBackdrop.addEventListener('click', () => editOverlay.classList.add('hidden'));
    if (editSaveBtn) editSaveBtn.addEventListener('click', saveEdit);
    
    // Charger fichier en attente existant
    loadPendingFile();
  }

  // Ajout des styles pour le plein écran
  const style = document.createElement('style');
  style.textContent = `
    .fullscreen-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 3000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .fullscreen-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
    }
    .fullscreen-container {
      position: relative;
      width: 90%;
      max-width: 1200px;
      height: 85vh;
      z-index: 3001;
      animation: fadeInUp 0.3s ease;
    }
    .fullscreen-close {
      position: absolute;
      top: -50px;
      right: 0;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      font-size: 1.2rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 3002;
    }
    .fullscreen-layout {
      display: flex;
      height: 100%;
      background: var(--card-bg);
      border-radius: 30px;
      overflow: hidden;
    }
    .fullscreen-left {
      width: 30%;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      border-right: 1px solid rgba(0, 0, 0, 0.1);
      overflow-y: auto;
    }
    .fullscreen-right {
      width: 70%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: black;
      overflow: hidden;
    }
    .fullscreen-right img,
    .fullscreen-right video {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .fullscreen-right iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    .fullscreen-text-only {
      padding: 2rem;
      font-size: 1.2rem;
      line-height: 1.6;
      white-space: pre-wrap;
      overflow-y: auto;
      max-height: 100%;
    }
    .fullscreen-author-info {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      flex-wrap: wrap;
    }
    .fullscreen-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--gradient-main);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .fullscreen-avatar i {
      font-size: 1.5rem;
      color: white;
    }
    .fullscreen-author-name {
      font-weight: 600;
      font-size: 1rem;
    }
    .fullscreen-date {
      font-size: 0.8rem;
      color: var(--text-light);
      background: var(--bg-soft);
      padding: 0.3rem 0.8rem;
      border-radius: 30px;
    }
    .fullscreen-text-content {
      flex: 1;
      overflow-y: auto;
    }
    .fullscreen-text {
      font-size: 1rem;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .fullscreen-actions {
      display: flex;
      gap: 1rem;
      margin-top: auto;
      padding-top: 1rem;
    }
    .fullscreen-edit-btn,
    .fullscreen-delete-btn {
      flex: 1;
      padding: 0.6rem;
      border: none;
      border-radius: 30px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s;
    }
    .fullscreen-edit-btn {
      background: var(--gradient-main);
      color: white;
    }
    .fullscreen-delete-btn {
      background: #d32f2f;
      color: white;
    }
    body.night-mode .fullscreen-left {
      background: var(--card-bg);
      border-right-color: rgba(255, 255, 255, 0.1);
    }
    body.night-mode .fullscreen-date {
      background: #2a3038;
    }
    @media (max-width: 768px) {
      .fullscreen-layout {
        flex-direction: column;
      }
      .fullscreen-left, .fullscreen-right {
        width: 100%;
      }
      .fullscreen-right {
        min-height: 300px;
      }
    }
  `;
  document.head.appendChild(style);
  
  init();
})();
