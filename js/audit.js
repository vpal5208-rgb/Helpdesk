/* =============================================
   audit.js — Centralized Audit Trail Log
============================================= */

let currentAuditOrientation = 'table';

function initAuditTrail() {
  const searchInput = document.getElementById('audit-search');
  const actionFilter = document.getElementById('audit-filter-action');
  const clearBtn = document.getElementById('clear-audit-filters');
  const exportBtn = document.getElementById('export-audit-csv-btn');
  const orientationToggle = document.getElementById('audit-orientation-toggle');

  if (searchInput) searchInput.addEventListener('input', renderAuditTrail);
  if (actionFilter) actionFilter.addEventListener('change', renderAuditTrail);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (actionFilter) actionFilter.value = '';
      renderAuditTrail();
    });
  }
  if (exportBtn) exportBtn.addEventListener('click', exportAuditTrailToCSV);

  if (orientationToggle) {
    orientationToggle.addEventListener('click', e => {
      const btn = e.target.closest('.toggle-btn');
      if (!btn) return;
      orientationToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentAuditOrientation = btn.dataset.orientation;
      
      // Toggle visibility
      const tableDiv = document.getElementById('audit-table-orientation');
      const timelineDiv = document.getElementById('audit-timeline-orientation');
      if (currentAuditOrientation === 'table') {
        if (tableDiv) tableDiv.style.display = 'block';
        if (timelineDiv) timelineDiv.style.display = 'none';
      } else {
        if (tableDiv) tableDiv.style.display = 'none';
        if (timelineDiv) timelineDiv.style.display = 'block';
      }
      renderAuditTrail();
    });
  }
}
const LS_SYSTEM_AUDIT = 'hd_system_audit_logs_v1';

function loadSystemAuditLogs() {
  try {
    const raw = localStorage.getItem(LS_SYSTEM_AUDIT);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load system audit logs', e);
  }
  return [];
}

function saveSystemAuditLogs(logs) {
  try {
    localStorage.setItem(LS_SYSTEM_AUDIT, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save system audit logs', e);
  }
}

function getCurrentActorName() {
  const LS_ADMIN_AUTH = 'hd_admin_auth_v1';
  const s = sessionStorage.getItem(LS_ADMIN_AUTH) || localStorage.getItem(LS_ADMIN_AUTH);
  if (s) {
    try {
      const sess = JSON.parse(s);
      if (sess.name) return sess.name;
    } catch (e) {}
  }
  return 'System';
}

function addAuditLog(action, by = 'System', refId = '', type = 'asset') {
  let actor = by;
  if (actor === 'System' || !actor) {
    actor = getCurrentActorName();
  }
  const logs = loadSystemAuditLogs();
  logs.push({
    action,
    by: actor,
    refId,
    type,
    time: new Date().toISOString()
  });
  saveSystemAuditLogs(logs);
}

function renderAuditTrail() {
  const searchQuery = document.getElementById('audit-search')?.value.toLowerCase() || '';
  const actionType = document.getElementById('audit-filter-action')?.value || '';

  const tickets = loadTickets();
  let auditLogs = [];

  // Aggregate all audit log items from all tickets
  tickets.forEach(t => {
    if (Array.isArray(t.auditLog)) {
      t.auditLog.forEach(log => {
        auditLogs.push({
          id: t.id,
          subject: t.subject,
          time: log.time,
          by: log.by || 'System',
          action: log.action,
          type: 'ticket'
        });
      });
    }
  });

  // Aggregate system audit logs (assets, etc.)
  const systemLogs = loadSystemAuditLogs();
  systemLogs.forEach(log => {
    auditLogs.push({
      id: log.refId || 'System',
      subject: log.type === 'asset' ? 'Asset Action' : 'System Action',
      time: log.time,
      by: log.by || 'System',
      action: log.action,
      type: log.type || 'asset'
    });
  });

  // Sort audit log items by date descending (newest first)
  auditLogs.sort((a, b) => new Date(b.time) - new Date(a.time));

  // Apply search/filters
  const filteredLogs = auditLogs.filter(log => {
    // Action filter mapping
    if (actionType) {
      if (actionType === 'asset') {
        return log.type === 'asset';
      }
      
      // If we filter on ticket operations, skip asset logs
      if (log.type !== 'ticket') return false;

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
      const matchesId = log.id.toLowerCase().includes(searchQuery);
      const matchesActor = log.by.toLowerCase().includes(searchQuery);
      const matchesAction = log.action.toLowerCase().includes(searchQuery);
      const matchesSubject = log.subject.toLowerCase().includes(searchQuery);
      return matchesId || matchesActor || matchesAction || matchesSubject;
    }

    return true;
  });

  if (currentAuditOrientation === 'table') {
    renderAuditTable(filteredLogs);
  } else {
    renderAuditTimeline(filteredLogs);
  }
}

function renderAuditTable(logs) {
  const tbody = document.getElementById('audit-trail-table-body');
  if (!tbody) return;
  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:30px">No audit log entries found.</td></tr>`;
    return;
  }
  tbody.innerHTML = logs.map(log => {
    const timeStr = typeof formatDateTime === 'function' ? formatDateTime(log.time) : new Date(log.time).toLocaleString();
    const isTicket = log.id.startsWith('TKT-');
    const idLink = isTicket
      ? `<a href="javascript:void(0)" onclick="openTicketDetailFromAudit('${log.id}')" style="color:var(--accent-blue);text-decoration:none">${log.id}</a>`
      : log.id.startsWith('AST-')
        ? `<a href="javascript:void(0)" onclick="openAssetModal('${log.id}')" style="color:#3fb950;text-decoration:none">${log.id}</a>`
        : `<span style="color:var(--text-muted)">${log.id}</span>`;
        
    return `
      <tr>
        <td style="white-space:nowrap;font-size:0.82rem;color:var(--text-muted)">${timeStr}</td>
        <td style="font-weight:600;">${idLink}</td>
        <td style="font-weight:500;">${log.by}</td>
        <td>
          <div style="font-size:0.875rem;font-weight:600">${log.action}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${log.subject}</div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAuditTimeline(logs) {
  const flow = document.getElementById('audit-timeline-flow');
  if (!flow) return;
  if (logs.length === 0) {
    flow.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:30px">No audit log entries found.</div>`;
    return;
  }

  const getEventClassAndEmoji = (action) => {
    const act = action.toLowerCase();
    if (act.includes('checked out')) return { cls: 'assigned', emoji: '📤' };
    if (act.includes('checked in')) return { cls: 'status', emoji: '↩️' };
    if (act.includes('created asset')) return { cls: 'created', emoji: '🖥️' };
    if (act.includes('deleted asset')) return { cls: 'closed', emoji: '🗑️' };
    if (act.includes('synced asset')) return { cls: 'other', emoji: '🔄' };
    
    if (act.includes('created') || act.includes('submitted')) return { cls: 'created', emoji: '🎫' };
    if (act.includes('status changed')) return { cls: 'status', emoji: '🔧' };
    if (act.includes('assigned')) return { cls: 'assigned', emoji: '👤' };
    if (act.includes('comment') || act.includes('note')) return { cls: 'comment', emoji: '💬' };
    if (act.includes('escalated')) return { cls: 'escalated', emoji: '🚨' };
    if (act.includes('closed')) return { cls: 'closed', emoji: '🔒' };
    return { cls: 'other', emoji: '📋' };
  };

  flow.innerHTML = logs.map(log => {
    const timeStr = typeof formatDateTime === 'function' ? formatDateTime(log.time) : new Date(log.time).toLocaleString();
    const config = getEventClassAndEmoji(log.action);
    const isTicket = log.id.startsWith('TKT-');
    const refLabel = isTicket ? 'Ticket' : 'Asset';
    const refLink = isTicket
      ? `<a href="javascript:void(0)" onclick="openTicketDetailFromAudit('${log.id}')" style="color:var(--accent-blue);text-decoration:none;font-weight:600">${log.id}</a>`
      : log.id.startsWith('AST-')
        ? `<a href="javascript:void(0)" onclick="openAssetModal('${log.id}')" style="color:#3fb950;text-decoration:none;font-weight:600">${log.id}</a>`
        : `<span style="color:var(--text-secondary)">${log.id}</span>`;
        
    return `
      <div class="timeline-event ${config.cls}">
        <div class="timeline-marker">${config.emoji}</div>
        <div class="timeline-card-content">
          <div class="timeline-meta">
            <span class="timeline-actor">👤 ${log.by}</span>
            <span>${timeStr}</span>
          </div>
          <div style="font-size:0.95rem;font-weight:600;margin-bottom:6px;">${log.action}</div>
          <div class="timeline-subject">
            ${refLabel}: ${refLink} — ${log.subject}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function exportAuditTrailToCSV() {
  const tickets = loadTickets();
  let auditLogs = [];
  
  tickets.forEach(t => {
    if (Array.isArray(t.auditLog)) {
      t.auditLog.forEach(log => {
        auditLogs.push({
          time: log.time,
          id: t.id,
          subject: t.subject,
          by: log.by || 'System',
          action: log.action
        });
      });
    }
  });

  const systemLogs = loadSystemAuditLogs();
  systemLogs.forEach(log => {
    auditLogs.push({
      time: log.time,
      id: log.refId || 'System',
      subject: log.type === 'asset' ? 'Asset Action' : 'System Action',
      by: log.by || 'System',
      action: log.action
    });
  });
  
  auditLogs.sort((a, b) => new Date(b.time) - new Date(a.time));
  
  let csvContent = "Date & Time,Ref ID,Subject,Actor,Action Details\r\n";
  
  auditLogs.forEach(log => {
    const timeStr = new Date(log.time).toISOString();
    const escapedSubject = log.subject.replace(/"/g, '""');
    const escapedAction = log.action.replace(/"/g, '""');
    csvContent += `"${timeStr}","${log.id}","${escapedSubject}","${log.by}","${escapedAction}"\r\n`;
  });
  
  const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "HelpDesk_Audit_Trail.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof showToast === 'function') {
    showToast("Audit Trail CSV downloaded!", "success");
  }
}

// Helper to open details modal when clicking ticket ID in audit trail
function openTicketDetailFromAudit(ticketId) {
  if (typeof openDetailModal === 'function') {
    openDetailModal(ticketId);
  }
}

window.addAuditLog = addAuditLog;
window.loadSystemAuditLogs = loadSystemAuditLogs;
window.saveSystemAuditLogs = saveSystemAuditLogs;
window.getCurrentActorName = getCurrentActorName;
