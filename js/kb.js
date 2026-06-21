/* =============================================
   kb.js — Knowledge Base & Troubleshooting Wizard
   ============================================= */

// Global state for portal troubleshooter wizard
let activeArticle = null;
let currentStepIdx = 0;
let currentSelectedCategory = 'All';

document.addEventListener('DOMContentLoaded', () => {
  // Determine if we are on the admin page or portal page
  const isAdmin = !!document.getElementById('view-kb');
  const isPortal = !!document.getElementById('ptab-kb');

  if (isAdmin) {
    initAdminKB();
  }
  if (isPortal) {
    initPortalKB();
  }
});

/* =============================================
   ADMIN KNOWLEDGE BASE FUNCTIONS
   ============================================= */
function initAdminKB() {
  const addBtn = document.getElementById('btn-add-kb');
  const cancelBtn = document.getElementById('kb-modal-cancel');
  const saveBtn = document.getElementById('kb-modal-save');
  const closeBtn = document.getElementById('kb-modal-close');
  const searchInput = document.getElementById('kb-search');
  const filterCategory = document.getElementById('kb-filter-category');

  if (addBtn) addBtn.addEventListener('click', () => openKBModal());
  if (cancelBtn) cancelBtn.addEventListener('click', closeKBModal);
  if (closeBtn) closeBtn.addEventListener('click', closeKBModal);
  if (saveBtn) saveBtn.addEventListener('click', saveKBArticle);

  if (searchInput) searchInput.addEventListener('input', renderAdminKB);
  if (filterCategory) filterCategory.addEventListener('change', renderAdminKB);

  // Initial render
  renderAdminKB();
}

function renderAdminKB() {
  const tbody = document.getElementById('kb-tbody');
  if (!tbody) return;

  const search = (document.getElementById('kb-search')?.value || '').toLowerCase();
  const category = document.getElementById('kb-filter-category')?.value || '';

  const articles = loadKBArticles();
  
  const filtered = articles.filter(art => {
    const matchesSearch = art.title.toLowerCase().includes(search) || 
                          art.desc.toLowerCase().includes(search) || 
                          art.id.toLowerCase().includes(search);
    const matchesCategory = !category || art.category === category;
    return matchesSearch && matchesCategory;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-secondary)">No knowledge articles found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(art => {
    const stepsCount = Array.isArray(art.steps) ? art.steps.length : 0;
    const createdDate = art.created ? new Date(art.created).toLocaleDateString() : 'N/A';
    return `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:12px; font-weight:600;">${art.id}</td>
        <td style="padding:12px; font-weight:600;">${art.title}</td>
        <td style="padding:12px;"><span class="badge" style="background:var(--blue-light); color:var(--blue); border-radius:12px; padding:2px 8px; font-size:0.75rem;">${art.category}</span></td>
        <td style="padding:12px;">${stepsCount} steps</td>
        <td style="padding:12px; color:var(--text-secondary)">${art.author}</td>
        <td style="padding:12px; color:var(--text-secondary)">${createdDate}</td>
        <td style="padding:12px; text-align:right;">
          <button class="action-btn" onclick="openKBModal('${art.id}')" title="Edit" style="background:none; border:none; cursor:pointer; font-size:1.1rem; margin-right:8px;">✏️</button>
          <button class="action-btn" onclick="deleteKBArticle('${art.id}')" title="Delete" style="background:none; border:none; cursor:pointer; font-size:1.1rem; color:var(--red);">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openKBModal(id = null) {
  const overlay = document.getElementById('kb-modal-overlay');
  const titleEl = document.getElementById('kb-modal-title');
  const idInput = document.getElementById('kbm-id');
  const titleInput = document.getElementById('kbm-title');
  const categorySelect = document.getElementById('kbm-category');
  const descInput = document.getElementById('kbm-desc');
  const stepsInput = document.getElementById('kbm-steps');

  if (!overlay) return;

  // Reset fields
  idInput.value = '';
  titleInput.value = '';
  categorySelect.value = 'Hardware';
  descInput.value = '';
  stepsInput.value = '';

  if (id) {
    titleEl.textContent = '📚 Edit KB Article';
    const articles = loadKBArticles();
    const art = articles.find(x => x.id === id);
    if (art) {
      idInput.value = art.id;
      titleInput.value = art.title;
      categorySelect.value = art.category;
      descInput.value = art.desc;
      stepsInput.value = Array.isArray(art.steps) ? art.steps.join('\n') : '';
    }
  } else {
    titleEl.textContent = '📚 Add KB Article';
  }

  overlay.classList.add('open');
}

function closeKBModal() {
  const overlay = document.getElementById('kb-modal-overlay');
  if (overlay) overlay.classList.remove('open');
}

function saveKBArticle() {
  const id = document.getElementById('kbm-id').value;
  const title = document.getElementById('kbm-title').value.trim();
  const category = document.getElementById('kbm-category').value;
  const desc = document.getElementById('kbm-desc').value.trim();
  const stepsRaw = document.getElementById('kbm-steps').value.trim();

  if (!title || !desc || !stepsRaw) {
    if (typeof showToast === 'function') showToast('Please fill in all required fields.', 'error');
    return;
  }

  const steps = stepsRaw.split('\n').map(s => s.trim()).filter(Boolean);
  if (steps.length === 0) {
    if (typeof showToast === 'function') showToast('Please enter at least one troubleshooting step.', 'error');
    return;
  }

  const articles = loadKBArticles();
  
  // Get active session user name
  let authorName = 'System';
  try {
    const sess = JSON.parse(sessionStorage.getItem('hd_admin_auth_v1') || localStorage.getItem('hd_admin_auth_v1'));
    if (sess && sess.name) authorName = sess.name;
  } catch(e) {}

  if (id) {
    // Edit mode
    const idx = articles.findIndex(x => x.id === id);
    if (idx !== -1) {
      articles[idx].title = title;
      articles[idx].category = category;
      articles[idx].desc = desc;
      articles[idx].steps = steps;
      // Preserve author and created date
    }
  } else {
    // Add mode
    const nextNum = articles.length ? Math.max(...articles.map(x => parseInt(x.id.split('-')[1]) || 0)) + 1 : 1;
    const newId = `KB-${String(nextNum).padStart(4, '0')}`;
    const newArt = {
      id: newId,
      title,
      category,
      desc,
      steps,
      author: authorName,
      created: new Date().toISOString()
    };
    articles.push(newArt);
  }

  saveKBArticles(articles);
  closeKBModal();
  renderAdminKB();

  if (typeof showToast === 'function') {
    showToast(id ? 'Knowledge article updated!' : 'Knowledge article created successfully!', 'success');
  }
}

function deleteKBArticle(id) {
  if (!confirm(`Are you sure you want to delete article ${id}?`)) return;
  const articles = loadKBArticles();
  const filtered = articles.filter(x => x.id !== id);
  saveKBArticles(filtered);
  renderAdminKB();
  if (typeof showToast === 'function') showToast('Knowledge article deleted.', 'success');
}

// Make admin functions globally available
window.renderAdminKB = renderAdminKB;
window.openKBModal = openKBModal;
window.deleteKBArticle = deleteKBArticle;


/* =============================================
   USER PORTAL KNOWLEDGE BASE FUNCTIONS
   ============================================= */
function initPortalKB() {
  const searchInput = document.getElementById('kb-portal-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderPortalKBArticles();
    });
  }
  renderPortalKBCategories();
  renderPortalKBArticles();
}

function renderPortalKBCategories() {
  const container = document.getElementById('kb-cat-list');
  if (!container) return;

  const categories = ['All', 'Hardware', 'Software', 'Network', 'Account', 'Security', 'Other'];
  container.innerHTML = categories.map(cat => {
    const activeCls = cat === currentSelectedCategory ? 'active' : '';
    return `<button class="kb-cat-btn ${activeCls}" onclick="filterPortalKBCategory('${cat}')">${cat}</button>`;
  }).join('');
}

function filterPortalKBCategory(cat) {
  currentSelectedCategory = cat;
  renderPortalKBCategories();
  renderPortalKBArticles();
}

function renderPortalKBArticles() {
  const container = document.getElementById('kb-article-list');
  if (!container) return;

  const searchVal = (document.getElementById('kb-portal-search')?.value || '').trim().toLowerCase();

  const articles = loadKBArticles();
  let filtered = currentSelectedCategory === 'All' 
    ? articles 
    : articles.filter(a => a.category === currentSelectedCategory);

  if (searchVal) {
    filtered = filtered.filter(art => {
      const matchTitle = art.title.toLowerCase().includes(searchVal);
      const matchDesc = art.desc && art.desc.toLowerCase().includes(searchVal);
      const matchSteps = Array.isArray(art.steps) && art.steps.some(step => step.toLowerCase().includes(searchVal));
      return matchTitle || matchDesc || matchSteps;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `<p style="color:var(--text-secondary); font-size:0.8rem; text-align:center; padding:12px;">No guides available.</p>`;
    return;
  }

  container.innerHTML = filtered.map(art => {
    const stepsCount = Array.isArray(art.steps) ? art.steps.length : 0;
    const activeCls = activeArticle && activeArticle.id === art.id ? 'active' : '';
    return `
      <button class="kb-art-btn ${activeCls}" onclick="selectPortalKBArticle('${art.id}')">
        <span class="kb-art-title">${art.title}</span>
        <span class="kb-art-meta">${art.category} · ${stepsCount} steps</span>
      </button>
    `;
  }).join('');
}

function selectPortalKBArticle(id) {
  const articles = loadKBArticles();
  const art = articles.find(x => x.id === id);
  if (!art) return;

  activeArticle = art;
  currentStepIdx = 0;

  // Refresh lists to show active highlights
  renderPortalKBArticles();

  // Show content card and hide default
  document.getElementById('kb-content-default').style.display = 'none';
  const viewCard = document.getElementById('kb-article-view');
  viewCard.style.display = 'block';

  renderKBArticleDetail();
}

function renderKBArticleDetail() {
  const viewCard = document.getElementById('kb-article-view');
  if (!viewCard || !activeArticle) return;

  viewCard.innerHTML = `
    <div style="border-bottom:1px solid var(--border); padding-bottom:16px; margin-bottom:20px">
      <div style="font-size:0.75rem; font-weight:700; color:var(--blue); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">${activeArticle.category} GUIDE</div>
      <h2 style="font-size:1.35rem; font-weight:800; color:var(--text); margin-bottom:6px">${activeArticle.title}</h2>
      <p style="color:var(--text-2); font-size:0.85rem">${activeArticle.desc}</p>
    </div>
    
    <div style="margin-bottom:18px;">
      <h4 style="font-size:0.8rem; text-transform:uppercase; color:var(--text-2); font-weight:700; margin-bottom:10px; letter-spacing:0.5px">Interactive Troubleshooting Wizard</h4>
      <p style="font-size:0.83rem; color:var(--text-2); margin-bottom:14px">Follow the steps below to diagnose and resolve your issue:</p>
      <div id="kb-wizard-container"></div>
    </div>
  `;

  renderWizardStep();
}

function renderWizardStep() {
  const container = document.getElementById('kb-wizard-container');
  if (!container || !activeArticle) return;

  const totalSteps = activeArticle.steps.length;
  const currentStepText = activeArticle.steps[currentStepIdx];

  container.innerHTML = `
    <div class="kb-wizard">
      <div class="wizard-progress">
        <span>Step ${currentStepIdx + 1} of ${totalSteps}</span>
        <span>${Math.round(((currentStepIdx + 1) / totalSteps) * 100)}% Complete</span>
      </div>
      <div class="wizard-step-text">${currentStepText}</div>
      <div class="wizard-actions">
        <button class="portal-btn portal-btn-primary" onclick="finishWizard(true)">✓ This solved my issue!</button>
        ${currentStepIdx < totalSteps - 1 
          ? `<button class="portal-btn portal-btn-ghost" onclick="advanceWizardStep(1)">Next Step →</button>` 
          : `<button class="portal-btn portal-btn-danger" onclick="finishWizard(false)">... Still not working</button>`}
        ${currentStepIdx > 0 
          ? `<button class="portal-btn portal-btn-ghost" onclick="advanceWizardStep(-1)" style="margin-left:auto">← Previous</button>` 
          : ''}
      </div>
    </div>
  `;
}

function advanceWizardStep(val) {
  if (!activeArticle) return;
  currentStepIdx += val;
  renderWizardStep();
}

function finishWizard(success) {
  const container = document.getElementById('kb-wizard-container');
  if (!container || !activeArticle) return;

  if (success) {
    container.innerHTML = `
      <div class="kb-wizard" style="background:rgba(22,163,74,0.05); border-color:rgba(22,163,74,0.15); text-align:center; padding:32px 20px;">
        <div style="font-size:2.5rem; margin-bottom:10px">🎉</div>
        <h3 style="color:var(--green); font-weight:700">Issue Solved!</h3>
        <p style="font-size:0.85rem; color:var(--text-2); margin-top:6px; margin-bottom:20px">Awesome! We're glad this self-service troubleshooting guide resolved your issue.</p>
        <button class="portal-btn portal-btn-ghost" onclick="resetWizard()">Troubleshoot another issue</button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="kb-wizard" style="background:rgba(220,38,38,0.05); border-color:rgba(220,38,38,0.15); text-align:center; padding:32px 20px;">
        <div style="font-size:2.5rem; margin-bottom:10px">⚠️</div>
        <h3 style="color:var(--red); font-weight:700">Issue Unresolved</h3>
        <p style="font-size:0.85rem; color:var(--text-2); margin-top:6px; margin-bottom:20px">We've completed all recommended troubleshooting steps, but the issue persists.</p>
        <div style="display:flex; justify-content:center; gap:12px">
          <button class="portal-btn portal-btn-danger" onclick="prefillTicketFromKB()">🎫 Create Support Ticket</button>
          <button class="portal-btn portal-btn-ghost" onclick="resetWizard()">Restart Guide</button>
        </div>
      </div>
    `;
  }
}

function resetWizard() {
  currentStepIdx = 0;
  renderWizardStep();
}

function prefillTicketFromKB() {
  if (!activeArticle) return;

  // Compile troubleshooting audit logs
  let stepsTriedText = '';
  activeArticle.steps.forEach((step, idx) => {
    stepsTriedText += `- Step ${idx + 1}: ${step} [TRIED & FAILED]\n`;
  });

  // Prefill new ticket form
  switchTab('new-ticket');
  
  const categoryPrefix = activeArticle.category || 'IT';
  document.getElementById('nt-subject').value = `[${categoryPrefix} Troubleshooter] ${activeArticle.title}`;
  document.getElementById('nt-category').value = activeArticle.category;
  document.getElementById('nt-priority').value = 'Medium';
  document.getElementById('nt-desc').value = `I followed the self-service troubleshooting guide for "${activeArticle.title}" but the issue persists.\n\nHere are the diagnostics attempted:\n${stepsTriedText}\nPlease assist with resolving this issue.`;

  if (typeof pToast === 'function') {
    pToast('Support ticket pre-filled with your troubleshooting diagnostics!', 'success');
  }
}

// Make portal functions globally available
window.filterPortalKBCategory = filterPortalKBCategory;
window.selectPortalKBArticle = selectPortalKBArticle;
window.advanceWizardStep = advanceWizardStep;
window.finishWizard = finishWizard;
window.resetWizard = resetWizard;
window.prefillTicketFromKB = prefillTicketFromKB;
