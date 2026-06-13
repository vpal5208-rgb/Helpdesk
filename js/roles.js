/* roles.js — Custom User Roles logic */

const LS_ROLES = 'hd_roles_v1';

const DEFAULT_ROLES = [
  { key: 'end-user', name: 'End User', color: 'gray', desc: 'Standard portal user, can view and create their own tickets.', isDefault: true },
  { key: 'power-user', name: 'Power User', color: 'gray', desc: 'Advanced portal user with elevated access within their department.', isDefault: true },
  { key: 'agent', name: 'IT Agent', color: 'blue', desc: 'IT support agent, can be assigned tickets, update status, and chat with users.', isDefault: true },
  { key: 'manager', name: 'IT Manager', color: 'purple', desc: 'IT team manager, can assign tickets, manage settings, and view reports.', isDefault: true },
  { key: 'admin', name: 'Administrator', color: 'red', desc: 'Full system administrator access, including role management and advanced settings.', isDefault: true }
];

function loadRoles() {
  try {
    const data = localStorage.getItem(LS_ROLES);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
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

function addRole(name, color, desc) {
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
    isDefault: false
  };

  list.push(newRole);
  saveRoles(list);
  return { success: true, role: newRole };
}

function updateRole(key, name, color, desc) {
  const list = loadRoles();
  const idx = list.findIndex(r => r.key === key);
  if (idx === -1) return { success: false, error: 'Role not found.' };

  const roleObj = list[idx];
  const cleanName = name.trim();
  if (!cleanName) return { success: false, error: 'Role name cannot be empty.' };

  // For default roles, we do not rename key, and keep name standard if desired (or allow customization of color and description only)
  if (roleObj.isDefault) {
    roleObj.color = color;
    roleObj.desc = desc.trim();
  } else {
    roleObj.name = cleanName;
    roleObj.color = color;
    roleObj.desc = desc.trim();
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

// Bind helpers to window
window.loadRoles = loadRoles;
window.saveRoles = saveRoles;
window.addRole = addRole;
window.updateRole = updateRole;
window.deleteRole = deleteRole;
