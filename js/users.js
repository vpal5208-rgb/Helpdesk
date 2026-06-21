/* users.js — User Management logic */

const LS_USERS = 'hd_users_v1';
const USER_COLORS = ['#58a6ff','#3fb950','#bc8cff','#d29922','#f85149','#26d4b0','#ff7b72','#79c0ff'];
const DEPTS = ['Engineering','Marketing','Finance','HR','Sales','Operations','Design','Legal'];

const SEED_USERS = [
  { id:'u1', fname:'James', lname:'Wilson', email:'j.wilson@company.com', dept:'Marketing', role:'end-user', status:'active', phone:'+1 555-0101', location:'HQ Floor 2', notes:'', created:'2025-01-10', lastActive:'2026-05-17', password:'User@123' },
  { id:'u2', fname:'Emily', lname:'Davis', email:'e.davis@company.com', dept:'Engineering', role:'power-user', status:'active', phone:'+1 555-0102', location:'HQ Floor 3', notes:'Senior dev, needs extended access', created:'2024-11-05', lastActive:'2026-05-16', password:'User@123' },
  { id:'u3', fname:'Robert', lname:'Martinez', email:'r.martinez@company.com', dept:'Finance', role:'end-user', status:'active', phone:'+1 555-0103', location:'Branch Office', notes:'', created:'2025-03-22', lastActive:'2026-05-10', password:'User@123' },
  { id:'u4', fname:'Jennifer', lname:'Thompson', email:'j.thompson@company.com', dept:'HR', role:'manager', status:'active', phone:'+1 555-0104', location:'HQ Floor 1', notes:'HR Manager', created:'2024-06-15', lastActive:'2026-05-17', password:'User@123' },
  { id:'u5', fname:'Daniel', lname:'Garcia', email:'d.garcia@company.com', dept:'Sales', role:'end-user', status:'suspended', phone:'+1 555-0105', location:'Remote', notes:'Account suspended pending investigation', created:'2025-02-01', lastActive:'2026-04-20', password:'User@123' },
  { id:'u6', fname:'Ashley', lname:'Johnson', email:'a.johnson@company.com', dept:'Operations', role:'end-user', status:'active', phone:'+1 555-0106', location:'HQ Floor 2', notes:'', created:'2025-07-19', lastActive:'2026-05-15', password:'User@123' },
  { id:'u7', fname:'Christopher', lname:'Lee', email:'c.lee@company.com', dept:'Engineering', role:'agent', status:'active', phone:'+1 555-0107', location:'HQ Floor 3', notes:'IT Agent', created:'2024-09-30', lastActive:'2026-05-17', password:'User@123' },
  { id:'u8', fname:'Amanda', lname:'White', email:'a.white@company.com', dept:'Design', role:'end-user', status:'pending', phone:'+1 555-0108', location:'HQ Floor 4', notes:'New hire, waiting for system access', created:'2026-05-14', lastActive:'Never', password:'User@123' },
  { id:'u9', fname:'Kevin', lname:'Brown', email:'k.brown@company.com', dept:'Legal', role:'end-user', status:'active', phone:'+1 555-0109', location:'HQ Floor 1', notes:'', created:'2025-05-11', lastActive:'2026-05-12', password:'User@123' },
  { id:'u10', fname:'Stephanie', lname:'Harris', email:'s.harris@company.com', dept:'Marketing', role:'power-user', status:'active', phone:'+1 555-0110', location:'Remote', notes:'Marketing lead', created:'2024-12-01', lastActive:'2026-05-17', password:'User@123' },
  { id:'u11', fname:'Michael', lname:'Chang', email:'m.chang@company.com', dept:'Engineering', role:'end-user', status:'active', phone:'+1 555-0111', location:'HQ Floor 3', notes:'', created:'2025-08-25', lastActive:'2026-05-14', password:'User@123' },
  { id:'u12', fname:'Laura', lname:'Patel', email:'l.patel@company.com', dept:'Finance', role:'end-user', status:'suspended', phone:'+1 555-0112', location:'Branch Office', notes:'Suspended: maternity leave', created:'2025-01-30', lastActive:'2026-02-10', password:'User@123' },
];

let allUsersData = [];
let filteredUsers = [];
let usersPage = 1;
const USERS_PAGE_SIZE = 10;
let pendingImportUsers = [];

/* ===== STORAGE ===== */
function loadUsers() {
  try { 
    const r = localStorage.getItem(LS_USERS); 
    if (r) {
      const parsed = JSON.parse(r);
      if (Array.isArray(parsed)) {
        let modified = false;
        const list = parsed.filter(Boolean).map(u => {
          if (!u.password) {
            u.password = 'User@123';
            modified = true;
          }
          return u;
        });
        if (modified) saveUsers(list);
        return list;
      }
    }
  } catch(e){}
  
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal) {
    saveUsers(SEED_USERS);
    return [...SEED_USERS];
  }
  saveUsers([]);
  return [];
}
function saveUsers(list) { localStorage.setItem(LS_USERS, JSON.stringify(list)); }

function userColor(u) { return USER_COLORS[(u.fname.charCodeAt(0) + u.lname.charCodeAt(0)) % USER_COLORS.length]; }
function userInitials(u) { return (u.fname[0] + u.lname[0]).toUpperCase(); }
function userFullName(u) { return u.fname + ' ' + u.lname; }
function userTicketCount(email) { return (loadTickets()||[]).filter(t=>t.email&&t.email.toLowerCase()===email.toLowerCase()).length; }

function lastActiveLabel(d) {
  if (!d || d==='Never') return { label:'Never', cls:'dot-inactive' };
  const days = Math.floor((Date.now()-new Date(d).getTime())/86400000);
  if (days === 0) return { label:'Today', cls:'dot-recently' };
  if (days === 1) return { label:'Yesterday', cls:'dot-recently' };
  if (days <= 7)  return { label:days+'d ago', cls:'dot-aweek' };
  return { label:new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'}), cls:'dot-inactive' };
}

/* ===== STATS ===== */
function renderUserStats() {
  const el = document.getElementById('users-stats-row');
  if (!el) return;
  const active    = allUsersData.filter(u=>u.status==='active').length;
  const suspended = allUsersData.filter(u=>u.status==='suspended').length;
  const pending   = allUsersData.filter(u=>u.status==='pending').length;
  const total     = allUsersData.length;
  el.innerHTML = `
    <div class="ustat-card ustat-blue" onclick="filterUsersByStatus('')"><div class="ustat-icon">👥</div><div><div class="ustat-val">${total}</div><div class="ustat-label">Total Users</div></div></div>
    <div class="ustat-card ustat-green" onclick="filterUsersByStatus('active')"><div class="ustat-icon">✅</div><div><div class="ustat-val">${active}</div><div class="ustat-label">Active</div></div></div>
    <div class="ustat-card ustat-red" onclick="filterUsersByStatus('suspended')"><div class="ustat-icon">⏸</div><div><div class="ustat-val">${suspended}</div><div class="ustat-label">Suspended</div></div></div>
    <div class="ustat-card ustat-orange" onclick="filterUsersByStatus('pending')"><div class="ustat-icon">⏳</div><div><div class="ustat-val">${pending}</div><div class="ustat-label">Pending</div></div></div>`;
  const badge = document.getElementById('users-count');
  if (badge) badge.textContent = total;
}

/* ===== FILTER & RENDER TABLE ===== */
function filterUsersByStatus(status) {
  const searchEl = document.getElementById('users-search');
  const deptEl = document.getElementById('users-filter-dept');
  const statusEl = document.getElementById('users-filter-status');
  
  if (searchEl) searchEl.value = '';
  if (deptEl) deptEl.value = '';
  if (statusEl) {
    statusEl.value = status;
  }
  applyUsersFilters();
}
window.filterUsersByStatus = filterUsersByStatus;

function applyUsersFilters() {
  const search = (document.getElementById('users-search')?.value||'').toLowerCase();
  const status = document.getElementById('users-filter-status')?.value||'';
  const dept   = document.getElementById('users-filter-dept')?.value||'';
  filteredUsers = allUsersData.filter(u => {
    if (status && u.status !== status) return false;
    if (dept   && u.dept   !== dept)   return false;
    if (search) {
      const hay = (userFullName(u)+' '+u.email+' '+u.dept).toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
  usersPage = 1;
  renderUsersTable();
}

function renderUsersTable() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  const total = filteredUsers.length;
  const start = (usersPage-1)*USERS_PAGE_SIZE;
  const end   = Math.min(start+USERS_PAGE_SIZE, total);
  const page  = filteredUsers.slice(start, end);

  const label = document.getElementById('users-count-label');
  if (label) label.textContent = `Showing ${start+1}–${end} of ${total} users`;

  tbody.innerHTML = '';
  page.forEach(u => {
    const color   = userColor(u);
    const initials= userInitials(u);
    const stCls   = { active:'badge-active', suspended:'badge-suspended', pending:'badge-pending' }[u.status]||'';
    const roles = loadRoles();
    const roleObj = roles.find(r => r.key === u.role) || { key: u.role, name: u.role, color: 'gray' };
    const roleLabel = roleObj.name;
    let badgeStyle = '';
    if (roleObj.color === 'red') badgeStyle = 'background:var(--red-glow);color:var(--accent-red);';
    else if (roleObj.color === 'blue') badgeStyle = 'background:var(--blue-glow);color:var(--accent-blue);';
    else if (roleObj.color === 'green') badgeStyle = 'background:var(--green-glow);color:var(--accent-green);';
    else if (roleObj.color === 'orange') badgeStyle = 'background:var(--orange-glow);color:var(--accent-orange);';
    else if (roleObj.color === 'purple') badgeStyle = 'background:var(--purple-glow);color:var(--accent-purple);';
    else badgeStyle = 'background:var(--bg-elevated);color:var(--text-secondary);';
    const tickets = userTicketCount(u.email);
    const la      = lastActiveLabel(u.lastActive);
    const tr = document.createElement('tr');
    tr.dataset.uid = u.id;
    tr.innerHTML = `
      <td><input type="checkbox" class="user-check" data-uid="${u.id}"/></td>
      <td><div class="user-avatar-cell">
        <div class="user-avatar-sm" style="background:${color}; overflow:hidden; display:flex; align-items:center; justify-content:center;">
          ${u.avatar ? `<img src="${u.avatar}" style="width:100%; height:100%; object-fit:cover;"/>` : initials}
        </div>
        <div><div class="user-full-name">${userFullName(u)}</div><div class="user-location">${u.location||'—'}</div></div>
      </div></td>
      <td>${u.email}</td>
      <td>${u.dept}</td>
      <td><span class="role-pill" style="${badgeStyle}">${roleLabel}</span></td>
      <td><span class="badge ${stCls}">${u.status.charAt(0).toUpperCase()+u.status.slice(1)}</span></td>
      <td><span style="font-weight:600">${tickets}</span></td>
      <td><span class="activity-dot ${la.cls}"></span>${la.label}</td>
      <td>
        <div class="table-actions-cell">
          <button class="action-btn" data-action="edit"   data-uid="${u.id}" title="Edit">✏</button>
          <button class="action-btn" data-action="reset"  data-uid="${u.id}" title="Reset password">🔑</button>
          <button class="action-btn" data-action="${u.status==='suspended'?'activate':'suspend'}" data-uid="${u.id}" title="${u.status==='suspended'?'Activate':'Suspend'}">
            ${u.status==='suspended'?'▶':'⏸'}
          </button>
          <button class="action-btn" data-action="delete" data-uid="${u.id}" title="Delete" style="color:var(--accent-red)">🗑</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });

  renderUsersPagination(total);
  syncBulkBtn();
}

function renderUsersPagination(total) {
  const pages = Math.ceil(total/USERS_PAGE_SIZE);
  const cont  = document.getElementById('users-pagination');
  if (!cont) return;
  cont.innerHTML = '';
  for (let i=1; i<=pages; i++) {
    const b = document.createElement('button');
    b.className = 'page-btn' + (i===usersPage?' active':'');
    b.textContent = i;
    b.addEventListener('click', () => { usersPage=i; renderUsersTable(); });
    cont.appendChild(b);
  }
}

/* ===== BULK SELECTION ===== */
function getSelectedIds() {
  return [...document.querySelectorAll('.user-check:checked')].map(cb=>cb.dataset.uid);
}
function syncBulkBtn() {
  const btn = document.getElementById('bulk-action-btn');
  if (!btn) return;
  const sel = getSelectedIds();
  btn.disabled = sel.length === 0;
  btn.textContent = sel.length > 0 ? `Bulk Action (${sel.length}) ▾` : 'Bulk Action ▾';
}

/* ===== INDIVIDUAL ACTIONS ===== */
function editUser(id) {
  const u = allUsersData.find(x=>x.id===id);
  if (!u) return;
  populateRoleDropdown();
  document.getElementById('user-modal-title').textContent = 'Edit User';
  document.getElementById('um-id').value = u.id;
  document.getElementById('um-fname').value = u.fname;
  document.getElementById('um-lname').value = u.lname;
  document.getElementById('um-email').value = u.email;
  document.getElementById('um-phone').value = u.phone||'';
  document.getElementById('um-dept').value  = u.dept;
  document.getElementById('um-role').value  = u.role;
  document.getElementById('um-status').value= u.status;
  document.getElementById('um-location').value = u.location||'';
  document.getElementById('um-notes').value = u.notes||'';
  document.getElementById('um-send-invite').checked = false;
  document.getElementById('user-modal-save').textContent = 'Update User';
  document.getElementById('user-modal-overlay').classList.add('open');
}

let resetUserIds = [];

function resetPassword(ids) {
  console.log("resetPassword called with ids:", ids, "allUsersData count:", allUsersData.length);
  resetUserIds = ids;
  const users = resetUserIds.map(id => allUsersData.find(x => x.id === id)).filter(Boolean);
  console.log("resetPassword matched users:", users.length);
  if (users.length === 0) return;

  // Set the affected users list text
  const namesEl = document.getElementById('reset-users-names');
  if (namesEl) {
    namesEl.innerHTML = users.map(u => `${userFullName(u)} (${u.email})`).join('<br/>');
  }

  // Clear input
  const inputEl = document.getElementById('reset-password-input');
  if (inputEl) inputEl.value = '';

  // Show form view, hide results view
  const formView = document.getElementById('reset-form-view');
  if (formView) formView.style.display = 'block';
  const resultsView = document.getElementById('reset-results-view');
  if (resultsView) resultsView.style.display = 'none';

  // Toggle footer buttons
  const cancelBtn = document.getElementById('reset-modal-cancel');
  const submitBtn = document.getElementById('reset-modal-submit');
  const okBtn = document.getElementById('reset-modal-ok');
  if (cancelBtn) cancelBtn.style.display = 'inline-block';
  if (submitBtn) submitBtn.style.display = 'inline-block';
  if (okBtn) okBtn.style.display = 'none';

  // Open overlay
  document.getElementById('reset-modal-overlay').classList.add('open');
}

function generateRandomResetPassword() {
  const pass = 'Tmp@' + Math.random().toString(36).slice(-5).toUpperCase() + Math.floor(Math.random() * 99);
  const inputEl = document.getElementById('reset-password-input');
  if (inputEl) inputEl.value = pass;
}
window.generateRandomResetPassword = generateRandomResetPassword;

function saveResetPassword() {
  const inputEl = document.getElementById('reset-password-input');
  if (!inputEl) return;
  const password = inputEl.value.trim();
  if (!password) {
    showToast('Please type a password or click Auto-Generate.', 'error');
    return;
  }

  if (password.length < 6) {
    showToast('Password must be at least 6 characters.', 'error');
    return;
  }

  const sendEmail = document.getElementById('reset-send-email')?.checked;
  const results = [];

  resetUserIds.forEach(id => {
    const u = allUsersData.find(x => x.id === id);
    if (u) {
      u.password = password;
      results.push({ name: userFullName(u), email: u.email, pass: password, emailSent: sendEmail });
      
      // Add in-app notification
      addNotification(`Password reset for ${userFullName(u)} (${u.email})`);
      
      // Trigger mock email if checked
      if (sendEmail) {
        triggerPasswordResetEmail(u, password);
      }
    }
  });

  saveUsers(allUsersData);

  // Render results view
  const resultsList = document.getElementById('reset-results-list');
  if (resultsList) {
    resultsList.innerHTML = results.map(r => `
      <div class="reset-result-item" style="margin-bottom:8px">
        <div class="reset-result-user">
          <div class="reset-result-name">${r.name}</div>
          <div class="reset-result-email">${r.email} &nbsp;·&nbsp; <span style="color:${r.emailSent ? '#3fb950' : '#8b949e'}">${r.emailSent ? '📧 Notification Sent' : '📧 Notification Disabled'}</span></div>
        </div>
        <span class="reset-temp-pass" title="Click to copy" onclick="copyPass(this,'${r.pass}')">${r.pass}</span>
        <span class="reset-copied" id="copied-${r.email.replace('@','_').replace('.','_')}" style="display:none">Copied!</span>
      </div>`).join('');
  }

  // Switch views
  const formView = document.getElementById('reset-form-view');
  if (formView) formView.style.display = 'none';
  const resultsView = document.getElementById('reset-results-view');
  if (resultsView) resultsView.style.display = 'block';

  // Toggle footer buttons
  const cancelBtn = document.getElementById('reset-modal-cancel');
  const submitBtn = document.getElementById('reset-modal-submit');
  const okBtn = document.getElementById('reset-modal-ok');
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (submitBtn) submitBtn.style.display = 'none';
  if (okBtn) okBtn.style.display = 'inline-block';

  showToast(`Successfully reset password for ${results.length} user(s).`, 'success');
  refreshUsersView();
}
window.saveResetPassword = saveResetPassword;

window.copyPass = function(el, pass) {
  navigator.clipboard.writeText(pass).then(() => {
    const key = el.nextElementSibling;
    if (key) { key.style.display='inline'; setTimeout(()=>key.style.display='none',2000); }
  });
};

function suspendUser(id) {
  const u = allUsersData.find(x=>x.id===id);
  if (!u) return;
  u.status = 'suspended';
  saveUsers(allUsersData);
  showToast(`${userFullName(u)} suspended.`, 'info');
  refreshUsersView();
}
function activateUser(id) {
  const u = allUsersData.find(x=>x.id===id);
  if (!u) return;
  u.status = 'active';
  saveUsers(allUsersData);
  showToast(`${userFullName(u)} activated.`, 'success');
  refreshUsersView();
}
function deleteUser(id) {
  const u = allUsersData.find(x=>x.id===id);
  if (!u || !confirm(`Delete ${userFullName(u)}? This cannot be undone.`)) return;
  allUsersData = allUsersData.filter(x=>x.id!==id);
  saveUsers(allUsersData);
  showToast(`${userFullName(u)} deleted.`, 'info');
  refreshUsersView();
}

/* ===== BULK ACTIONS ===== */
function doBulkAction(action) {
  const ids = getSelectedIds();
  if (!ids.length) return;
  if (action === 'delete' && !confirm(`Delete ${ids.length} user(s)? This cannot be undone.`)) return;
  ids.forEach(id => {
    if (action === 'suspend')   { const u=allUsersData.find(x=>x.id===id); if(u) u.status='suspended'; }
    else if (action === 'activate') { const u=allUsersData.find(x=>x.id===id); if(u) u.status='active'; }
    else if (action === 'delete')   { allUsersData=allUsersData.filter(x=>x.id!==id); }
  });
  if (action === 'reset') { saveUsers(allUsersData); resetPassword(ids); return; }
  saveUsers(allUsersData);
  const msgs = { suspend:`${ids.length} user(s) suspended.`, activate:`${ids.length} user(s) activated.`, delete:`${ids.length} user(s) deleted.` };
  showToast(msgs[action]||'Done.', 'info');
  document.getElementById('bulk-dropdown').classList.remove('open');
  refreshUsersView();
}

/* ===== SAVE USER FORM ===== */
function saveUserForm() {
  const fname = document.getElementById('um-fname').value.trim();
  const lname = document.getElementById('um-lname').value.trim();
  const email = document.getElementById('um-email').value.trim();
  const dept  = document.getElementById('um-dept').value;
  if (!fname||!lname||!email||!dept) { showToast('Fill in all required fields.','error'); return; }
  const id = document.getElementById('um-id').value;
  const data = {
    fname, lname, email, dept,
    phone:    document.getElementById('um-phone').value.trim(),
    role:     document.getElementById('um-role').value,
    status:   document.getElementById('um-status').value,
    location: document.getElementById('um-location').value.trim(),
    notes:    document.getElementById('um-notes').value.trim(),
    lastActive: new Date().toISOString().split('T')[0],
  };
  if (id) {
    const idx = allUsersData.findIndex(x=>x.id===id);
    if (idx!==-1) Object.assign(allUsersData[idx], data);
    showToast('User updated successfully!','success');
  } else {
    data.id      = 'u' + Date.now();
    data.created = new Date().toISOString().split('T')[0];
    allUsersData.unshift(data);
    showToast('User created successfully!','success');
    addNotification(`New user ${fname} ${lname} (${email}) created`);
  }
  saveUsers(allUsersData);
  document.getElementById('user-modal-overlay').classList.remove('open');
  refreshUsersView();
}

/* ===== CSV IMPORT ===== */
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h=>h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c=>c.trim().replace(/^"|"$/g,''));
    const obj = {};
    header.forEach((h,i) => obj[h] = cols[i]||'');
    return {
      id: 'u' + Date.now() + Math.random().toString(36).slice(-4),
      fname: obj.first_name||obj.fname||obj.name||'',
      lname: obj.last_name||obj.lname||'',
      email: obj.email||'',
      dept:  obj.department||obj.dept||'',
      role:  obj.role||'end-user',
      status:'pending',
      phone:'', location:'', notes:'',
      created: new Date().toISOString().split('T')[0],
      lastActive:'Never',
    };
  }).filter(u=>u.fname&&u.email);
}

function showImportPreview(users) {
  pendingImportUsers = users;
  document.getElementById('import-preview-count').textContent = `${users.length} user(s) ready to import`;
  document.getElementById('import-preview-table').innerHTML = `<table>
    <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th></tr></thead>
    <tbody>${users.slice(0,20).map(u=>`<tr><td>${u.fname} ${u.lname}</td><td>${u.email}</td><td>${u.dept||'—'}</td><td>${u.role}</td></tr>`).join('')}
    ${users.length>20?`<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">…and ${users.length-20} more</td></tr>`:''}</tbody>
  </table>`;
  document.getElementById('import-preview').style.display='block';
  document.getElementById('import-confirm-btn').disabled = false;
}

function doImport() {
  if (!pendingImportUsers.length) return;
  allUsersData = [...pendingImportUsers, ...allUsersData];
  saveUsers(allUsersData);
  document.getElementById('import-modal-overlay').classList.remove('open');
  showToast(`${pendingImportUsers.length} user(s) imported successfully!`,'success');
  addNotification(`${pendingImportUsers.length} users bulk-imported via CSV`);
  pendingImportUsers = [];
  refreshUsersView();
}

/* ===== EXPORT ===== */
function exportUsersCSV() {
  const headers = ['ID','First Name','Last Name','Email','Department','Role','Status','Phone','Location','Created','Last Active'];
  const rows = filteredUsers.map(u=>[u.id,u.fname,u.lname,u.email,u.dept,u.role,u.status,u.phone||'',u.location||'',u.created||'',u.lastActive||'']);
  const csv = [headers.join(','),...rows.map(r=>r.join(','))].join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='users.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('Users exported!','success');
}

/* ===== REFRESH ===== */
function refreshUsersView() {
  allUsersData = loadUsers();
  renderUserStats();
  applyUsersFilters();
}

/* ===== INIT ===== */
function initUsersView() {
  allUsersData = loadUsers();
  renderUserStats();
  applyUsersFilters();

  // Search & filter events
  document.getElementById('users-search').addEventListener('input', applyUsersFilters);
  document.getElementById('users-filter-status').addEventListener('change', applyUsersFilters);
  document.getElementById('users-filter-dept').addEventListener('change', applyUsersFilters);

  // Select-all checkbox
  document.getElementById('users-select-all').addEventListener('change', e => {
    document.querySelectorAll('.user-check').forEach(cb=>cb.checked=e.target.checked);
    syncBulkBtn();
  });
  document.getElementById('users-tbody').addEventListener('change', e => {
    if(e.target.classList.contains('user-check')) syncBulkBtn();
  });

  document.getElementById('users-tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    console.log("users-tbody click target:", btn ? btn.outerHTML : "no data-action match");
    if (!btn) return;
    const { action, uid } = btn.dataset;
    if (action==='edit')     editUser(uid);
    if (action==='reset')    resetPassword([uid]);
    if (action==='suspend')  suspendUser(uid);
    if (action==='activate') activateUser(uid);
    if (action==='delete')   deleteUser(uid);
  });

  // Add user button
  document.getElementById('add-user-btn').addEventListener('click', () => {
    populateRoleDropdown();
    document.getElementById('user-modal-title').textContent = 'Add User';
    document.getElementById('um-id').value='';
    ['um-fname','um-lname','um-email','um-phone','um-location','um-notes'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('um-dept').value='';
    document.getElementById('um-role').value='end-user';
    document.getElementById('um-status').value='active';
    document.getElementById('um-send-invite').checked=true;
    document.getElementById('user-modal-save').textContent='Create User';
    document.getElementById('user-modal-overlay').classList.add('open');
  });

  // User modal save/cancel/close
  document.getElementById('user-modal-save').addEventListener('click', saveUserForm);
  document.getElementById('user-modal-cancel').addEventListener('click', ()=>document.getElementById('user-modal-overlay').classList.remove('open'));
  document.getElementById('user-modal-close').addEventListener('click',  ()=>document.getElementById('user-modal-overlay').classList.remove('open'));
  document.getElementById('user-modal-overlay').addEventListener('click', e=>{if(e.target===e.currentTarget) e.currentTarget.classList.remove('open');});

  // Bulk action button
  document.getElementById('bulk-action-btn').addEventListener('click', () => {
    document.getElementById('bulk-dropdown').classList.toggle('open');
  });
  document.querySelectorAll('.bulk-opt').forEach(btn => {
    btn.addEventListener('click', () => doBulkAction(btn.dataset.action));
  });
  document.addEventListener('click', e => {
    const dd = document.getElementById('bulk-dropdown');
    if (dd && !dd.closest('.users-actions')?.contains(e.target)) dd.classList.remove('open');
  });

  // Export
  document.getElementById('export-users-btn').addEventListener('click', exportUsersCSV);

  // Import modal
  document.getElementById('import-users-btn').addEventListener('click', () => {
    pendingImportUsers=[];
    document.getElementById('import-preview').style.display='none';
    document.getElementById('import-paste').value='';
    document.getElementById('import-confirm-btn').disabled=true;
    document.getElementById('import-modal-overlay').classList.add('open');
  });
  document.getElementById('import-modal-close').addEventListener('click', ()=>document.getElementById('import-modal-overlay').classList.remove('open'));
  document.getElementById('import-cancel-btn').addEventListener('click', ()=>document.getElementById('import-modal-overlay').classList.remove('open'));
  document.getElementById('import-modal-overlay').addEventListener('click', e=>{if(e.target===e.currentTarget) e.currentTarget.classList.remove('open');});
  document.getElementById('import-browse-btn').addEventListener('click', ()=>document.getElementById('import-file-input').click());
  document.getElementById('import-file-input').addEventListener('change', e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>showImportPreview(parseCSV(ev.target.result));
    reader.readAsText(file);
  });
  // Drag & drop on drop zone
  const dz=document.getElementById('import-drop-zone');
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag-over')});
  dz.addEventListener('dragleave',()=>dz.classList.remove('drag-over'));
  dz.addEventListener('drop',e=>{
    e.preventDefault(); dz.classList.remove('drag-over');
    const file=e.dataTransfer.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>showImportPreview(parseCSV(ev.target.result));
    reader.readAsText(file);
  });
  document.getElementById('parse-paste-btn').addEventListener('click', ()=>{
    const text=document.getElementById('import-paste').value.trim();
    if(!text){showToast('Paste CSV data first.','error');return;}
    showImportPreview(parseCSV(text));
  });
  document.getElementById('import-clear-btn').addEventListener('click', ()=>{
    pendingImportUsers=[]; document.getElementById('import-preview').style.display='none';
    document.getElementById('import-confirm-btn').disabled=true;
  });
  document.getElementById('import-confirm-btn').addEventListener('click', doImport);

  // Password reset modal close
  document.getElementById('reset-modal-close').addEventListener('click', ()=>document.getElementById('reset-modal-overlay').classList.remove('open'));
  document.getElementById('reset-modal-ok').addEventListener('click',    ()=>document.getElementById('reset-modal-overlay').classList.remove('open'));
  document.getElementById('reset-modal-cancel').addEventListener('click',()=>document.getElementById('reset-modal-overlay').classList.remove('open'));
  document.getElementById('reset-modal-submit').addEventListener('click', saveResetPassword);
  document.getElementById('reset-btn-generate').addEventListener('click', generateRandomResetPassword);
  document.getElementById('reset-modal-overlay').addEventListener('click', e=>{if(e.target===e.currentTarget) e.currentTarget.classList.remove('open');});
}

function populateRoleDropdown() {
  const select = document.getElementById('um-role');
  if (!select) return;
  const roles = loadRoles();
  select.innerHTML = roles.map(r => `<option value="${r.key}">${r.name}</option>`).join('');
}
window.populateRoleDropdown = populateRoleDropdown;
window.loadUsers = loadUsers;
window.saveUsers = saveUsers;
