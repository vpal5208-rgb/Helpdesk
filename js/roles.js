/* roles.js — Custom User Roles logic */

const LS_ROLES = 'hd_roles_v1';

const DEFAULT_ROLES = [
  { key: 'end-user', name: 'End User', color: 'gray', desc: 'Standard portal user, can view and create their own tickets.', isDefault: true, permissions: [] },
  { key: 'power-user', name: 'Power User', color: 'gray', desc: 'Advanced portal user with elevated access within their department.', isDefault: true, permissions: ['dashboard'] },
  { key: 'agent', name: 'IT Agent', color: 'blue', desc: 'IT support agent, can be assigned tickets, update status, and chat with users.', isDefault: true, permissions: ['dashboard', 'tickets', 'live-chats', 'kb', 'assets'] },
  { key: 'manager', name: 'IT Manager', color: 'purple', desc: 'IT team manager, can assign tickets, manage settings, and view reports.', isDefault: true, permissions: ['dashboard', 'tickets', 'agents', 'users', 'reports', 'live-chats', 'audit-trail', 'settings', 'kb', 'assets'] },
  { key: 'admin', name: 'Administrator', color: 'red', desc: 'Full system administrator access, including role management and advanced settings.', isDefault: true, permissions: ['dashboard', 'tickets', 'agents', 'users', 'reports', 'live-chats', 'audit-trail', 'settings', 'kb', 'assets'] }
];

function loadRoles() {
  try {
    const data = localStorage.getItem(LS_ROLES);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Migration: ensure every role has correct system permissions
        let migrated = false;
        const list = parsed.map(r => {
          if (!r.permissions) {
            const defMatch = DEFAULT_ROLES.find(x => x.key === r.key);
            r.permissions = defMatch ? [...defMatch.permissions] : ['dashboard'];
            migrated = true;
          }
          // Ensure default manager role has settings, kb, assets and agents permission
          if (r.key === 'manager') {
            if (!r.permissions.includes('settings')) { r.permissions.push('settings'); migrated = true; }
            if (!r.permissions.includes('kb')) { r.permissions.push('kb'); migrated = true; }
            if (!r.permissions.includes('assets')) { r.permissions.push('assets'); migrated = true; }
            if (!r.permissions.includes('agents')) { r.permissions.push('agents'); migrated = true; }
          }
          // Ensure default admin role has settings, kb, assets and agents permission
          if (r.key === 'admin') {
            if (!r.permissions.includes('settings')) { r.permissions.push('settings'); migrated = true; }
            if (!r.permissions.includes('kb')) { r.permissions.push('kb'); migrated = true; }
            if (!r.permissions.includes('assets')) { r.permissions.push('assets'); migrated = true; }
            if (!r.permissions.includes('agents')) { r.permissions.push('agents'); migrated = true; }
          }
          // Ensure default agent role has kb and assets permission
          if (r.key === 'agent') {
            if (!r.permissions.includes('kb')) { r.permissions.push('kb'); migrated = true; }
            if (!r.permissions.includes('assets')) { r.permissions.push('assets'); migrated = true; }
          }
          return r;
        });
        if (migrated) saveRoles(list);
        return list;
      }
    }
  } catch (e) {
    console.error('Failed to parse roles from localStorage', e);
  }
  // Initialize with default system roles if empty
  saveRoles(DEFAULT_ROLES);
  return [...DEFAULT_ROLES];
}

function saveRoles(list) {
  try {
    localStorage.setItem(LS_ROLES, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save roles to localStorage', e);
  }
}

function addRole(name, color, desc, permissions = []) {
  const list = loadRoles();
  const cleanName = name.trim();
  if (!cleanName) return { success: false, error: 'Role name cannot be empty.' };

  const key = cleanName.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  if (!key) return { success: false, error: 'Invalid role name.' };

  if (list.some(r => r.key === key)) {
    return { success: false, error: `A role with the key "${key}" already exists.` };
  }

  const newRole = {
    key,
    name: cleanName,
    color,
    desc: desc.trim(),
    permissions: Array.isArray(permissions) ? permissions : [],
    isDefault: false
  };

  list.push(newRole);
  saveRoles(list);
  return { success: true, role: newRole };
}

function updateRole(key, name, color, desc, permissions = []) {
  const list = loadRoles();
  const idx = list.findIndex(r => r.key === key);
  if (idx === -1) return { success: false, error: 'Role not found.' };

  const roleObj = list[idx];
  const cleanName = name.trim();
  if (!cleanName) return { success: false, error: 'Role name cannot be empty.' };

  const perms = Array.isArray(permissions) ? permissions : [];

  if (roleObj.isDefault) {
    roleObj.color = color;
    roleObj.desc = desc.trim();
    roleObj.permissions = perms;
  } else {
    roleObj.name = cleanName;
    roleObj.color = color;
    roleObj.desc = desc.trim();
    roleObj.permissions = perms;
  }

  saveRoles(list);
  return { success: true, role: roleObj };
}

function deleteRole(key) {
  const list = loadRoles();
  const idx = list.findIndex(r => r.key === key);
  if (idx === -1) return { success: false, error: 'Role not found.' };

  if (list[idx].isDefault) {
    return { success: false, error: 'Cannot delete default system roles.' };
  }

  list.splice(idx, 1);
  saveRoles(list);
  return { success: true };
}

function getCurrentUserRole() {
  const LS_ADMIN_AUTH = 'hd_admin_auth_v1';
  const s = sessionStorage.getItem(LS_ADMIN_AUTH) || localStorage.getItem(LS_ADMIN_AUTH);
  if (!s) return 'end-user';
  try {
    const sess = JSON.parse(s);
    const role = sess.role;
    if (!role) return 'end-user';
    
    const lowRole = role.toLowerCase();
    if (lowRole === 'administrator' || lowRole === 'admin') return 'admin';
    if (lowRole === 'it manager' || lowRole === 'manager') return 'manager';
    if (lowRole === 'it agent' || lowRole === 'agent') return 'agent';
    
    // Check if there is a custom role in localStorage that matches name or key case-insensitively
    const roles = typeof loadRoles === 'function' ? loadRoles() : [];
    const matched = roles.find(r => r.key.toLowerCase() === lowRole || r.name.toLowerCase() === lowRole);
    if (matched) return matched.key;

    return lowRole;
  } catch (e) {
    return 'end-user';
  }
}

function applyRolePermissions() {
  const roles = loadRoles();
  const userRole = getCurrentUserRole();
  const roleObj = roles.find(r => r.key === userRole) || { permissions: [] };

  // Sync sidebar user card display with session details
  const LS_ADMIN_AUTH = 'hd_admin_auth_v1';
  const s = sessionStorage.getItem(LS_ADMIN_AUTH) || localStorage.getItem(LS_ADMIN_AUTH);
  if (s) {
    try {
      const sess = JSON.parse(s);
      const nameEl = document.querySelector('.user-name');
      const roleEl = document.querySelector('.user-role');
      const avatarEl = document.querySelector('.user-avatar');
      if (nameEl && sess.name) nameEl.textContent = sess.name;
      
      const displayRole = roleObj.name || sess.role;
      if (roleEl && displayRole) roleEl.textContent = displayRole;
      if (avatarEl && sess.name) avatarEl.textContent = sess.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    } catch (e) {
      console.error('Failed to parse admin session for sidebar sync', e);
    }
  }

  const allViews = ['dashboard', 'tickets', 'agents', 'users', 'reports', 'live-chats', 'audit-trail', 'settings', 'kb', 'assets'];

  allViews.forEach(view => {
    const navBtn = document.querySelector(`.sidebar-nav .nav-item[data-view="${view}"]`);
    if (navBtn) {
      if (roleObj.permissions && roleObj.permissions.includes(view)) {
        navBtn.style.display = 'flex';
      } else {
        navBtn.style.display = 'none';
      }
    }
  });
}

// Bind helpers to window
window.loadRoles = loadRoles;
window.saveRoles = saveRoles;
window.addRole = addRole;
window.updateRole = updateRole;
window.deleteRole = deleteRole;
window.getCurrentUserRole = getCurrentUserRole;
window.applyRolePermissions = applyRolePermissions;
