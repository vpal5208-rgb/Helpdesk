/* =============================================
   ui.js — Modals, toasts, theme, sidebar, notifs
============================================= */

// ====== THEME ======
function initTheme() {
  const saved = localStorage.getItem('hd_theme') || 'dark';
  setTheme(saved);
  try { applyCompanyLogo(); } catch(e) {}
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

  // Load and render user roles table
  renderSettingsRolesTable();

  // Company Logo settings
  const logoInput = document.getElementById('company-logo-input');
  const resetLogoBtn = document.getElementById('btn-reset-company-logo');

  if (logoInput) {
    logoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (!file.type.startsWith('image/')) {
          showToast('Please upload an image file.', 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = (evt) => {
          localStorage.setItem('hd_company_logo', evt.target.result);
          applyCompanyLogo();
          showToast('Company logo updated successfully!', 'success');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (resetLogoBtn) {
    resetLogoBtn.addEventListener('click', () => {
      localStorage.removeItem('hd_company_logo');
      applyCompanyLogo();
      showToast('Company logo reset to default.', 'info');
    });
  }

  applyCompanyLogo();

  // Add Custom Role button click
  const addCustomRoleBtn = document.getElementById('btn-add-custom-role');
  if (addCustomRoleBtn) {
    addCustomRoleBtn.addEventListener('click', () => {
      document.getElementById('role-modal-title').textContent = '👥 Add Custom Role';
      document.getElementById('rm-key').value = '';
      document.getElementById('rm-name').value = '';
      document.getElementById('rm-name').disabled = false;
      document.getElementById('rm-color').value = 'gray';
      document.getElementById('rm-desc').value = '';
      document.querySelectorAll('.rm-perm').forEach(cb => cb.checked = false);
      document.getElementById('role-modal-overlay').classList.add('open');
    });
  }

  // Role modal close / cancel listeners
  const closeRoleModal = () => document.getElementById('role-modal-overlay').classList.remove('open');
  document.getElementById('role-modal-close')?.addEventListener('click', closeRoleModal);
  document.getElementById('role-modal-cancel')?.addEventListener('click', closeRoleModal);
  document.getElementById('role-modal-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeRoleModal();
  });

  // Save Role button click
  const saveRoleBtn = document.getElementById('role-modal-save');
  if (saveRoleBtn) {
    saveRoleBtn.addEventListener('click', () => {
      const key = document.getElementById('rm-key').value;
      const name = document.getElementById('rm-name').value.trim();
      const color = document.getElementById('rm-color').value;
      const desc = document.getElementById('rm-desc').value.trim();
      const permissions = [...document.querySelectorAll('.rm-perm:checked')].map(cb => cb.value);

      if (!name) {
        showToast('Role Name is required.', 'error');
        return;
      }

      let res;
      if (key) {
        res = updateRole(key, name, color, desc, permissions);
      } else {
        res = addRole(name, color, desc, permissions);
      }

      if (res.success) {
        showToast(key ? 'Role updated successfully!' : 'Role created successfully!', 'success');
        closeRoleModal();
        renderSettingsRolesTable();
        // Refresh users list and immediate sidebar permissions
        if (window.refreshUsersView) refreshUsersView();
        if (window.applyRolePermissions) applyRolePermissions();
      } else {
        showToast(res.error || 'Failed to save role.', 'error');
      }
    });
  }

  // Edit / Delete role action handlers (delegated)
  const rolesTbody = document.getElementById('roles-tbody');
  if (rolesTbody) {
    rolesTbody.addEventListener('click', e => {
      const editBtn = e.target.closest('.btn-edit-role');
      const deleteBtn = e.target.closest('.btn-delete-role');
      
      if (editBtn) {
        const key = editBtn.dataset.key;
        const roles = loadRoles();
        const role = roles.find(r => r.key === key);
        if (!role) return;

        document.getElementById('role-modal-title').textContent = '✏ Edit Role';
        document.getElementById('rm-key').value = role.key;
        document.getElementById('rm-name').value = role.name;
        // Disable renaming for default roles
        document.getElementById('rm-name').disabled = !!role.isDefault;
        document.getElementById('rm-color').value = role.color;
        document.getElementById('rm-desc').value = role.desc || '';
        
        // Populate permission checkboxes
        const perms = role.permissions || [];
        document.querySelectorAll('.rm-perm').forEach(cb => {
          cb.checked = perms.includes(cb.value);
        });

        document.getElementById('role-modal-overlay').classList.add('open');
      }
      
      if (deleteBtn) {
        const key = deleteBtn.dataset.key;
        if (confirm(`Are you sure you want to delete the custom role "${key}"?`)) {
          const res = deleteRole(key);
          if (res.success) {
            showToast('Role deleted successfully!', 'success');
            renderSettingsRolesTable();
            if (window.refreshUsersView) refreshUsersView();
            if (window.applyRolePermissions) applyRolePermissions();
          } else {
            showToast(res.error || 'Failed to delete role.', 'error');
          }
        }
      }
    });
  }

  // ── Office 365 Authentication Settings ──
  const msEnabledCb = document.getElementById('auth-ms-enabled');
  const msClientIdInp = document.getElementById('auth-ms-client-id');
  const msTenantIdInp = document.getElementById('auth-ms-tenant-id');
  const msRedirectInp = document.getElementById('auth-ms-redirect-uri');
  const msConfigFields = document.getElementById('auth-ms-config-fields');
  const saveAuthSettingsBtn = document.getElementById('save-auth-settings');

  if (msRedirectInp) {
    msRedirectInp.value = window.location.origin + window.location.pathname;
  }

  const toggleMsConfigFields = () => {
    if (msConfigFields && msEnabledCb) {
      msConfigFields.style.display = msEnabledCb.checked ? 'flex' : 'none';
    }
  };

  if (msEnabledCb) {
    msEnabledCb.addEventListener('change', toggleMsConfigFields);
  }

  // Load saved settings
  const authSettings = typeof loadAuthSettings === 'function' ? loadAuthSettings() : { msO365Enabled: true, clientId: '', tenantId: 'common' };
  if (msEnabledCb) msEnabledCb.checked = authSettings.msO365Enabled;
  if (msClientIdInp) msClientIdInp.value = authSettings.clientId || '';
  if (msTenantIdInp) msTenantIdInp.value = authSettings.tenantId || 'common';
  toggleMsConfigFields();

  if (saveAuthSettingsBtn) {
    saveAuthSettingsBtn.addEventListener('click', () => {
      const enabled = msEnabledCb ? msEnabledCb.checked : false;
      const clientId = msClientIdInp ? msClientIdInp.value.trim() : '';
      const tenantId = msTenantIdInp ? msTenantIdInp.value.trim() : 'common';

      if (enabled && !clientId) {
        showToast('Application (client) ID is required when Microsoft SSO is enabled.', 'error');
        return;
      }

      const newSettings = {
        msO365Enabled: enabled,
        clientId: clientId,
        tenantId: tenantId || 'common'
      };

      if (typeof saveAuthSettings === 'function') {
        saveAuthSettings(newSettings);
      } else {
        localStorage.setItem('hd_auth_settings_v1', JSON.stringify(newSettings));
      }

      // Update visibility of the SSO sign-in container on the admin login screen
      const alMsContainer = document.getElementById('al-ms-sso-container');
      if (alMsContainer) {
        alMsContainer.style.display = enabled ? 'flex' : 'none';
      }

      showToast('Authentication settings saved successfully!', 'success');
    });
  }
}

function renderSettingsRolesTable() {
  const tbody = document.getElementById('roles-tbody');
  if (!tbody) return;
  const roles = loadRoles();
  tbody.innerHTML = '';
  
  const permLabels = {
    dashboard: '📊 Dashboard',
    tickets: '🎫 Tickets',
    agents: '👥 Agents',
    users: '🧑‍💼 Users',
    reports: '📈 Reports',
    'live-chats': '💬 Support',
    'audit-trail': '📋 Audit',
    settings: '⚙️ Settings',
    kb: '📚 KB',
    assets: '🖥️ Assets',
    software: '💾 Software'
  };

  roles.forEach(r => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    
    // color badge styling
    let badgeStyle = '';
    if (r.color === 'red') badgeStyle = 'background:var(--red-glow);color:var(--accent-red);';
    else if (r.color === 'blue') badgeStyle = 'background:var(--blue-glow);color:var(--accent-blue);';
    else if (r.color === 'green') badgeStyle = 'background:var(--green-glow);color:var(--accent-green);';
    else if (r.color === 'orange') badgeStyle = 'background:var(--orange-glow);color:var(--accent-orange);';
    else if (r.color === 'purple') badgeStyle = 'background:var(--purple-glow);color:var(--accent-purple);';
    else badgeStyle = 'background:var(--bg-elevated);color:var(--text-secondary);';
    
    const colorBadge = `<span class="role-pill" style="${badgeStyle}">${r.color.charAt(0).toUpperCase() + r.color.slice(1)}</span>`;
    
    const permsHtml = (r.permissions || []).length > 0
      ? (r.permissions || []).map(p => `<span class="role-pill" style="font-size:0.68rem;padding:1px 5px;margin:2px 2px 2px 0;display:inline-block;background:var(--bg-elevated);color:var(--text-primary);border:1px solid var(--border);">${permLabels[p] || p}</span>`).join('')
      : '<span style="color:var(--text-muted);font-style:italic;font-size:0.75rem;">None (Portal Only)</span>';

    tr.innerHTML = `
      <td style="padding:10px 12px; font-weight:600; color:var(--text-primary)">${r.name}</td>
      <td style="padding:10px 12px; font-family:monospace; color:var(--text-secondary)">${r.key}</td>
      <td style="padding:10px 12px;">${colorBadge}</td>
      <td style="padding:10px 12px; max-width:320px; line-height:1.4;">${permsHtml}</td>
      <td style="padding:10px 12px; text-align:right;">
        <button class="btn btn-ghost btn-sm btn-edit-role" data-key="${r.key}" style="padding:4px 8px; font-size:0.8rem; margin-right:4px;">✏ Edit</button>
        <button class="btn btn-ghost btn-sm btn-delete-role" data-key="${r.key}" style="padding:4px 8px; font-size:0.8rem; color:var(--accent-red);" ${r.isDefault ? 'disabled title="System role cannot be deleted"' : ''}>🗑 Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function applyCompanyLogo() {
  const logoData = localStorage.getItem('hd_company_logo');
  const preview = document.getElementById('company-logo-preview');
  const sidebarIcon = document.getElementById('sidebar-brand-icon');
  const loginIcon = document.getElementById('login-brand-icon');

  if (logoData) {
    const imgHtml = `<img src="${logoData}" style="max-height:100%; max-width:100%; object-fit:contain; border-radius:4px;"/>`;
    if (preview) preview.innerHTML = imgHtml;
    if (sidebarIcon) {
      sidebarIcon.innerHTML = imgHtml;
      sidebarIcon.style.background = 'none';
    }
    if (loginIcon) {
      loginIcon.innerHTML = imgHtml;
      loginIcon.style.background = 'none';
    }
  } else {
    if (preview) preview.textContent = '⚡';
    if (sidebarIcon) {
      sidebarIcon.textContent = '⚡';
      sidebarIcon.style.background = '';
    }
    if (loginIcon) {
      loginIcon.textContent = '⚡';
      loginIcon.style.background = '';
    }
  }
}

window.renderSettingsRolesTable = renderSettingsRolesTable;
window.applyCompanyLogo = applyCompanyLogo;

// Personal Profile Modal logic for Admins and Agents
function openAdminProfileModal() {
  const LS_ADMIN_AUTH = 'hd_admin_auth_v1';
  const s = sessionStorage.getItem(LS_ADMIN_AUTH) || localStorage.getItem(LS_ADMIN_AUTH);
  if (!s) return;

  try {
    const sess = JSON.parse(s);
    const email = sess.email;
    if (!email) return;

    const uList = typeof loadUsers === 'function' ? loadUsers() : [];
    let u = uList.find(x => x.email && x.email.toLowerCase() === email.toLowerCase());

    if (!u) {
      const names = (sess.name || 'Admin User').split(' ');
      const fname = names[0] || 'Admin';
      const lname = names.slice(1).join(' ') || 'User';
      u = {
        id: 'u_admin_temp_' + Date.now(),
        fname,
        lname,
        email: sess.email,
        dept: 'IT',
        role: sess.role === 'IT Manager' ? 'manager' : (sess.role === 'IT Agent' ? 'agent' : 'admin'),
        status: 'active',
        phone: '',
        location: 'HQ Floor 1',
        notes: 'System auto-provisioned profile settings',
        created: new Date().toISOString().split('T')[0],
        lastActive: new Date().toISOString().split('T')[0],
        avatar: ''
      };
      uList.push(u);
      if (typeof saveUsers === 'function') saveUsers(uList);
    }

    document.getElementById('apm-id').value = u.id;
    document.getElementById('apm-fname').value = u.fname || '';
    document.getElementById('apm-lname').value = u.lname || '';
    document.getElementById('apm-email').value = u.email || '';
    document.getElementById('apm-phone').value = u.phone || '';
    document.getElementById('apm-location').value = u.location || '';
    document.getElementById('apm-password').value = '';

    const preview = document.getElementById('apm-avatar-preview');
    const dataInput = document.getElementById('apm-avatar-data');
    const removeBtn = document.getElementById('apm-avatar-remove');

    if (preview && dataInput && removeBtn) {
      if (u.avatar) {
        preview.innerHTML = `<img src="${u.avatar}" style="width:100%; height:100%; object-fit:cover;"/>`;
        dataInput.value = u.avatar;
        removeBtn.style.display = 'inline-block';
      } else {
        const initials = ((u.fname ? u.fname[0] : '') + (u.lname ? u.lname[0] : '')).toUpperCase() || 'U';
        preview.innerHTML = initials;
        dataInput.value = '';
        removeBtn.style.display = 'none';
      }
    }

    document.getElementById('admin-profile-modal-overlay').classList.add('open');
  } catch (e) {
    console.error('Failed to open admin profile settings modal:', e);
  }
}

function saveAdminProfileForm() {
  const id = document.getElementById('apm-id').value;
  const fname = document.getElementById('apm-fname').value.trim();
  const lname = document.getElementById('apm-lname').value.trim();
  const phone = document.getElementById('apm-phone').value.trim();
  const location = document.getElementById('apm-location').value.trim();
  const password = document.getElementById('apm-password').value;
  const avatar = document.getElementById('apm-avatar-data').value;

  if (!fname || !lname) {
    showToast('❌ Please fill in all required fields.', 'error');
    return;
  }

  const uList = typeof loadUsers === 'function' ? loadUsers() : [];
  const idx = uList.findIndex(x => x.id === id);
  if (idx === -1) return;

  const u = uList[idx];
  u.fname = fname;
  u.lname = lname;
  u.phone = phone;
  u.location = location;
  u.avatar = avatar;
  if (password) {
    u.password = password;
  }

  if (typeof saveUsers === 'function') saveUsers(uList);

  const LS_ADMIN_AUTH = 'hd_admin_auth_v1';
  const s = sessionStorage.getItem(LS_ADMIN_AUTH) || localStorage.getItem(LS_ADMIN_AUTH);
  if (s) {
    try {
      const sess = JSON.parse(s);
      sess.name = `${fname} ${lname}`;
      if (sessionStorage.getItem(LS_ADMIN_AUTH)) {
        sessionStorage.setItem(LS_ADMIN_AUTH, JSON.stringify(sess));
      } else {
        localStorage.setItem(LS_ADMIN_AUTH, JSON.stringify(sess));
      }
    } catch (e){}
  }

  if (typeof applyRolePermissions === 'function') {
    applyRolePermissions();
  }

  if (typeof refreshUsersView === 'function') {
    refreshUsersView();
  }

  showToast('Your profile has been updated successfully!', 'success');
  document.getElementById('admin-profile-modal-overlay').classList.remove('open');
}

// Bind event listeners for admin personal profile modal
document.addEventListener('DOMContentLoaded', () => {
  const userCardBtn = document.getElementById('sidebar-user-card');
  if (userCardBtn) {
    userCardBtn.addEventListener('click', openAdminProfileModal);
  }

  ['admin-profile-modal-cancel', 'admin-profile-modal-close'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      document.getElementById('admin-profile-modal-overlay').classList.remove('open');
    });
  });

  document.getElementById('admin-profile-modal-save')?.addEventListener('click', saveAdminProfileForm);

  const avatarFile = document.getElementById('apm-avatar-file');
  if (avatarFile) {
    avatarFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('❌ Please upload an image file.', 'error');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target.result;
        const preview = document.getElementById('apm-avatar-preview');
        const dataInput = document.getElementById('apm-avatar-data');
        const removeBtn = document.getElementById('apm-avatar-remove');
        if (preview && dataInput && removeBtn) {
          preview.innerHTML = `<img src="${base64Data}" style="width:100%; height:100%; object-fit:cover;"/>`;
          dataInput.value = base64Data;
          removeBtn.style.display = 'inline-block';
        }
      };
      reader.readAsDataURL(file);
    });
  }

  const avatarRemove = document.getElementById('apm-avatar-remove');
  if (avatarRemove) {
    avatarRemove.addEventListener('click', () => {
      const preview = document.getElementById('apm-avatar-preview');
      const dataInput = document.getElementById('apm-avatar-data');
      const removeBtn = document.getElementById('apm-avatar-remove');
      const fname = document.getElementById('apm-fname').value.trim();
      const lname = document.getElementById('apm-lname').value.trim();
      const initials = ((fname ? fname[0] : '') + (lname ? lname[0] : '')).toUpperCase() || 'U';
      
      if (preview && dataInput && removeBtn) {
        preview.innerHTML = initials;
        dataInput.value = '';
        removeBtn.style.display = 'none';
      }
      if (avatarFile) avatarFile.value = '';
    });
  }
});

