/* =============================================
   audit.js — Centralized Audit Trail Log
============================================= */

function initAuditTrail() {
  const searchInput = document.getElementById('audit-search');
  const actionFilter = document.getElementById('audit-filter-action');
  const clearBtn = document.getElementById('clear-audit-filters');

  if (searchInput) searchInput.addEventListener('input', renderAuditTrail);
  if (actionFilter) actionFilter.addEventListener('change', renderAuditTrail);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (actionFilter) actionFilter.value = '';
      renderAuditTrail();
    });
  }
}

function renderAuditTrail() {
  const tbody = document.getElementById('audit-trail-table-body');
  if (!tbody) return;

  const searchQuery = document.getElementById('audit-search')?.value.toLowerCase() || '';
  const actionType = document.getElementById('audit-filter-action')?.value || '';

  const tickets = loadTickets();
  let auditLogs = [];

  // Aggregate all audit log items from all tickets
  tickets.forEach(t => {
    if (Array.isArray(t.auditLog)) {
      t.auditLog.forEach(log => {
        auditLogs.push({
          ticketId: t.id,
          ticketSubject: t.subject,
          time: log.time,
          by: log.by || 'System',
          action: log.action
        });
      });
    }
  });

  // Sort audit log items by date descending (newest first)
  auditLogs.sort((a, b) => new Date(b.time) - new Date(a.time));

  // Apply search/filters
  const filteredLogs = auditLogs.filter(log => {
    // Action filter mapping
    if (actionType) {
      const act = log.action.toLowerCase();
      if (actionType === 'created' && !act.includes('created') && !act.includes('submitted')) return false;
      if (actionType === 'status' && !act.includes('status changed')) return false;
      if (actionType === 'assigned' && !act.includes('assigned')) return false;
      if (actionType === 'comment' && !act.includes('comment') && !act.includes('note')) return false;
      if (actionType === 'escalated' && !act.includes('escalated')) return false;
      if (actionType === 'closed' && !act.includes('closed')) return false;
    }

    // Search query filter
    if (searchQuery) {
      const matchesId = log.ticketId.toLowerCase().includes(searchQuery);
      const matchesActor = log.by.toLowerCase().includes(searchQuery);
      const matchesAction = log.action.toLowerCase().includes(searchQuery);
      const matchesSubject = log.ticketSubject.toLowerCase().includes(searchQuery);
      return matchesId || matchesActor || matchesAction || matchesSubject;
    }

    return true;
  });

  if (filteredLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:30px">No audit log entries found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredLogs.map(log => {
    const timeStr = typeof formatDateTime === 'function' ? formatDateTime(log.time) : new Date(log.time).toLocaleString();
    return `
      <tr>
        <td style="white-space:nowrap;font-size:0.82rem;color:var(--text-muted)">${timeStr}</td>
        <td style="font-weight:600;"><a href="javascript:void(0)" onclick="openTicketDetailFromAudit('${log.ticketId}')" style="color:var(--accent-blue);text-decoration:none">${log.ticketId}</a></td>
        <td style="font-weight:500;">${log.by}</td>
        <td>
          <div style="font-size:0.875rem;font-weight:600">${log.action}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${log.ticketSubject}</div>
        </td>
      </tr>
    `;
  }).join('');
}

// Helper to open details modal when clicking ticket ID in audit trail
function openTicketDetailFromAudit(ticketId) {
  if (typeof openDetailModal === 'function') {
    openDetailModal(ticketId);
  }
}
