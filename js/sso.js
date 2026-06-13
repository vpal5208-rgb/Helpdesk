/* =========================================================================
   sso.js — Office 365 Single Sign-On (SSO) Logic (MSAL + Mock Microsoft Flow)
   ========================================================================= */

const LS_AUTH_SETTINGS = 'hd_auth_settings_v1';
const DEFAULT_AUTH_SETTINGS = {
  msO365Enabled: true,
  clientId: '',
  tenantId: 'common'
};

// Migration: Force enable Microsoft SSO on first load of this update
try {
  if (!localStorage.getItem('hd_auth_migrated_v3')) {
    const s = localStorage.getItem(LS_AUTH_SETTINGS);
    let settings = { ...DEFAULT_AUTH_SETTINGS };
    if (s) {
      try {
        const parsed = JSON.parse(s);
        settings = { ...settings, ...parsed };
      } catch (e) {}
    }
    settings.msO365Enabled = true;
    localStorage.setItem(LS_AUTH_SETTINGS, JSON.stringify(settings));
    localStorage.setItem('hd_auth_migrated_v3', 'true');
  }
} catch (e) {}

// Helper: load external script dynamically
function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load script: ' + url));
    document.head.appendChild(script);
  });
}

// Helper: load O365 settings from localStorage
function loadAuthSettings() {
  try {
    const s = localStorage.getItem(LS_AUTH_SETTINGS);
    if (s) {
      const parsed = JSON.parse(s);
      return { ...DEFAULT_AUTH_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load auth settings', e);
  }
  return { ...DEFAULT_AUTH_SETTINGS };
}

// Trigger O365 login
function initSSOLogin(targetPortal) {
  const settings = loadAuthSettings();
  if (!settings.msO365Enabled) {
    if (typeof showToast === 'function') {
      showToast('Office 365 Single Sign-On is not enabled in Settings.', 'error');
    } else {
      alert('Office 365 Single Sign-On is not enabled in Settings.');
    }
    return;
  }

  if (settings.clientId && settings.clientId.trim() !== '') {
    // Real O365 login via MSAL.js
    initMSALAndLogin(settings.clientId.trim(), settings.tenantId.trim(), targetPortal);
  } else {
    // High-fidelity Microsoft Sign-In Simulation
    showSimulatedMSLogin(targetPortal);
  }
}

// Real MSAL.js integration
async function initMSALAndLogin(clientId, tenantId, targetPortal) {
  try {
    if (typeof showToast === 'function') showToast('Connecting to Microsoft Azure AD...', 'info');
    await loadScript('https://alcdn.msauth.net/browser/2.37.1/js/msal-browser.min.js');

    const redirectUri = window.location.origin + window.location.pathname;
    const msalConfig = {
      auth: {
        clientId: clientId,
        authority: `https://login.microsoftonline.com/${tenantId || 'common'}`,
        redirectUri: redirectUri
      },
      cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false
      }
    };

    const msalInstance = new msal.PublicClientApplication(msalConfig);
    const loginRequest = {
      scopes: ['User.Read']
    };

    const loginResponse = await msalInstance.loginPopup(loginRequest);
    if (loginResponse && loginResponse.account) {
      const email = loginResponse.account.username;
      const name = loginResponse.account.name || email.split('@')[0];
      handleO365Success(email, name, targetPortal);
    }
  } catch (err) {
    console.error('MSAL Login Error:', err);
    if (typeof showToast === 'function') {
      showToast('Microsoft Login Failed: ' + err.message, 'error');
    } else {
      alert('Microsoft Login Failed: ' + err.message);
    }
  }
}

// High-fidelity Microsoft Portal mockup modal
function showSimulatedMSLogin(targetPortal) {
  // Inject mock Microsoft CSS styles
  if (!document.getElementById('ms-login-styles')) {
    const style = document.createElement('style');
    style.id = 'ms-login-styles';
    style.textContent = `
      .ms-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: #eaeaea; z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Segoe UI', -apple-system, sans-serif;
        color: #1b1b1b;
      }
      .ms-card {
        background: #ffffff; width: 440px; min-height: 360px;
        padding: 44px; box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        border: 1px solid #d2d2d2; display: flex; flex-direction: column;
        justify-content: space-between; position: relative;
      }
      .ms-logo-row { display: flex; align-items: center; gap: 4px; margin-bottom: 20px; }
      .ms-logo { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; width: 18px; height: 18px; }
      .ms-logo div { width: 8px; height: 8px; }
      .ms-back-arrow {
        position: absolute; top: 20px; left: 20px; cursor: pointer;
        font-size: 1.1rem; color: #505050; transition: color 0.15s;
        display: none;
      }
      .ms-back-arrow:hover { color: #1b1b1b; }
      .ms-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 12px; }
      .ms-subtitle { font-size: 0.9rem; color: #1b1b1b; margin-bottom: 16px; }
      .ms-input-container { margin-bottom: 18px; }
      .ms-input {
        width: 100%; border: 1px solid #606060; border-radius: 0;
        padding: 6px 10px; font-size: 0.95rem; outline: none;
        transition: border-color 0.15s;
      }
      .ms-input:focus { border-color: #0067b8; }
      .ms-input.error { border-color: #e81123; }
      .ms-error-text { color: #e81123; font-size: 0.8rem; margin-top: 4px; display: none; }
      .ms-links { font-size: 0.82rem; display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
      .ms-link { color: #0067b8; text-decoration: none; cursor: pointer; }
      .ms-link:hover { text-decoration: underline; }
      .ms-btn-row { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; }
      .ms-btn {
        background: #0067b8; color: #ffffff; border: none;
        padding: 6px 32px; font-size: 0.95rem; cursor: pointer;
        min-width: 108px; text-align: center;
      }
      .ms-btn:hover { background: #005da6; }
      .ms-btn-sec {
        background: #cccccc; color: #1b1b1b; border: none;
        padding: 6px 32px; font-size: 0.95rem; cursor: pointer;
        min-width: 108px; text-align: center;
      }
      .ms-btn-sec:hover { background: #c0c0c0; }
      .ms-loader-row { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 16px; }
      .ms-dots { display: flex; gap: 5px; }
      .ms-dots div {
        width: 6px; height: 6px; background: #0067b8; border-radius: 50%;
        animation: msBounce 1s infinite alternate;
      }
      .ms-dots div:nth-child(2) { animation-delay: 0.2s; }
      .ms-dots div:nth-child(3) { animation-delay: 0.4s; }
      @keyframes msBounce {
        from { transform: translateY(0); opacity: 0.3; }
        to { transform: translateY(-8px); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  // Create overlay markup
  const overlay = document.createElement('div');
  overlay.className = 'ms-overlay';
  overlay.id = 'ms-login-overlay';
  overlay.innerHTML = `
    <div class="ms-card">
      <div class="ms-back-arrow" id="ms-back-btn">←</div>
      <div>
        <div class="ms-logo-row">
          <div class="ms-logo">
            <div style="background:#f25022"></div>
            <div style="background:#7fba00"></div>
            <div style="background:#00a4ef"></div>
            <div style="background:#ffb900"></div>
          </div>
          <span style="font-size:0.95rem;font-weight:600;color:#737373">Microsoft</span>
        </div>

        <!-- STEP 1: EMAIL -->
        <div id="ms-step-email">
          <div class="ms-title">Sign in</div>
          <div class="ms-subtitle">to continue to HelpDeskPro</div>
          <div class="ms-input-container">
            <input type="text" id="ms-email-input" class="ms-input" placeholder="Email, phone, or Skype"/>
            <div class="ms-error-text" id="ms-email-error">Enter a valid email address.</div>
          </div>
          <div class="ms-links">
            <span class="ms-link">No account? Create one!</span>
            <span class="ms-link">Can't access your account?</span>
          </div>
          <div class="ms-btn-row">
            <button class="ms-btn" id="ms-btn-email-next">Next</button>
          </div>
        </div>

        <!-- STEP 2: PASSWORD -->
        <div id="ms-step-password" style="display:none">
          <div id="ms-display-email" style="font-size:0.88rem;margin-bottom:8px;display:flex;align-items:center;gap:4px"></div>
          <div class="ms-title">Enter password</div>
          <div class="ms-input-container">
            <input type="password" id="ms-password-input" class="ms-input" placeholder="Password"/>
            <div class="ms-error-text" id="ms-password-error">Please enter the password for your Microsoft account.</div>
          </div>
          <div class="ms-links">
            <span class="ms-link">Forgot password?</span>
            <span class="ms-link">Other ways to sign in</span>
          </div>
          <div class="ms-btn-row">
            <button class="ms-btn" id="ms-btn-pass-signin">Sign in</button>
          </div>
        </div>

        <!-- STEP 3: STAY SIGNED IN -->
        <div id="ms-step-stay" style="display:none">
          <div class="ms-title">Stay signed in?</div>
          <div class="ms-subtitle" style="margin-bottom:24px;">Do this to reduce the number of times you are asked to sign in.</div>
          <label style="display:flex;align-items:center;gap:8px;font-size:0.88rem;margin-bottom:24px;cursor:pointer">
            <input type="checkbox" style="width:auto;margin:0"/> Don't show this again
          </label>
          <div class="ms-btn-row">
            <button class="ms-btn-sec" id="ms-btn-stay-no">No</button>
            <button class="ms-btn" id="ms-btn-stay-yes">Yes</button>
          </div>
        </div>

        <!-- STEP 4: LOADER -->
        <div id="ms-step-loading" style="display:none;height:180px;">
          <div class="ms-loader-row">
            <div class="ms-dots">
              <div></div>
              <div></div>
              <div></div>
            </div>
            <div style="font-size:0.95rem;color:#505050" id="ms-loading-text">Signing you in...</div>
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:#505050;margin-top:20px;">
        <span class="ms-link" style="color:#505050">Terms of use</span>
        <span class="ms-link" style="color:#505050">Privacy & cookies</span>
        <span>...</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Focus input
  const emailInput = document.getElementById('ms-email-input');
  if (emailInput) emailInput.focus();

  // Step variables
  let enteredEmail = '';

  // DOM Elements
  const stepEmail = document.getElementById('ms-step-email');
  const stepPassword = document.getElementById('ms-step-password');
  const stepStay = document.getElementById('ms-step-stay');
  const stepLoading = document.getElementById('ms-step-loading');
  const backBtn = document.getElementById('ms-back-btn');

  const showStep = (step) => {
    stepEmail.style.display = step === 1 ? 'block' : 'none';
    stepPassword.style.display = step === 2 ? 'block' : 'none';
    stepStay.style.display = step === 3 ? 'block' : 'none';
    stepLoading.style.display = step === 4 ? 'block' : 'none';
    backBtn.style.display = (step === 2 || step === 3) ? 'block' : 'none';
  };

  // Next click (Email validation)
  document.getElementById('ms-btn-email-next').addEventListener('click', () => {
    const emailVal = emailInput.value.trim();
    const errorEl = document.getElementById('ms-email-error');
    if (!emailVal || !emailVal.includes('@')) {
      emailInput.classList.add('error');
      errorEl.style.display = 'block';
      return;
    }
    emailInput.classList.remove('error');
    errorEl.style.display = 'none';

    enteredEmail = emailVal;
    document.getElementById('ms-display-email').innerHTML = `<span>👤</span> <strong>${enteredEmail}</strong>`;
    showStep(2);
    const passInput = document.getElementById('ms-password-input');
    if (passInput) {
      passInput.value = '';
      passInput.focus();
    }
  });

  // Enter keys
  emailInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('ms-btn-email-next').click();
  });
  document.getElementById('ms-password-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('ms-btn-pass-signin').click();
  });

  // Back click
  backBtn.addEventListener('click', () => {
    const passError = document.getElementById('ms-password-error');
    const passInput = document.getElementById('ms-password-input');
    if (passInput) passInput.classList.remove('error');
    if (passError) passError.style.display = 'none';
    showStep(1);
    emailInput.focus();
  });

  // Password sign in click
  document.getElementById('ms-btn-pass-signin').addEventListener('click', () => {
    const passInput = document.getElementById('ms-password-input');
    const passVal = passInput.value;
    const errorEl = document.getElementById('ms-password-error');
    if (!passVal) {
      passInput.classList.add('error');
      errorEl.style.display = 'block';
      return;
    }
    passInput.classList.remove('error');
    errorEl.style.display = 'none';

    showStep(3);
  });

  // Stay signed in buttons
  const completeLogin = () => {
    showStep(4);
    setTimeout(() => {
      // Clean up modal overlay
      overlay.remove();
      // Call success handler
      const displayName = enteredEmail.split('@')[0].split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      handleO365Success(enteredEmail, displayName, targetPortal);
    }, 1500);
  };

  document.getElementById('ms-btn-stay-no').addEventListener('click', completeLogin);
  document.getElementById('ms-btn-stay-yes').addEventListener('click', completeLogin);
}

// SSO Authentication Success Handler
function handleO365Success(email, name, targetPortal) {
  const cleanEmail = email.trim().toLowerCase();

  // Helper functions: fallback if modules not fully loaded
  const getUsersList = () => {
    if (typeof loadUsers === 'function') return loadUsers();
    try {
      return JSON.parse(localStorage.getItem('hd_users_v1') || '[]').filter(Boolean);
    } catch (e) {
      return [];
    }
  };

  const saveUsersList = (list) => {
    if (typeof saveUsers === 'function') {
      saveUsers(list);
      return;
    }
    localStorage.setItem('hd_users_v1', JSON.stringify(list));
  };

  if (targetPortal === 'admin') {
    // ------------------------------------------
    // ADMIN PORTAL AUTHENTICATION
    // ------------------------------------------
    const roles = typeof loadRoles === 'function' ? loadRoles() : [];
    const users = getUsersList();

    // 1. Try to find existing database user or demo accounts
    const ADMIN_ACCOUNTS_DEMO = [
      { email:'admin@helpdesk.com',   name:'Admin User',   role:'Administrator' },
      { email:'manager@helpdesk.com', name:'IT Manager',   role:'IT Manager' },
      { email:'agent@helpdesk.com',   name:'Support Agent',role:'IT Agent' },
    ];

    let match = ADMIN_ACCOUNTS_DEMO.find(a => a.email.toLowerCase() === cleanEmail);
    if (!match) {
      const dbMatch = users.find(u => u.email.toLowerCase() === cleanEmail);
      if (dbMatch) {
        match = { name: dbMatch.fname + ' ' + dbMatch.lname, email: dbMatch.email, role: dbMatch.role };
      }
    }

    // 2. Fallback: Auto-provision a new administrator user if not found (Facilitates easy demo testing)
    if (!match) {
      const newAdmin = {
        id: 'u' + Date.now(),
        fname: name.split(' ')[0] || 'Office365',
        lname: name.split(' ')[1] || 'Admin',
        email: cleanEmail,
        dept: 'IT Administration',
        role: 'admin', // Key for Administrator role
        status: 'active',
        phone: '',
        location: 'HQ',
        notes: 'SSO auto-provisioned administrator',
        created: new Date().toISOString().split('T')[0],
        lastActive: new Date().toISOString().split('T')[0],
        password: 'User@123'
      };
      
      const list = getUsersList();
      list.push(newAdmin);
      saveUsersList(list);

      match = { name: newAdmin.fname + ' ' + newAdmin.lname, email: newAdmin.email, role: 'Administrator' };
      if (typeof showToast === 'function') {
        showToast('Created new Administrator account for O365 user.', 'info');
      }
    }

    // 3. Resolve role permissions
    const normalizedRole = match.role === 'IT Manager' ? 'manager' : (match.role === 'IT Agent' ? 'agent' : (match.role === 'Administrator' ? 'admin' : match.role));
    const roleObj = roles.find(r => r.key === normalizedRole) || { permissions: [] };

    if (!roleObj || !roleObj.permissions || roleObj.permissions.length === 0) {
      if (typeof showToast === 'function') {
        showToast('Access Denied: Your account role does not have admin panel access.', 'error');
      } else {
        alert('Access Denied: Your account role does not have admin panel access.');
      }
      return;
    }

    // 4. Save session
    const session = { name: match.name, email: match.email, role: match.role, ts: Date.now() };
    const LS_ADMIN_AUTH = 'hd_admin_auth_v1';
    sessionStorage.setItem(LS_ADMIN_AUTH, JSON.stringify(session));
    localStorage.setItem(LS_ADMIN_AUTH, JSON.stringify(session));

    // 5. Hide login screen & Sync UI
    const loginScreen = document.getElementById('admin-login-screen');
    if (loginScreen) loginScreen.style.display = 'none';
    document.body.style.overflow = '';

    // Update sidebar card
    const nameEl = document.querySelector('.user-name');
    const roleEl = document.querySelector('.user-role');
    const avatarEl = document.querySelector('.user-avatar');
    if (nameEl) nameEl.textContent = match.name;
    if (roleEl) roleEl.textContent = roleObj.name || match.role;
    if (avatarEl) avatarEl.textContent = match.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

    // Apply permissions and navigate
    if (typeof applyRolePermissions === 'function') applyRolePermissions();
    if (roleObj.permissions && roleObj.permissions.length > 0) {
      const firstPerm = roleObj.permissions[0];
      if (typeof navigateTo === 'function') navigateTo(firstPerm);
    }

    if (typeof showToast === 'function') {
      showToast(`Welcome back, ${match.name}! (Signed in via O365)`, 'success');
    }

  } else if (targetPortal === 'portal') {
    // ------------------------------------------
    // SELF-SERVICE USER PORTAL AUTHENTICATION
    // ------------------------------------------
    const users = getUsersList();

    // 1. Try to find user in users list
    let u = users.find(x => x.email && x.email.toLowerCase() === cleanEmail);

    // 2. Fallback: Auto-provision a new end-user portal profile
    if (!u) {
      u = {
        id: 'u' + Date.now(),
        fname: name.split(' ')[0] || 'Office365',
        lname: name.split(' ')[1] || 'User',
        email: cleanEmail,
        dept: 'Engineering',
        role: 'end-user',
        status: 'active',
        phone: '',
        location: 'Remote',
        notes: 'SSO auto-provisioned portal user',
        created: new Date().toISOString().split('T')[0],
        lastActive: new Date().toISOString().split('T')[0],
        password: 'User@123'
      };

      const list = getUsersList();
      list.push(u);
      saveUsersList(list);
    }

    if (u.status === 'suspended') {
      const errEl = document.getElementById('login-error');
      if (errEl) errEl.textContent = 'Your account has been suspended.';
      return;
    }

    // 3. Save portal session
    const portalUser = { name: `${u.fname} ${u.lname || ''}`.trim(), email: u.email, dept: u.dept || 'Engineering' };
    localStorage.setItem('hd_portal_user', JSON.stringify(portalUser));

    // 4. Trigger portal view rendering
    if (typeof showPortal === 'function') {
      showPortal();
    } else {
      // Reload page to bootstrap portal session if needed
      window.location.reload();
    }
  }
}

// Expose functions to window
window.initSSOLogin = initSSOLogin;
window.handleO365Success = handleO365Success;
