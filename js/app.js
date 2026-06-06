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

  // Render initial views
  try { updateDashboard(); } catch(e) { console.error('updateDashboard error:', e); }
  try { renderAgentsView(); } catch(e) { console.error('renderAgentsView error:', e); }
  try { initUsersView(); } catch(e) { console.error('initUsersView error:', e); }

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
});

function navigateTo(view) {
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
