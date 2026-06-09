/* =============================================
   ui.js — Modals, toasts, theme, sidebar, notifs
============================================= */

// ====== THEME ======
function initTheme() {
  const saved = localStorage.getItem('hd_theme') || 'dark';
  setTheme(saved);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('hd_theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  const light = document.getElementById('theme-light-btn');
  const dark = document.getElementById('theme-dark-btn');
  if (light && dark) {
    light.classList.toggle('active', theme === 'light');
    dark.classList.toggle('active', theme === 'dark');
  }
  setTimeout(() => { updateDashboard(); }, 100);
}

function initThemeEvents() {
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === 'dark' ? 'light' : 'dark');
  });
  document.getElementById('theme-light-btn').addEventListener('click', () => setTheme('light'));
  document.getElementById('theme-dark-btn').addEventListener('click', () => setTheme('dark'));
}

// ====== SIDEBAR TOGGLE ======
function initSidebarToggle() {
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.body.classList.toggle('sidebar-collapsed');
  });
}

// ====== TOAST ======
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
  toast.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ====== NOTIFICATIONS ======
let notifications = [...NOTIFICATIONS];

function initNotifications() {
  renderNotifications();
  const btn = document.getElementById('notif-btn');
  const panel = document.getElementById('notif-panel');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== btn) {
      panel.classList.remove('open');
    }
  });
  document.getElementById('mark-all-read').addEventListener('click', () => {
    notifications.forEach(n => n.read = true);
    renderNotifications();
    showToast('All notifications marked as read.', 'info');
  });
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  const badge = document.getElementById('notif-badge');
  const unread = notifications.filter(n => !n.read).length;
  badge.textContent = unread;
  badge.style.display = unread > 0 ? 'flex' : 'none';

  list.innerHTML = '';
  notifications.forEach(n => {
    const div = document.createElement('div');
    div.className = 'notif-item' + (n.read ? '' : ' unread');
    div.innerHTML = `
      <div class="notif-dot" style="${n.read ? 'background:var(--border)' : ''}"></div>
      <div><div class="notif-text">${n.text}</div><div class="notif-time">${n.time}</div></div>`;
    div.addEventListener('click', () => { n.read = true; renderNotifications(); });
    list.appendChild(div);
  });
}

function addNotification(text) {
  notifications.unshift({ id: `n${Date.now()}`, text, time:'just now', read:false });
  renderNotifications();
}

// ====== SETTINGS ======
function initSettings() {
  // SLA Settings Save
  const saveSlaBtn = document.getElementById('save-sla');
  if (saveSlaBtn) {
    saveSlaBtn.addEventListener('click', () => {
      const sla = {
        Critical: parseInt(document.getElementById('sla-critical').value) || 2,
        High: parseInt(document.getElementById('sla-high').value) || 8,
        Medium: parseInt(document.getElementById('sla-medium').value) || 24,
        Low: parseInt(document.getElementById('sla-low').value) || 72,
      };
      saveSLA(sla);
      showToast('SLA settings saved!', 'success');
      applyFilters();
    });
  }

  // Load current SLA values
  const sla = loadSLA();
  const slaCrit = document.getElementById('sla-critical');
  const slaHigh = document.getElementById('sla-high');
  const slaMed = document.getElementById('sla-medium');
  const slaLow = document.getElementById('sla-low');
  if (slaCrit) slaCrit.value = sla.Critical;
  if (slaHigh) slaHigh.value = sla.High;
  if (slaMed) slaMed.value = sla.Medium;
  if (slaLow) slaLow.value = sla.Low;

  // Ticket ID Settings
  const tktCfg = loadTicketIdConfig ? loadTicketIdConfig() : { prefix: 'TKT', separator: '-', dateComp: 'none', padding: 4 };
  const tktPrefixInput = document.getElementById('tkt-id-prefix');
  const tktSeparatorSelect = document.getElementById('tkt-id-separator');
  const tktDateSelect = document.getElementById('tkt-id-date');
  const tktPaddingSelect = document.getElementById('tkt-id-padding');
  const tktPreview = document.getElementById('tkt-id-preview');

  if (tktPrefixInput) tktPrefixInput.value = tktCfg.prefix;
  if (tktSeparatorSelect) tktSeparatorSelect.value = tktCfg.separator;
  if (tktDateSelect) tktDateSelect.value = tktCfg.dateComp;
  if (tktPaddingSelect) tktPaddingSelect.value = tktCfg.padding;

  const updateIdPreview = () => {
    if (!tktPreview || !tktPrefixInput) return;
    let parts = [tktPrefixInput.value.trim() || 'TKT'];
    if (tktDateSelect && tktDateSelect.value !== 'none') {
      const d = new Date();
      const yyyy = String(d.getFullYear());
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      if (tktDateSelect.value === 'yyyy') parts.push(yyyy);
      else if (tktDateSelect.value === 'yyyymm') parts.push(yyyy + mm);
      else if (tktDateSelect.value === 'yyyymmdd') parts.push(yyyy + mm + dd);
    }
    const paddingVal = tktPaddingSelect ? parseInt(tktPaddingSelect.value) : 4;
    const seq = String(42).padStart(paddingVal || 4, '0');
    parts.push(seq);
    const sep = tktSeparatorSelect ? tktSeparatorSelect.value : '-';
    tktPreview.textContent = parts.join(sep);
  };

  [tktPrefixInput, tktSeparatorSelect, tktDateSelect, tktPaddingSelect].forEach(el => {
    if (el) el.addEventListener('input', updateIdPreview);
  });
  updateIdPreview();

  const saveTktBtn = document.getElementById('save-tkt-id');
  if (saveTktBtn) {
    saveTktBtn.addEventListener('click', () => {
      const prefix = tktPrefixInput ? tktPrefixInput.value.trim() : 'TKT';
      if (!prefix) {
        showToast('Prefix is required.', 'error');
        return;
      }
      const newCfg = {
        prefix,
        separator: tktSeparatorSelect ? tktSeparatorSelect.value : '-',
        dateComp: tktDateSelect ? tktDateSelect.value : 'none',
        padding: tktPaddingSelect ? (parseInt(tktPaddingSelect.value) || 4) : 4
      };
      if (saveTicketIdConfig) {
        saveTicketIdConfig(newCfg);
        showToast('Ticket ID settings saved!', 'success');
      }
    });
  }
}
