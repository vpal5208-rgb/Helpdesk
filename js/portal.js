/* portal.js */
const LS_USER = 'hd_portal_user';
let portalUser = null;

/* ===== AUTH ===== */
function initPortal() {
  try {
    const saved = localStorage.getItem(LS_USER);
    if (saved) { 
      const parsed = JSON.parse(saved);
      const users = getPortalUsers();
      const u = users.find(x => x.email && x.email.toLowerCase() === parsed.email.toLowerCase());
      if (u && u.status === 'suspended') {
        localStorage.removeItem(LS_USER);
        portalUser = null;
        showLogin();
        const errEl = document.getElementById('login-error');
        if (errEl) errEl.textContent = 'Your account has been suspended.';
      } else {
        portalUser = parsed;
        showPortal();
      }
    }
    else showLogin();
  } catch (e) {
    console.error("Error loading portal user session:", e);
    showLogin();
  }

  const setupListener = (id, event, handler) => {
    try {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
    } catch(e) {
      console.error(`Error setting up listener for ${id}:`, e);
    }
  };

  setupListener('login-btn', 'click', doLogin);
  setupListener('login-email', 'keydown', e => e.key==='Enter' && doLogin());
  setupListener('portal-logout', 'click', () => {
    try {
      localStorage.removeItem(LS_USER); portalUser = null; showLogin();
    } catch(e) {}
  });
  setupListener('quick-track-link', 'click', e => {
    e.preventDefault(); showPortal(); switchTab('track');
  });

  // Nav tabs
  try {
    document.querySelectorAll('.pnav-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  } catch(e) {}

  // Submit ticket
  setupListener('submit-ticket-btn', 'click', submitTicket);

  // Track
  setupListener('track-btn', 'click', doTrack);
  setupListener('track-id-input', 'keydown', e => e.key==='Enter' && doTrack());

  // Filters
  setupListener('mt-filter-status', 'change', renderMyTickets);
  setupListener('mt-search', 'input', renderMyTickets);

  // Modals
  setupListener('success-close-btn', 'click', () => {
    closeModal('success-overlay'); switchTab('my-tickets');
  });
  setupListener('success-track-btn', 'click', () => {
    try {
      const idEl = document.getElementById('success-ticket-id');
      const id = idEl ? idEl.textContent : '';
      closeModal('success-overlay');
      switchTab('track');
      const trackInput = document.getElementById('track-id-input');
      if (trackInput) trackInput.value = id;
      doTrack();
    } catch(e) {}
  });
  setupListener('login-btn', 'click', doLogin);
  setupListener('login-email', 'keydown', e => e.key==='Enter' && doLogin());
  setupListener('login-password', 'keydown', e => e.key==='Enter' && doLogin());
  setupListener('portal-logout', 'click', () => {
    try {
      localStorage.removeItem(LS_USER); portalUser = null; showLogin();
    } catch(e) {}
  });
  setupListener('quick-track-link', 'click', e => {
    e.preventDefault(); showPortal(); switchTab('track');
  });

  // Toggle login and register screens
  setupListener('go-to-register-link', 'click', () => {
    document.getElementById('login-form-container').style.display = 'none';
    document.getElementById('register-form-container').style.display = 'block';
    document.getElementById('login-error').textContent = '';
    document.getElementById('reg-error').textContent = '';
  });
  setupListener('go-to-login-link', 'click', () => {
    document.getElementById('register-form-container').style.display = 'none';
    document.getElementById('login-form-container').style.display = 'block';
    document.getElementById('login-error').textContent = '';
    document.getElementById('reg-error').textContent = '';
  });

  setupListener('register-btn', 'click', doRegister);
  setupListener('reg-confirm-password', 'keydown', e => e.key==='Enter' && doRegister());

  // Forgot password listeners
  setupListener('forgot-password-link', 'click', () => {
    document.getElementById('login-form-container').style.display = 'none';
    document.getElementById('forgot-password-container').style.display = 'block';
    document.getElementById('login-error').textContent = '';
    document.getElementById('forgot-error').textContent = '';
  });
  setupListener('go-to-login-from-forgot', 'click', () => {
    document.getElementById('forgot-password-container').style.display = 'none';
    document.getElementById('login-form-container').style.display = 'block';
    document.getElementById('login-error').textContent = '';
    document.getElementById('forgot-error').textContent = '';
  });
  setupListener('forgot-btn-generate', 'click', generatePortalResetPassword);
  setupListener('forgot-submit-btn', 'click', doPortalResetPassword);
  setupListener('forgot-password-input', 'keydown', e => e.key==='Enter' && doPortalResetPassword());

  // Nav tabs
  try {
    document.querySelectorAll('.pnav-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  } catch(e) {}

  // Submit ticket
  setupListener('submit-ticket-btn', 'click', submitTicket);

  // Track
  setupListener('track-btn', 'click', doTrack);
  setupListener('track-id-input', 'keydown', e => e.key==='Enter' && doTrack());

  // Filters
  setupListener('mt-filter-status', 'change', renderMyTickets);
  setupListener('mt-search', 'input', renderMyTickets);

  // Modals
  setupListener('success-close-btn', 'click', () => {
    closeModal('success-overlay'); switchTab('my-tickets');
  });
  setupListener('success-track-btn', 'click', () => {
    try {
      const idEl = document.getElementById('success-ticket-id');
      const id = idEl ? idEl.textContent : '';
      closeModal('success-overlay');
      switchTab('track');
      const trackInput = document.getElementById('track-id-input');
      if (trackInput) trackInput.value = id;
      doTrack();
    } catch(e) {}
  });
  setupListener('escalate-cancel-btn', 'click', () => closeModal('escalate-overlay'));
  setupListener('escalate-submit-btn', 'click', doEscalate);

  // Init Chat Widget
  try { initPortalChat(); } catch(e) { console.error("initPortalChat error:", e); }

  // ── Office 365 Authentication ──
  try {
    const authSettings = typeof loadAuthSettings === 'function' ? loadAuthSettings() : { msO365Enabled: true };
    const msContainer = document.getElementById('portal-ms-sso-container');
    if (msContainer) {
      msContainer.style.display = authSettings.msO365Enabled ? 'flex' : 'none';
    }
  } catch(e) {}
}

function getPortalUsers() {
  let list = [];
  let explicitlyEmpty = false;
  try {
    const raw = localStorage.getItem('hd_users_v1');
    if (raw) {
      if (raw === '[]') explicitlyEmpty = true;
      list = JSON.parse(raw).filter(Boolean);
    }
  } catch(e) {}
  
  if (!explicitlyEmpty && (!list || !list.length)) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      list = [
        { fname:'James', lname:'Wilson', email:'j.wilson@company.com', dept:'Marketing', role:'end-user', status:'active' },
        { fname:'Emily', lname:'Davis', email:'e.davis@company.com', dept:'Engineering', role:'power-user', status:'active' },
        { fname:'Robert', lname:'Martinez', email:'r.martinez@company.com', dept:'Finance', role:'end-user', status:'active' },
        { fname:'Jennifer', lname:'Thompson', email:'j.thompson@company.com', dept:'HR', role:'manager', status:'active' },
        { fname:'Daniel', lname:'Garcia', email:'d.garcia@company.com', dept:'Sales', role:'end-user', status:'suspended' },
        { fname:'Ashley', lname:'Johnson', email:'a.johnson@company.com', dept:'Operations', role:'end-user', status:'active' },
        { fname:'Christopher', lname:'Lee', email:'c.lee@company.com', dept:'Engineering', role:'agent', status:'active' },
        { fname:'Amanda', lname:'White', email:'a.white@company.com', dept:'Design', role:'end-user', status:'pending' },
        { fname:'Kevin', lname:'Brown', email:'k.brown@company.com', dept:'Legal', role:'end-user', status:'active' },
        { fname:'Stephanie', lname:'Harris', email:'s.harris@company.com', dept:'Marketing', role:'power-user', status:'active' },
        { fname:'Michael', lname:'Chang', email:'m.chang@company.com', dept:'Engineering', role:'end-user', status:'active' },
        { fname:'Laura', lname:'Patel', email:'l.patel@company.com', dept:'Finance', role:'end-user', status:'suspended' }
      ];
    } else {
      list = [];
    }
  }
  
  let modified = false;
  list.forEach(u => {
    if (!u.password) {
      u.password = 'User@123';
      modified = true;
    }
  });
  if (modified) {
    try {
      localStorage.setItem('hd_users_v1', JSON.stringify(list));
    } catch(e) {}
  }
  return list;
}


function doLogin() {
  try {
    const emailEl = document.getElementById('login-email');
    const passEl  = document.getElementById('login-password');
    const errEl   = document.getElementById('login-error');
    if (!emailEl || !passEl || !errEl) return;

    const email = emailEl.value.trim().toLowerCase();
    const pass  = passEl.value;

    if (!email || !email.includes('@')) { errEl.textContent = 'Please enter a valid email address.'; return; }
    if (!pass) { errEl.textContent = 'Please enter your password.'; return; }
    errEl.textContent = '';

    const users = getPortalUsers();
    const u = users.find(x => x.email && x.email.toLowerCase() === email);
    if (!u) {
      errEl.textContent = 'No account found with this email.';
      return;
    }
    if (u.status === 'suspended') {
      errEl.textContent = 'Your account has been suspended.';
      return;
    }
    if (u.password !== pass) {
      errEl.textContent = 'Incorrect password.';
      return;
    }

    portalUser = { name: `${u.fname} ${u.lname || ''}`.trim(), email: u.email, dept: u.dept || 'Engineering' };
    try {
      localStorage.setItem(LS_USER, JSON.stringify(portalUser));
    } catch(err) {
      console.warn("Unable to save portal session to localStorage:", err);
    }
    showPortal();
  } catch(e) {
    console.error("Error during login execution:", e);
  }
}

function doRegister() {
  try {
    const fnameEl   = document.getElementById('reg-fname');
    const lnameEl   = document.getElementById('reg-lname');
    const emailEl   = document.getElementById('reg-email');
    const deptEl    = document.getElementById('reg-dept');
    const passEl    = document.getElementById('reg-password');
    const confirmEl = document.getElementById('reg-confirm-password');
    const errEl     = document.getElementById('reg-error');

    if (!fnameEl || !lnameEl || !emailEl || !deptEl || !passEl || !confirmEl || !errEl) return;

    const fname   = fnameEl.value.trim();
    const lname   = lnameEl.value.trim();
    const email   = emailEl.value.trim();
    const dept    = deptEl.value;
    const pass    = passEl.value;
    const confirm = confirmEl.value;

    if (!fname) { errEl.textContent = 'Please enter your first name.'; return; }
    if (!lname) { errEl.textContent = 'Please enter your last name.'; return; }
    if (!email || !email.includes('@')) { errEl.textContent = 'Please enter a valid email address.'; return; }
    if (!dept) { errEl.textContent = 'Please select your department.'; return; }
    if (!pass) { errEl.textContent = 'Please enter a password.'; return; }
    if (pass.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }
    if (pass !== confirm) { errEl.textContent = 'Passwords do not match.'; return; }
    errEl.textContent = '';

    const users = getPortalUsers();
    if (users.some(x => x.email && x.email.toLowerCase() === email.toLowerCase())) {
      errEl.textContent = 'Work email is already registered.';
      return;
    }

    const newUser = {
      id: 'u' + Date.now(),
      fname,
      lname,
      email,
      dept,
      role: 'end-user',
      status: 'active',
      password: pass,
      created: new Date().toISOString().split('T')[0],
      lastActive: new Date().toISOString().split('T')[0]
    };

    users.unshift(newUser);
    try {
      localStorage.setItem('hd_users_v1', JSON.stringify(users));
    } catch(err) {
      console.warn("Unable to save new registered user:", err);
    }

    portalUser = { name: `${fname} ${lname}`.trim(), email, dept };
    try {
      localStorage.setItem(LS_USER, JSON.stringify(portalUser));
    } catch(err) {
      console.warn("Unable to save portal session:", err);
    }

    // Reset fields
    [fnameEl, lnameEl, emailEl, passEl, confirmEl].forEach(el => el.value = '');
    deptEl.value = '';

    showPortal();
  } catch(e) {
    console.error("Error during registration execution:", e);
  }
}

function doPortalResetPassword() {
  try {
    const emailEl = document.getElementById('forgot-email');
    const passEl = document.getElementById('forgot-password-input');
    const errEl = document.getElementById('forgot-error');
    if (!emailEl || !passEl || !errEl) return;

    const email = emailEl.value.trim().toLowerCase();
    const pass = passEl.value.trim();

    if (!email || !email.includes('@')) {
      errEl.textContent = 'Please enter a valid email address.';
      return;
    }
    if (!pass) {
      errEl.textContent = 'Please enter or generate a new password.';
      return;
    }
    if (pass.length < 6) {
      errEl.textContent = 'Password must be at least 6 characters.';
      return;
    }
    errEl.textContent = '';

    const users = getPortalUsers();
    const u = users.find(x => x.email && x.email.toLowerCase() === email);
    if (!u) {
      errEl.textContent = 'No account found with this email.';
      return;
    }
    if (u.status === 'suspended') {
      errEl.textContent = 'Your account has been suspended. Please contact support.';
      return;
    }

    u.password = pass;
    localStorage.setItem('hd_users_v1', JSON.stringify(users));

    // Show mock email notification toast
    if (typeof triggerPasswordResetEmail === 'function') {
      triggerPasswordResetEmail(u, pass);
    }

    pToast('Password reset successfully! Please sign in.', 'success');

    // Pre-fill login credentials
    const loginEmail = document.getElementById('login-email');
    const loginPass = document.getElementById('login-password');
    if (loginEmail) loginEmail.value = u.email;
    if (loginPass) loginPass.value = pass;

    // Switch back to login view
    document.getElementById('forgot-password-container').style.display = 'none';
    document.getElementById('login-form-container').style.display = 'block';

    // Clear forgot password inputs
    emailEl.value = '';
    passEl.value = '';
  } catch(e) {
    console.error("Error resetting portal user password:", e);
  }
}

function generatePortalResetPassword() {
  const pass = 'Tmp@' + Math.random().toString(36).slice(-5).toUpperCase() + Math.floor(Math.random() * 99);
  const passEl = document.getElementById('forgot-password-input');
  if (passEl) passEl.value = pass;
}

function showLogin() {
  try {
    const loginScr = document.getElementById('login-screen');
    const portalScr = document.getElementById('portal-screen');
    if (loginScr) loginScr.classList.add('active');
    if (portalScr) portalScr.classList.remove('active');
    
    const loginForm = document.getElementById('login-form-container');
    const regForm = document.getElementById('register-form-container');
    if (loginForm) loginForm.style.display = 'block';
    if (regForm) regForm.style.display = 'none';
  } catch(e) {}
}

function showPortal() {
  try {
    const loginScr = document.getElementById('login-screen');
    const portalScr = document.getElementById('portal-screen');
    if (loginScr) loginScr.classList.remove('active');
    if (portalScr) portalScr.classList.add('active');

    const navCenter = document.querySelector('.portal-nav-center');
    const userBadge = document.getElementById('portal-user-badge');
    const logoutBtn = document.getElementById('portal-logout');

    if (portalUser) {
      // Logged in mode
      const initials = portalUser.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      if (userBadge) {
        userBadge.textContent = initials + ' ' + portalUser.name.split(' ')[0];
        userBadge.style.display = 'block';
      }
      if (logoutBtn) logoutBtn.textContent = 'Sign Out';
      
      // Show all navigation buttons
      if (navCenter) {
        navCenter.querySelectorAll('.pnav-btn').forEach(btn => btn.style.display = 'inline-block');
      }

      const hour = new Date().getHours();
      const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      const greeting = document.getElementById('hero-greeting');
      if (greeting) greeting.textContent = greet + ', ' + portalUser.name.split(' ')[0] + '!';
      const sub = document.getElementById('hero-sub');
      if (sub) sub.textContent = 'How can IT support you today?';
      
      try { switchTab('dashboard'); } catch(e) {}
      try { renderHeroStats(); } catch(e) {}
      try { renderRecentTickets(); } catch(e) {}
    } else {
      // Guest / Quick Track mode
      if (userBadge) userBadge.style.display = 'none';
      if (logoutBtn) logoutBtn.textContent = 'Back to Login';
      
      // Hide all navigation buttons except Track
      if (navCenter) {
        navCenter.querySelectorAll('.pnav-btn').forEach(btn => {
          if (btn.dataset.tab === 'track') {
            btn.style.display = 'inline-block';
          } else {
            btn.style.display = 'none';
          }
        });
      }
      
      try { switchTab('track'); } catch(e) {}
    }
  } catch(e) {
    console.error("Error showing portal:", e);
  }
}

/* ===== NAVIGATION ===== */
function switchTab(tab) {
  try {
    document.querySelectorAll('.pnav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.ptab').forEach(p => p.classList.toggle('active', p.id === 'ptab-' + tab));
    if (tab === 'my-tickets') renderMyTickets();
    if (tab === 'dashboard') { renderHeroStats(); renderRecentTickets(); }
  } catch(e) {
    console.error("Error switching tabs:", e);
  }
}

function setCategory(cat) {
  const sel = document.getElementById('nt-category');
  if (sel) sel.value = cat;
}

function prefillAndGo(subject, category, priority) {
  switchTab('new-ticket');
  document.getElementById('nt-subject').value = subject;
  document.getElementById('nt-category').value = category;
  document.getElementById('nt-priority').value = priority;
}

/* ===== TICKET DATA ===== */
function getMyTickets() {
  const all = loadTickets();
  if (!portalUser) return [];
  return (all || []).filter(t => t && t.email && typeof t.email === 'string' && t.email.toLowerCase() === portalUser.email.toLowerCase());
}

function getAllTickets() { return loadTickets(); }

/* ===== SUBMIT TICKET ===== */
function submitTicket() {
  const subject  = document.getElementById('nt-subject').value.trim();
  const category = document.getElementById('nt-category').value;
  const priority = document.getElementById('nt-priority').value;
  const desc     = document.getElementById('nt-desc').value.trim();
  const device   = document.getElementById('nt-device').value.trim();
  const affected = document.getElementById('nt-affected').value;

  if (!subject)  { pToast('Please enter a subject.','error'); return; }
  if (!category) { pToast('Please select a category.','error'); return; }
  if (!desc)     { pToast('Please describe the issue.','error'); return; }

  const btn = document.getElementById('submit-ticket-btn');
  btn.disabled = true; btn.textContent = 'Submitting…';

  setTimeout(() => {
    btn.disabled = false; btn.textContent = 'Submit Ticket →';
    const all = loadTickets();
    const now = new Date().toISOString();
    const id  = generateTicketId(all.length + 1);
    const fullDesc = desc + (device ? `\n\nDevice: ${device}` : '') + `\nUsers affected: ${affected}`;
    const ticket = {
      id, subject,
      requester: portalUser ? portalUser.name : 'Portal User',
      email: portalUser ? portalUser.email : '',
      category, priority,
      status: 'Open',
      agentId: '',
      description: fullDesc,
      created: now,
      comments: [],
      auditLog: [{ action:'Ticket submitted via User Portal', time:now, by: portalUser?.name||'User' }],
      portalSubmitted: true,
      escalated: false,
    };
    all.unshift(ticket);
    saveTickets(all);
    triggerEmailNotification('new_ticket', ticket);

    // Reset form
    ['nt-subject','nt-desc','nt-device'].forEach(id => document.getElementById(id).value='');
    document.getElementById('nt-category').value='';
    document.getElementById('nt-priority').value='Medium';
    document.getElementById('nt-affected').value='1';

    document.getElementById('success-ticket-id').textContent = id;
    openModal('success-overlay');
  }, 900);
}

/* ===== HERO STATS ===== */
function renderHeroStats() {
  const my = getMyTickets();
  const open = my.filter(t=>t.status==='Open').length;
  const inprog = my.filter(t=>t.status==='In Progress').length;
  const resolved = my.filter(t=>t.status==='Resolved'||t.status==='Closed').length;
  document.getElementById('hero-stats').innerHTML = `
    <div class="hero-stat"><div class="hero-stat-val">${open}</div><div class="hero-stat-lbl">Open</div></div>
    <div class="hero-stat"><div class="hero-stat-val">${inprog}</div><div class="hero-stat-lbl">In Progress</div></div>
    <div class="hero-stat"><div class="hero-stat-val">${resolved}</div><div class="hero-stat-lbl">Resolved</div></div>
  `;
}

/* ===== RECENT TICKETS ===== */
function renderRecentTickets() {
  const container = document.getElementById('recent-tickets-preview');
  const tickets = getMyTickets().slice(0,3);
  if (!tickets.length) {
    container.innerHTML = '<div class="recent-empty">No tickets yet. <a href="#" onclick="switchTab(\'new-ticket\');return false">Submit your first ticket →</a></div>';
    return;
  }
  container.innerHTML = tickets.map(t => ticketCardHTML(t, false)).join('');
  attachCardEvents(container);
}

/* ===== MY TICKETS ===== */
function renderMyTickets() {
  const status = document.getElementById('mt-filter-status').value;
  const search = document.getElementById('mt-search').value.toLowerCase();
  let tickets = getMyTickets();
  if (status) tickets = tickets.filter(t=>t.status===status);
  if (search) tickets = tickets.filter(t=>t.subject.toLowerCase().includes(search)||t.id.toLowerCase().includes(search));
  const container = document.getElementById('my-tickets-list');
  if (!tickets.length) {
    container.innerHTML = '<div class="recent-empty">No tickets found.</div>';
    return;
  }
  container.innerHTML = tickets.map(t => ticketCardHTML(t, true)).join('');
  attachCardEvents(container);
}

function ticketCardHTML(t, showTimeline) {
  const statusCls = { Open:'pbadge-open','In Progress':'pbadge-inprogress','Resolved':'pbadge-resolved','Closed':'pbadge-closed' }[t.status]||'pbadge-open';
  const priCls    = { Critical:'pbadge-critical',High:'pbadge-high',Medium:'pbadge-medium',Low:'pbadge-low' }[t.priority]||'pbadge-medium';
  const catIcons  = { Network:'📶', Hardware:'🖥', Software:'💻', Account:'👤', Security:'🔒', Other:'📋' };
  const icon = catIcons[t.category]||'📋';

  let created = 'Unknown';
  if (t && t.created) {
    const d = new Date(t.created);
    if (!isNaN(d.getTime())) {
      created = d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    }
  }

  const escalatedTag = t.escalated ? '<span class="escalated-tag">🚨 Escalated</span>' : '';
  const canEscalate  = !t.escalated && (t.status==='Open'||t.status==='In Progress');
  const canClose     = t.status==='Resolved';

  const timeline = showTimeline ? buildTimeline(t.status) : '';
  const slaBar   = buildSLABar(t);

  return `
  <div class="ticket-card" id="card-${t.id}">
    <div class="ticket-card-top">
      <div class="ticket-card-icon">${icon}</div>
      <div class="ticket-card-info">
        <div class="ticket-card-id">${t.id}</div>
        <div class="ticket-card-subject" title="${t.subject}">${t.subject}</div>
        <div class="ticket-card-meta">
          <span class="tc-meta-item">📅 ${created}</span>
          <span class="tc-meta-item">📁 ${t.category}</span>
          ${t.agentId ? `<span class="tc-meta-item">👤 ${getAgentName(t.agentId)}</span>` : '<span class="tc-meta-item" style="color:#f59e0b">⏳ Unassigned</span>'}
          ${escalatedTag}
        </div>
        ${slaBar}
      </div>
      <div class="ticket-card-right">
        <span class="pbadge ${statusCls}">${t.status}</span>
        <span class="pbadge ${priCls}">${t.priority}</span>
      </div>
    </div>
    ${showTimeline ? timeline : ''}
    <div class="ticket-card-actions">
      <button class="portal-btn portal-btn-ghost btn-sm track-detail-btn" data-id="${t.id}">🔍 View Details</button>
      ${canEscalate ? `<button class="portal-btn btn-sm escalate-btn" data-id="${t.id}" style="background:var(--red-light);color:var(--red);border:1.5px solid var(--red)">🚨 Escalate</button>` : ''}
      ${canClose ? `<button class="portal-btn portal-btn-ghost btn-sm close-ticket-btn" data-id="${t.id}">✓ Mark Closed</button>` : ''}
      ${(Array.isArray(t.comments) && t.comments.length) ? `<span class="tc-meta-item" style="margin-left:auto">💬 ${t.comments.length} comment${t.comments.length>1?'s':''}</span>` : ''}
    </div>
  </div>`;
}

function buildTimeline(status) {
  const steps = ['Open','In Progress','Resolved','Closed'];
  const idx   = steps.indexOf(status);
  const html  = steps.map((s,i) => {
    const done   = i < idx;
    const active = i === idx;
    const icons  = ['📥','🔧','✅','🔒'];
    return `<div class="timeline-step ${done?'done':active?'active':''}">
      <div class="ts-dot">${done||active?icons[i]:''}</div>
      <div class="ts-label">${s}</div>
    </div>`;
  }).join('');
  return `<div class="status-timeline"><div class="timeline-title">Progress</div><div class="timeline-steps">${html}</div></div>`;
}

function buildSLABar(t) {
  if (!t || t.status==='Resolved'||t.status==='Closed') return '';
  const slaH = { Critical:2, High:8, Medium:24, Low:72 }[t.priority]||24;
  const createdTime = t.created ? new Date(t.created).getTime() : Date.now();
  const elapsed = (Date.now() - (isNaN(createdTime) ? Date.now() : createdTime)) / 3600000;
  const pct = Math.min((elapsed/slaH)*100, 100);
  const color = pct>100?'var(--red)':pct>75?'var(--orange)':'var(--green)';
  const remaining = slaH - elapsed;
  const label = isNaN(remaining) ? 'SLA Pending' : (remaining < 0 ? '⚠ SLA Breached' : remaining < 2 ? `⚡ ${remaining.toFixed(1)}h left` : `${remaining.toFixed(0)}h remaining`);
  return `<div class="sla-timer-bar">
    <div class="sla-bar-track"><div class="sla-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    <div style="font-size:.7rem;color:${color};font-weight:600;margin-top:2px">${label}</div>
  </div>`;
}

function attachCardEvents(container) {
  container.querySelectorAll('.track-detail-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab('track');
      document.getElementById('track-id-input').value = btn.dataset.id;
      doTrack();
    });
  });
  container.querySelectorAll('.escalate-btn').forEach(btn => {
    btn.addEventListener('click', () => openEscalateModal(btn.dataset.id));
  });
  container.querySelectorAll('.close-ticket-btn').forEach(btn => {
    btn.addEventListener('click', () => closeUserTicket(btn.dataset.id));
  });
}

/* ===== TRACK ===== */
function doTrack() {
  const raw = document.getElementById('track-id-input').value.trim();
  if (!raw) return;
  const container = document.getElementById('track-result');
  const all = loadTickets();
  
  // Resilient lookup: exact match or numeric suffix match
  let t = all.find(x => x.id.toLowerCase() === raw.toLowerCase());
  if (!t) {
    const numbersOnly = raw.replace(/\D/g, '');
    if (numbersOnly) {
      t = all.find(x => {
        const match = x.id.match(/\d+$/);
        return match && parseInt(match[0]) === parseInt(numbersOnly);
      });
    }
  }
  if (!t) {
    container.innerHTML = `<div class="track-not-found"><div style="font-size:2.5rem">🔍</div><h3 style="margin:12px 0 6px">Ticket not found</h3><p style="color:var(--text-2)">No ticket found with ID <strong>${raw}</strong>. Please check the ID and try again.</p></div>`;
    return;
  }
  renderTicketDetail(t, container);
}

function renderTicketDetail(t, container) {
  const statusCls = { Open:'pbadge-open','In Progress':'pbadge-inprogress','Resolved':'pbadge-resolved','Closed':'pbadge-closed' }[t.status]||'';
  const priCls    = { Critical:'pbadge-critical',High:'pbadge-high',Medium:'pbadge-medium',Low:'pbadge-low' }[t.priority]||'';
  
  let created = 'Unknown';
  let createdTime = Date.now();
  if (t && t.created) {
    const d = new Date(t.created);
    if (!isNaN(d.getTime())) {
      created = d.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});
      createdTime = d.getTime();
    }
  }

  const agent     = getAgentById ? getAgentById(t.agentId) : null;
  const canEsc    = !t.escalated && (t.status==='Open'||t.status==='In Progress');
  const slaH      = { Critical:2, High:8, Medium:24, Low:72 }[t.priority]||24;
  const elapsed   = (Date.now() - createdTime)/3600000;
  const remaining = slaH - elapsed;
  const slaText   = (t.status==='Resolved'||t.status==='Closed') ? 'N/A' : (isNaN(remaining) ? 'Pending' : (remaining<0 ? '⚠ Breached' : remaining.toFixed(0)+'h remaining'));
  const slaColor  = remaining<0 ? 'var(--red)' : remaining<2 ? 'var(--orange)' : 'var(--green)';

  const comments = Array.isArray(t.comments) ? t.comments.filter(c => c && !c.internal) : [];
  const commentsHTML = comments.length
    ? comments.map(c=>{
        let timeStr = 'Unknown';
        if (c && c.time) {
          const d = new Date(c.time);
          if (!isNaN(d.getTime())) {
            timeStr = d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
          }
        }
        return `<div class="dc-comment"><div class="dc-author">${c.author} · ${timeStr}</div>${c.text}</div>`;
      }).join('')
    : '<p style="color:var(--text-3);font-size:.83rem">No comments yet.</p>';

  const timeline = buildTimeline(t.status);

  container.innerHTML = `
  <div class="detail-card">
    <div class="detail-card-header">
      <div class="dch-id">${t.id}</div>
      <div class="dch-subject">${t.subject}</div>
      <div class="dch-badges">
        <span class="dcw-badge">${t.status}</span>
        <span class="dcw-badge">${t.priority}</span>
        <span class="dcw-badge">📁 ${t.category}</span>
        ${t.escalated?'<span class="dcw-badge" style="background:rgba(220,38,38,.3)">🚨 Escalated</span>':''}
      </div>
    </div>
    ${timeline}
    <div class="detail-card-body">
      <div>
        <div class="detail-info-grid">
          <div class="di-row"><span class="di-label">Requester</span><span class="di-val">${t.requester}</span></div>
          <div class="di-row"><span class="di-label">Assigned To</span><span class="di-val">${agent?agent.name:'<span style="color:var(--orange)">Unassigned</span>'}</span></div>
          <div class="di-row"><span class="di-label">Created</span><span class="di-val">${created}</span></div>
          <div class="di-row"><span class="di-label">SLA</span><span class="di-val" style="color:${slaColor}">${slaText}</span></div>
          <div class="di-row"><span class="di-label">Department</span><span class="di-val">${portalUser?.dept||'—'}</span></div>
        </div>
        <div style="margin-top:16px;padding:14px;background:var(--bg);border-radius:var(--radius-sm);font-size:.85rem;line-height:1.6">
          <strong style="font-size:.78rem;color:var(--text-2)">DESCRIPTION</strong><br/>${t.description.replace(/\n/g,'<br/>')}
        </div>
        ${(t.status === 'Resolved' || t.status === 'Closed') ? `
          <div class="rating-box" style="margin-top:16px;padding:14px;background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border);font-size:.85rem;line-height:1.6">
            <strong style="font-size:.78rem;color:var(--text-2);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Agent Rating</strong>
            ${t.rating ? `
              <div style="display:flex;align-items:center;gap:6px">
                <span style="color:var(--text-2)">Your feedback:</span>
                <span class="stars" style="color:#d97706;font-size:1.15rem">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</span>
              </div>
            ` : `
              <p style="color:var(--text-2);font-size:0.8rem;margin-bottom:8px">How would you rate the support provided by <strong>${agent ? agent.name : 'IT Support Team'}</strong>?</p>
              <div class="star-rating-input" data-ticket-id="${t.id}" style="display:flex;gap:6px;font-size:1.6rem;color:var(--text-3);cursor:pointer">
                <span class="star-rating-star" data-value="1" onclick="submitAgentRating('${t.id}', 1)" onmouseover="highlightStars(this, 1)" onmouseout="resetStars(this)">★</span>
                <span class="star-rating-star" data-value="2" onclick="submitAgentRating('${t.id}', 2)" onmouseover="highlightStars(this, 2)" onmouseout="resetStars(this)">★</span>
                <span class="star-rating-star" data-value="3" onclick="submitAgentRating('${t.id}', 3)" onmouseover="highlightStars(this, 3)" onmouseout="resetStars(this)">★</span>
                <span class="star-rating-star" data-value="4" onclick="submitAgentRating('${t.id}', 4)" onmouseover="highlightStars(this, 4)" onmouseout="resetStars(this)">★</span>
                <span class="star-rating-star" data-value="5" onclick="submitAgentRating('${t.id}', 5)" onmouseover="highlightStars(this, 5)" onmouseout="resetStars(this)">★</span>
              </div>
            `}
          </div>
        ` : ''}
      </div>
      <div>
        <div style="font-size:.78rem;font-weight:700;color:var(--text-2);margin-bottom:10px">ACTIONS</div>
        ${canEsc?`<button class="portal-btn portal-btn-danger" style="width:100%;margin-bottom:8px" onclick="openEscalateModal('${t.id}')">🚨 Escalate Ticket</button>`:''}
        ${t.status==='Resolved'?`<button class="portal-btn portal-btn-ghost" style="width:100%;margin-bottom:8px" onclick="closeUserTicket('${t.id}')">✓ Confirm & Close</button>`:''}
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:12px;font-size:.78rem;color:var(--text-2)">
          <strong>Need to add info?</strong><br/>Reply to the notification email or contact IT directly.
        </div>
      </div>
    </div>
    <div class="detail-comments">
      <div class="dc-title">💬 Updates (${comments.length})</div>
      ${commentsHTML}
    </div>
  </div>`;
}

/* ===== ESCALATE ===== */
function openEscalateModal(id) {
  document.getElementById('escalate-ticket-id').value = id;
  document.getElementById('escalate-reason').value = '';
  openModal('escalate-overlay');
}

function doEscalate() {
  const id     = document.getElementById('escalate-ticket-id').value;
  const reason = document.getElementById('escalate-reason').value.trim();
  if (!reason) { pToast('Please provide a reason for escalation.','error'); return; }
  const all = loadTickets();
  const idx = all.findIndex(t=>t.id===id);
  if (idx===-1) return;
  const t = all[idx];
  const now = new Date().toISOString();
  // Bump priority
  const bump = { Low:'Medium', Medium:'High', High:'Critical', Critical:'Critical' };
  const oldPri = t.priority;
  t.priority = bump[t.priority] || t.priority;
  t.escalated = true;
  t.auditLog.push({ action:`Ticket escalated by user. Reason: ${reason}. Priority changed from ${oldPri} to ${t.priority}.`, time:now, by: portalUser?.name||'User' });
  t.comments.push({ author: portalUser?.name||'User', text:`[Escalation Request] ${reason}`, internal:false, time:now });
  saveTickets(all);
  
  // Trigger email notification for status/priority change and comments
  triggerEmailNotification('status', t);
  triggerEmailNotification('comment', t);

  closeModal('escalate-overlay');
  pToast(`Ticket ${id} escalated to ${t.priority} priority! IT manager notified.`,'success');
  // Refresh views
  renderMyTickets();
  renderRecentTickets();
  // Re-track if on track tab
  if (document.getElementById('ptab-track').classList.contains('active')) doTrack();
}

/* ===== CLOSE TICKET ===== */
function closeUserTicket(id) {
  const all = loadTickets();
  const idx = all.findIndex(t=>t.id===id);
  if (idx===-1) return;
  const now = new Date().toISOString();
  all[idx].status = 'Closed';
  all[idx].auditLog.push({ action:'Ticket closed by user — issue confirmed resolved.', time:now, by:portalUser?.name||'User' });
  saveTickets(all);

  // Trigger email notification for status change
  triggerEmailNotification('status', all[idx]);

  pToast('Ticket closed. Thank you for confirming the resolution!','success');
  renderMyTickets();
  
  // Switch to track tab and show details so they can rate the agent
  switchTab('track');
  document.getElementById('track-id-input').value = id;
  doTrack();
}

/* ===== SUBMIT AGENT RATING ===== */
function submitAgentRating(ticketId, ratingValue) {
  const all = loadTickets();
  const idx = all.findIndex(t => t.id === ticketId);
  if (idx === -1) return;
  const t = all[idx];
  t.rating = ratingValue;
  if (!t.agentId) {
    t.agentId = 'a1'; // Assign to Sarah Chen if it was unassigned, so it calculates correctly
  }
  t.auditLog.push({ action: `Agent rated ${ratingValue} stars by user.`, time: new Date().toISOString(), by: portalUser?.name || 'User' });
  saveTickets(all);
  
  pToast(`Thank you! You rated the agent ${ratingValue} star${ratingValue > 1 ? 's' : ''}.`, 'success');
  
  // Re-render ticket detail
  const container = document.getElementById('track-result');
  if (container) {
    // Re-load updated ticket to show correct agent name after auto-assigning
    const updatedAgent = getAgentById(t.agentId);
    renderTicketDetail(t, container);
  }
}

function highlightStars(el, val) {
  const container = el.closest('.star-rating-input');
  if (!container) return;
  const stars = container.querySelectorAll('.star-rating-star');
  stars.forEach(s => {
    const v = parseInt(s.getAttribute('data-value'));
    if (v <= val) {
      s.style.color = '#d97706';
    } else {
      s.style.color = 'var(--text-3)';
    }
  });
}

function resetStars(el) {
  const container = el.closest('.star-rating-input');
  if (!container) return;
  const stars = container.querySelectorAll('.star-rating-star');
  stars.forEach(s => {
    s.style.color = '';
  });
}

/* ===== MODALS ===== */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', e => {
  ['success-overlay','escalate-overlay'].forEach(id=>{
    const el=document.getElementById(id);
    if(e.target===el) closeModal(id);
  });
});

/* ===== TOASTS ===== */
function pToast(msg,type='info') {
  const c = document.getElementById('portal-toasts');
  const t = document.createElement('div');
  const icons = {success:'✅',error:'❌',info:'ℹ️'};
  t.className=`portal-toast ${type}`;
  t.innerHTML=`<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(()=>{ t.style.animation='slideInRight .3s ease reverse'; setTimeout(()=>t.remove(),300); },3500);
}

/* ===== PORTAL LIVE CHAT & REMOTE SUPPORT ===== */
let chatbotTimer = null;

function initPortalChat() {
  const btn = document.getElementById('chat-widget-btn');
  const container = document.getElementById('chat-widget-container');
  const closeBtn = document.getElementById('chat-close-btn');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const disconnectBtn = document.getElementById('remote-disconnect-btn');

  if (!btn || !container) return;

  btn.addEventListener('click', () => {
    container.classList.toggle('open');
    if (container.classList.contains('open')) {
      input.focus();
      const messagesDiv = document.getElementById('chat-messages');
      if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  });

  closeBtn.addEventListener('click', () => {
    container.classList.remove('open');
  });

  sendBtn.addEventListener('click', handleUserSend);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleUserSend();
  });

  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
      disconnectRemoteSession();
    });
  }

  // Listen to storage events to keep in sync
  window.addEventListener('storage', e => {
    if (e.key === 'hd_chat_session') {
      syncPortalChatState();
    }
  });

  // Initial sync
  syncPortalChatState();
}

function getChatSession() {
  try {
    const raw = localStorage.getItem('hd_chat_session');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}

function saveChatSession(session) {
  try {
    localStorage.setItem('hd_chat_session', JSON.stringify(session));
  } catch(e) {
    console.warn("localStorage saveChatSession failed:", e);
  }
}

function syncPortalChatState() {
  const session = getChatSession();
  const overlay = document.getElementById('remote-session-overlay');
  
  if (!session) return;

  if (session.status === 'ended') {
    if (overlay) overlay.classList.remove('active');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    if (input) { input.disabled = true; input.placeholder = "Chat has ended."; }
    if (sendBtn) sendBtn.disabled = true;
    renderPortalChatMessages();
    return;
  }

  // Handle active inputs
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');
  if (input) { input.disabled = false; input.placeholder = "Type a message..."; }
  if (sendBtn) sendBtn.disabled = false;

  // Handle Agent Metadata
  const agentNameEl = document.getElementById('chat-agent-name');
  const agentAvatarEl = document.getElementById('chat-agent-avatar');
  const statusTextEl = document.getElementById('chat-agent-status-text');

  if (session.agentJoined && session.agentName) {
    if (agentNameEl) agentNameEl.textContent = session.agentName;
    if (agentAvatarEl) agentAvatarEl.textContent = session.agentName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    if (statusTextEl) statusTextEl.textContent = "Support Specialist";
  }

  // Handle remote session overlay
  if (session.remoteControlState === 'active') {
    if (overlay && !overlay.classList.contains('active')) {
      overlay.classList.add('active');
      
      const logEl = document.getElementById('remote-terminal-log');
      if (logEl) {
        logEl.textContent = `Connecting to Remote Support Server...\nEstablished encrypted channel.\nAgent (${session.agentName}) has assumed control.\n\n$ `;
      }
    }
    
    const logEl = document.getElementById('remote-terminal-log');
    if (logEl && session.terminalLog && logEl.textContent !== session.terminalLog) {
      logEl.textContent = session.terminalLog;
      logEl.scrollTop = logEl.scrollHeight;
    }
  } else {
    if (overlay) overlay.classList.remove('active');
  }

  renderPortalChatMessages();
}

function handleUserSend() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  let session = getChatSession();
  const now = new Date().toISOString();

  if (!session || session.status === 'ended') {
    const uName = portalUser ? portalUser.name : 'Guest User';
    const uEmail = portalUser ? portalUser.email : 'guest@company.com';
    const uDept = portalUser ? portalUser.dept : 'Visitor';
    
    const onlineAgents = AGENTS.filter(a => a.status !== 'offline');
    const assignedAgent = onlineAgents.length > 0 ? onlineAgents[Math.floor(Math.random() * onlineAgents.length)] : { name: 'Sarah Chen' };

    session = {
      id: 'chat_' + Date.now(),
      userName: uName,
      userEmail: uEmail,
      userDept: uDept,
      agentId: assignedAgent.id || 'a1',
      agentName: assignedAgent.name || 'Sarah Chen',
      agentJoined: false,
      status: 'active',
      remoteControlState: 'none',
      messages: [],
      terminalLog: ''
    };
  }

  session.messages.push({
    sender: 'user',
    text: text,
    time: now
  });

  saveChatSession(session);
  renderPortalChatMessages();

  // Smart Chatbot Trigger
  if (!session.agentJoined) {
    if (chatbotTimer) clearTimeout(chatbotTimer);
    chatbotTimer = setTimeout(() => {
      chatbotAutoReply(text);
    }, 2000);
  }
}

function renderPortalChatMessages() {
  const messagesDiv = document.getElementById('chat-messages');
  if (!messagesDiv) return;

  const session = getChatSession();
  if (!session) return;

  messagesDiv.innerHTML = '';
  
  session.messages.forEach(msg => {
    const timeStr = new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (msg.type === 'remote_request') {
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble agent';
      bubble.innerHTML = `
        <div class="remote-request-box">
          <div class="remote-request-title">🖥️ Remote Connection Requested</div>
          <div style="font-size:0.75rem;margin-bottom:6px">The agent is requesting remote control access to your computer to resolve this issue.</div>
          ${session.remoteControlState === 'requested' ? `
            <div class="remote-btn-group">
              <button class="remote-btn confirm" onclick="grantRemoteAccess()">Grant Access</button>
              <button class="remote-btn deny" onclick="denyRemoteAccess()">Deny</button>
            </div>
          ` : `
            <div style="font-style:italic;font-size:0.75rem;color:var(--text-secondary)">
              ${session.remoteControlState === 'active' ? 'Connection established.' : 'Request rejected.'}
            </div>
          `}
        </div>
        <div class="msg-time">${timeStr}</div>
      `;
      messagesDiv.appendChild(bubble);
    } else {
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble ' + msg.sender;
      bubble.innerHTML = `
        <div>${msg.text}</div>
        <div class="msg-time">${timeStr}</div>
      `;
      messagesDiv.appendChild(bubble);
    }
  });

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

window.grantRemoteAccess = function() {
  const session = getChatSession();
  if (!session) return;
  
  session.remoteControlState = 'active';
  session.messages.push({
    sender: 'agent',
    text: 'Remote control session started.',
    time: new Date().toISOString()
  });
  
  saveChatSession(session);
  syncPortalChatState();
};

window.denyRemoteAccess = function() {
  const session = getChatSession();
  if (!session) return;
  
  session.remoteControlState = 'rejected';
  session.messages.push({
    sender: 'user',
    text: 'Remote access request declined.',
    time: new Date().toISOString()
  });
  
  saveChatSession(session);
  syncPortalChatState();
};

function disconnectRemoteSession() {
  const session = getChatSession();
  if (!session) return;
  
  session.remoteControlState = 'none';
  session.messages.push({
    sender: 'user',
    text: 'Remote session disconnected by user.',
    time: new Date().toISOString()
  });
  
  saveChatSession(session);
  syncPortalChatState();
}

function chatbotAutoReply(userText) {
  const session = getChatSession();
  if (!session || session.status !== 'active' || session.agentJoined) return;

  const lowText = userText.toLowerCase();
  let reply = "Thanks for reporting. Let me look into that for you. Can you describe what troubleshooting steps you have already tried?";

  if (lowText.includes('vpn')) {
    reply = `I can help with VPN drops. Could you try checking if you are on corporate Wi-Fi or home network? Try disconnecting, restarting your network device, and reconnecting. Let me know if that works.`;
  } else if (lowText.includes('password') || lowText.includes('reset') || lowText.includes('login')) {
    reply = `To reset your credentials, please go to the Accounts tab or write down your work email. Alternatively, I can request remote access to help you trigger the password reset flow.`;
  } else if (lowText.includes('slow') || lowText.includes('internet') || lowText.includes('lag')) {
    reply = `Let's run a quick diagnosis. Try closing background browser tabs and check your network adapter connection. If the issue remains, I can take remote control to analyze the system processes.`;
  } else if (lowText.includes('printer')) {
    reply = `For printer connection issues, make sure you are on the company VPN or network and verify if the printer shows 'Offline'. I can check the driver status for you.`;
  }

  session.messages.push({
    sender: 'agent',
    text: reply,
    time: new Date().toISOString()
  });

  saveChatSession(session);
  renderPortalChatMessages();
}

// Expose functions to global window scope for inline HTML onclick attributes
window.switchTab = switchTab;
window.setCategory = setCategory;
window.prefillAndGo = prefillAndGo;
window.openEscalateModal = openEscalateModal;
window.closeUserTicket = closeUserTicket;

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', initPortal);
