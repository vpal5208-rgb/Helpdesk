/* =============================================
   app.js — Main entry point & view routing
============================================= */

document.addEventListener('DOMContentLoaded', () => {
  // Init data
  try { initTickets(); } catch(e) { console.error('initTickets error:', e); }

  // Init UI
  try { initTheme(); } catch(e) { console.error('initTheme error:', e); }
  try { initThemeEvents(); } catch(e) { console.error('initThemeEvents error:', e); }
  try { initSidebarToggle(); } catch(e) { console.error('initSidebarToggle error:', e); }
  try { initNotifications(); } catch(e) { console.error('initNotifications error:', e); }
  try { initTicketEvents(); } catch(e) { console.error('initTicketEvents error:', e); }
  try { initSettings(); } catch(e) { console.error('initSettings error:', e); }
  try { initEmailConfig(); } catch(e) { console.error('initEmailConfig error:', e); }
  try { initAuditTrail(); } catch(e) { console.error('initAuditTrail error:', e); }
  try { initReports(); } catch(e) { console.error('initReports error:', e); }
  try { initAssets(); } catch(e) { console.error('initAssets error:', e); }
  try { initSoftware(); } catch(e) { console.error('initSoftware error:', e); }

  // Render initial views
  try { updateDashboard(); } catch(e) { console.error('updateDashboard error:', e); }
  try { renderAgentsView(); } catch(e) { console.error('renderAgentsView error:', e); }
  try { initUsersView(); } catch(e) { console.error('initUsersView error:', e); }
  try { applyRolePermissions(); } catch(e) { console.error('applyRolePermissions error:', e); }

  // Navigation — use delegation so clicks on child spans still work
  try {
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (sidebarNav) {
      sidebarNav.addEventListener('click', e => {
        const btn = e.target.closest('.nav-item[data-view]');
        if (!btn) return;
        e.preventDefault();
        navigateTo(btn.dataset.view);
      });
    }
  } catch(e) { console.error('Navigation init error:', e); }

  // Chart resize observer
  const resizeObserver = new ResizeObserver(() => {
    const activeView = document.querySelector('.view.active')?.id;
    if (activeView === 'view-dashboard') updateDashboard();
    if (activeView === 'view-reports') {
      renderMonthlyChart();
      renderResolutionChart();
      renderAgentPerfChart();
    }
  });
  const mainContent = document.getElementById('main');
  if (mainContent) resizeObserver.observe(mainContent);

  // Auto-refresh KPIs every 30s
  setInterval(() => {
    if (document.querySelector('#view-dashboard.active')) {
      updateKPIs();
    }
  }, 30000);

  // Initialize escape key modal close (A11y)
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (typeof closeLightbox === 'function') {
        const lightbox = document.getElementById('lightbox-overlay');
        if (lightbox && lightbox.style.display === 'flex') {
          closeLightbox();
        }
      }
      if (typeof closeAssetModal === 'function') {
        const assetModal = document.getElementById('asset-modal');
        if (assetModal && assetModal.style.display === 'flex') {
          closeAssetModal();
        }
      }
      if (typeof closeTicketModal === 'function') {
        const ticketModal = document.getElementById('ticket-modal-overlay');
        if (ticketModal && ticketModal.classList.contains('open')) {
          closeTicketModal();
        }
      }
      if (typeof closeCheckoutModal === 'function') {
        const checkoutModal = document.getElementById('checkout-modal');
        if (checkoutModal && checkoutModal.style.display === 'flex') {
          closeCheckoutModal();
        }
      }
    }
  });

  // Bind Data Management Panel controls
  const btnExport = document.getElementById('btn-export-db');
  const btnImport = document.getElementById('btn-import-db');
  const fileImport = document.getElementById('import-db-file');
  const labelImport = document.getElementById('import-db-filename');
  const btnReset = document.getElementById('btn-reset-db');
  const btnRefreshDiag = document.getElementById('btn-refresh-diag');

  const updateDiagnosticsUI = () => {
    if (typeof db !== 'undefined' && db.getDiagnostics) {
      const stats = db.getDiagnostics();
      const setDiag = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setDiag('diag-tickets-count', stats.ticketsCount);
      setDiag('diag-assets-count', stats.assetsCount);
      setDiag('diag-users-count', stats.usersCount);
      setDiag('diag-audits-count', stats.auditsCount);
      setDiag('diag-storage-size', stats.storageSizeKB);
    }
  };

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      if (typeof db !== 'undefined') {
        try {
          const dataStr = db.exportData();
          const blob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `helpdesk_db_backup_${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          if (typeof showToast === 'function') {
            showToast('Database backup exported successfully!', 'success');
          }
        } catch(e) {
          console.error('Export failed:', e);
          if (typeof showToast === 'function') {
            showToast('Failed to export database.', 'error');
          }
        }
      }
    });
  }

  if (fileImport) {
    fileImport.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) {
        if (labelImport) labelImport.textContent = file.name;
        if (btnImport) btnImport.disabled = false;
      } else {
        if (labelImport) labelImport.textContent = '';
        if (btnImport) btnImport.disabled = true;
      }
    });
  }

  if (btnImport) {
    btnImport.addEventListener('click', () => {
      const file = fileImport?.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          if (typeof db !== 'undefined' && db.importData) {
            const res = db.importData(evt.target.result);
            if (res.success) {
              if (typeof showToast === 'function') {
                showToast('Database restored successfully! Reloading page...', 'success');
              }
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            } else {
              if (typeof showToast === 'function') {
                showToast(`Restore failed: ${res.error}`, 'error');
              }
            }
          }
        };
        reader.readAsText(file);
      }
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('🚨 WARNING: This will delete ALL tickets, assets, users, audit logs, and settings, and restore default seed data. This cannot be undone. Are you sure you want to proceed?')) {
        if (typeof db !== 'undefined' && db.hardReset) {
          const ok = db.hardReset();
          if (ok) {
            if (typeof showToast === 'function') {
              showToast('Database wiped and re-seeded! Reloading page...', 'success');
            }
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            if (typeof showToast === 'function') {
              showToast('Failed to reset database.', 'error');
            }
          }
        }
      }
    });
  }

  if (btnRefreshDiag) {
    btnRefreshDiag.addEventListener('click', () => {
      updateDiagnosticsUI();
      if (typeof showToast === 'function') {
        showToast('Database statistics updated!', 'success');
      }
    });
  }

  // Initial diagnostics load
  updateDiagnosticsUI();
});

function navigateTo(view) {
  // Check permission
  const roles = typeof loadRoles === 'function' ? loadRoles() : [];
  const userRole = typeof getCurrentUserRole === 'function' ? getCurrentUserRole() : 'end-user';
  const roleObj = roles.find(r => r.key === userRole) || { permissions: [] };
  
  if (roleObj.permissions && !roleObj.permissions.includes(view)) {
    if (typeof showToast === 'function') {
      showToast(`Access Denied: Your role does not have permission to view the ${view} tab.`, 'error');
    }
    // Redirect to the first permitted tab
    const firstPermitted = roleObj.permissions[0];
    if (firstPermitted && firstPermitted !== view) {
      navigateTo(firstPermitted);
    }
    return;
  }

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view-${view}`);
  if (target) target.classList.add('active');

  try {
    if (view === 'dashboard') updateDashboard();
    if (view === 'tickets') { applyFilters(); }
    if (view === 'agents') renderAgentsView();
    if (view === 'users') refreshUsersView();
    if (view === 'live-chats') { initAdminChatConsole(); }
    if (view === 'audit-trail') renderAuditTrail();
    if (view === 'kb') { if (typeof renderAdminKB === 'function') renderAdminKB(); }
    if (view === 'assets') { if (typeof renderAdminAssets === 'function') renderAdminAssets(); }
    if (view === 'software') { if (typeof renderSoftwareView === 'function') renderSoftwareView(); }
    if (view === 'reports') {
      setTimeout(() => {
        try {
          renderMonthlyChart();
          renderResolutionChart();
          renderAgentPerfChart();
        } catch (e) { console.error('Reports charts error:', e); }
      }, 50);
    }
  } catch (e) { console.error(`Error navigating to ${view}:`, e); }
}
