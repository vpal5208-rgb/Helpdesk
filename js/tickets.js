/* =============================================
   tickets.js — Ticket CRUD & rendering
============================================= */

let allTickets = [];
let filteredTickets = [];
let currentPage = 1;
const PAGE_SIZE = 10;
let currentDetailId = null;

function initTickets() {
  allTickets = loadTickets();
  renderAgentFilter();
  applyFilters();
}

function renderAgentFilter() {
  const sel = document.getElementById('filter-agent');
  AGENTS.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id; opt.textContent = a.name;
    sel.appendChild(opt);
  });
  // Modal agent select
  const fAgent = document.getElementById('f-agent');
  AGENTS.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id; opt.textContent = a.name;
    fAgent.appendChild(opt);
  });
}

function applyFilters() {
  const status = document.getElementById('filter-status').value;
  const priority = document.getElementById('filter-priority').value;
  const category = document.getElementById('filter-category').value;
  const agentId = document.getElementById('filter-agent').value;
  const search = (document.getElementById('ticket-search').value || document.getElementById('global-search').value || '').toLowerCase();
  const sla = loadSLA();

  filteredTickets = allTickets.filter(t => {
    if (!t) return false;
    const tStatus = t.status || '';
    const tPriority = t.priority || '';
    const tCategory = t.category || '';
    const tAgentId = t.agentId || '';
    const tSubject = t.subject || '';
    const tId = t.id || '';
    const tRequester = t.requester || '';

    const slaRem = calcSLARemaining(t, sla);
    const isBreached = slaRem !== null && slaRem < 0;

    if (status && tStatus !== status) return false;
    if (priority && tPriority !== priority) return false;
    if (category && tCategory !== category) return false;
    if (agentId && tAgentId !== agentId) return false;
    if (search) {
      if (search === 'breach' || search === 'sla-breach' || search === 'breached') {
        if (!isBreached) return false;
      } else {
        if (!tSubject.toLowerCase().includes(search) && !tId.toLowerCase().includes(search) && !tRequester.toLowerCase().includes(search)) return false;
      }
    }
    return true;
  });

  currentPage = 1;
  renderTicketsTable();
  updateOpenCount();
}

function renderTicketsTable() {
  const tbody = document.getElementById('tickets-tbody');
  const sla = loadSLA();
  const total = filteredTickets.length;
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, total);
  const pageTickets = filteredTickets.slice(start, end);

  document.getElementById('ticket-count-label').textContent =
    `Showing ${start + 1}–${end} of ${total} tickets`;

  tbody.innerHTML = '';
  pageTickets.forEach(t => {
    const agent = getAgentById(t.agentId);
    const slaRem = calcSLARemaining(t, sla);
    let slaHtml = '<span class="sla-ok">—</span>';
    if (slaRem !== null) {
      if (slaRem < 0) slaHtml = `<span class="sla-breach">⚠ Breached</span>`;
      else if (slaRem < 2) slaHtml = `<span class="sla-warn">${slaRem.toFixed(1)}h left</span>`;
      else slaHtml = `<span class="sla-ok">${slaRem.toFixed(0)}h left</span>`;
    }

    const row = document.createElement('tr');
    row.dataset.id = t.id;
    row.innerHTML = `
      <td><input type="checkbox" class="row-check"/></td>
      <td><span class="ticket-id">${t.id}</span></td>
      <td><span class="ticket-subject" title="${t.subject}">${t.subject}</span></td>
      <td>${t.requester}</td>
      <td>${t.category}</td>
      <td>${badgeHtml('priority', t.priority)}</td>
      <td>${badgeHtml('status', t.status)}</td>
      <td>${agent ? `<span style="display:flex;align-items:center;gap:6px"><span style="width:22px;height:22px;border-radius:50%;background:${agent.color};display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;color:#fff">${agent.initials}</span>${agent.name}</span>` : '<span style="color:var(--text-muted)">Unassigned</span>'}</td>
      <td>${formatDate(t.created)}</td>
      <td>${slaHtml}</td>
      <td>
        <div class="table-actions-cell">
          <button class="action-btn" data-action="view" data-id="${t.id}" title="View">👁</button>
          <button class="action-btn" data-action="edit" data-id="${t.id}" title="Edit">✏</button>
          <button class="action-btn" data-action="delete" data-id="${t.id}" title="Delete">🗑</button>
        </div>
      </td>`;
    tbody.appendChild(row);
  });

  renderPagination(total);
}

function badgeHtml(type, val) {
  const cls = type === 'status'
    ? { 'Open':'badge-open','In Progress':'badge-inprogress','Resolved':'badge-resolved','Closed':'badge-closed' }[val]
    : { 'Critical':'badge-critical','High':'badge-high','Medium':'badge-medium','Low':'badge-low' }[val];
  return `<span class="badge ${cls||''}">${val}</span>`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function renderPagination(total) {
  const pages = Math.ceil(total / PAGE_SIZE);
  const cont = document.getElementById('pagination');
  cont.innerHTML = '';
  for (let i = 1; i <= pages; i++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
    btn.textContent = i;
    btn.addEventListener('click', () => { currentPage = i; renderTicketsTable(); });
    cont.appendChild(btn);
  }
}

function updateOpenCount() {
  const count = allTickets.filter(t => t.status === 'Open').length;
  document.getElementById('open-count').textContent = count;
}

// ====== TICKET CRUD ======
function createTicket(data) {
  const now = new Date().toISOString();
  const id = generateTicketId(allTickets.length + 1);
  const ticket = {
    id, subject: data.subject, requester: data.requester, email: data.email,
    category: data.category, priority: data.priority, status: data.status,
    agentId: data.agentId, description: data.description,
    created: now, comments: [],
    auditLog: [{ action:'Ticket created', time: now, by:'Admin User' }],
  };
  allTickets.unshift(ticket);
  saveTickets(allTickets);
  applyFilters();
  showToast('Ticket created successfully!', 'success');
  addActivity('🎫', `New ticket <strong>${id}</strong> created: ${data.subject}`);
  addNotification(`New ticket created: ${id} — ${data.subject}`);
  updateDashboard();
  triggerEmailNotification('new_ticket', ticket);
}

function updateTicket(id, data) {
  const idx = allTickets.findIndex(t => t.id === id);
  if (idx === -1) return;
  const t = allTickets[idx];
  const now = new Date().toISOString();
  
  const statusChanged = t.status !== data.status;
  const agentChanged = t.agentId !== data.agentId;

  if (statusChanged)
    t.auditLog.push({ action:`Status changed from "${t.status}" to "${data.status}"`, time: now, by:'Admin User' });
  if (agentChanged) {
    const newAgent = getAgentName(data.agentId);
    t.auditLog.push({ action:`Assigned to ${newAgent}`, time: now, by:'Admin User' });
  }
  Object.assign(t, data);
  saveTickets(allTickets);
  applyFilters();
  showToast('Ticket updated!', 'success');
  updateDashboard();

  if (statusChanged) {
    if (t.status === 'Resolved') {
      triggerEmailNotification('resolved', t);
    } else {
      triggerEmailNotification('status', t);
    }
  }
  if (agentChanged && t.agentId) {
    triggerEmailNotification('assigned', t);
  }
}

function deleteTicket(id) {
  if (!confirm('Delete this ticket?')) return;
  allTickets = allTickets.filter(t => t.id !== id);
  saveTickets(allTickets);
  applyFilters();
  showToast('Ticket deleted.', 'info');
  updateDashboard();
}

function addCommentToTicket(ticketId, text, internal) {
  const t = allTickets.find(t => t.id === ticketId);
  if (!t) return;
  const comment = { author:'Admin User', text, internal, time: new Date().toISOString() };
  t.comments.push(comment);
  t.auditLog.push({ action: internal ? 'Internal note added' : 'Comment posted', time: comment.time, by:'Admin User' });
  saveTickets(allTickets);
  renderDetailModal(ticketId);
  showToast('Comment added.', 'success');
  if (!internal) {
    triggerEmailNotification('comment', t);
  }
}

// ====== DETAIL MODAL ======
function openDetailModal(id) {
  currentDetailId = id;
  renderDetailModal(id);
  document.getElementById('detail-modal-overlay').classList.add('open');
}

function renderDetailModal(id) {
  const t = allTickets.find(t => t.id === id);
  if (!t) return;
  const sla = loadSLA();
  const agent = getAgentById(t.agentId);
  const slaRem = calcSLARemaining(t, sla);

  document.getElementById('detail-title').textContent = `Ticket ${t.id}`;
  document.getElementById('detail-meta').innerHTML = `${badgeHtml('status',t.status)} ${badgeHtml('priority',t.priority)}`;
  document.getElementById('detail-desc').textContent = t.description;
  document.getElementById('di-status').outerHTML; // reset handled below
  document.getElementById('di-status').innerHTML = ''; document.getElementById('di-status').className='badge'; document.getElementById('di-status').insertAdjacentHTML('afterbegin',badgeHtml('status',t.status));
  document.getElementById('di-priority').innerHTML = ''; document.getElementById('di-priority').insertAdjacentHTML('afterbegin',badgeHtml('priority',t.priority));
  document.getElementById('di-category').textContent = t.category;
  document.getElementById('di-requester').textContent = t.requester;
  document.getElementById('di-agent').textContent = agent ? agent.name : 'Unassigned';
  document.getElementById('di-created').textContent = formatDateTime(t.created);

  const slaEl = document.getElementById('di-sla');
  if (slaRem === null) { slaEl.textContent = 'N/A'; slaEl.style.color = 'var(--text-muted)'; }
  else if (slaRem < 0) { slaEl.textContent = 'BREACHED'; slaEl.style.color = 'var(--accent-red)'; }
  else if (slaRem < 2) { slaEl.textContent = `${slaRem.toFixed(1)}h remaining`; slaEl.style.color = 'var(--accent-orange)'; }
  else { slaEl.textContent = `${slaRem.toFixed(0)}h remaining`; slaEl.style.color = 'var(--accent-green)'; }

  // Comments
  const cl = document.getElementById('comments-list');
  cl.innerHTML = t.comments.length ? '' : '<p style="color:var(--text-muted);font-size:0.82rem">No comments yet.</p>';
  t.comments.forEach(c => {
    const div = document.createElement('div');
    div.className = 'comment-item' + (c.internal ? ' internal' : '');
    div.innerHTML = `<div class="comment-author">${c.author}${c.internal?'<span style="color:var(--accent-orange);font-size:0.75rem;margin-left:6px">[Internal]</span>':''}</div><div class="comment-text">${c.text}</div><div class="comment-time">${formatDateTime(c.time)}</div>`;
    cl.appendChild(div);
  });

  // Audit
  const al = document.getElementById('audit-list');
  al.innerHTML = '';
  [...t.auditLog].reverse().forEach(a => {
    const div = document.createElement('div');
    div.className = 'audit-item';
    div.innerHTML = `<div class="audit-dot"></div><div class="audit-text">${a.action}<div class="audit-time">${a.by} · ${formatDateTime(a.time)}</div></div>`;
    al.appendChild(div);
  });
}

function initTicketEvents() {
  // Table row actions
  document.getElementById('tickets-tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (btn.dataset.action === 'view') openDetailModal(id);
      else if (btn.dataset.action === 'edit') openEditModal(id);
      else if (btn.dataset.action === 'delete') deleteTicket(id);
      return;
    }
    const row = e.target.closest('tr[data-id]');
    if (row) openDetailModal(row.dataset.id);
  });

  // Filters
  ['filter-status','filter-priority','filter-category','filter-agent','ticket-search'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyFilters);
    document.getElementById(id).addEventListener('change', applyFilters);
  });
  document.getElementById('global-search').addEventListener('input', () => {
    if(document.querySelector('.nav-item[data-view="tickets"]').classList.contains('active')){}
    applyFilters();
  });
  document.getElementById('clear-filters').addEventListener('click', () => {
    ['filter-status','filter-priority','filter-category','filter-agent'].forEach(id => document.getElementById(id).value='');
    document.getElementById('ticket-search').value='';
    applyFilters();
  });

  // Select all
  document.getElementById('select-all').addEventListener('change', e => {
    document.querySelectorAll('.row-check').forEach(cb => cb.checked = e.target.checked);
  });

  // Export
  document.getElementById('export-btn').addEventListener('click', exportCSV);

  // New ticket modal
  document.getElementById('new-ticket-btn').addEventListener('click', () => openNewTicketModal());
  document.getElementById('ticket-modal-close').addEventListener('click', closeTicketModal);
  document.getElementById('ticket-modal-cancel').addEventListener('click', closeTicketModal);
  document.getElementById('ticket-modal-overlay').addEventListener('click', e => { if(e.target===e.currentTarget) closeTicketModal(); });
  document.getElementById('ticket-modal-save').addEventListener('click', saveTicketForm);

  // Detail modal
  document.getElementById('detail-modal-close').addEventListener('click', () => document.getElementById('detail-modal-overlay').classList.remove('open'));
  document.getElementById('detail-modal-overlay').addEventListener('click', e => { if(e.target===e.currentTarget) document.getElementById('detail-modal-overlay').classList.remove('open'); });
  document.getElementById('add-comment-btn').addEventListener('click', () => {
    const text = document.getElementById('comment-input').value.trim();
    const internal = document.getElementById('comment-internal').checked;
    if (!text) return;
    addCommentToTicket(currentDetailId, text, internal);
    document.getElementById('comment-input').value = '';
  });
  document.getElementById('detail-edit-btn').addEventListener('click', () => {
    document.getElementById('detail-modal-overlay').classList.remove('open');
    openEditModal(currentDetailId);
  });
  document.getElementById('detail-resolve-btn').addEventListener('click', () => {
    const t = allTickets.find(t=>t.id===currentDetailId);
    if(t){ updateTicket(currentDetailId,{...t,status:'Resolved'}); renderDetailModal(currentDetailId); }
  });
  document.getElementById('detail-close-btn').addEventListener('click', () => {
    const t = allTickets.find(t=>t.id===currentDetailId);
    if(t){ updateTicket(currentDetailId,{...t,status:'Closed'}); renderDetailModal(currentDetailId); }
  });
}

function openNewTicketModal() {
  document.getElementById('modal-title').textContent = 'New Ticket';
  document.getElementById('ticket-id-field').value = '';
  ['f-subject','f-requester','f-email','f-desc'].forEach(id => document.getElementById(id).value='');
  document.getElementById('f-category').value='Network';
  document.getElementById('f-priority').value='High';
  document.getElementById('f-agent').value='';
  document.getElementById('f-status').value='Open';
  document.getElementById('ticket-modal-save').textContent='Create Ticket';
  document.getElementById('ticket-modal-overlay').classList.add('open');
  document.getElementById('f-subject').focus();
}

function openEditModal(id) {
  const t = allTickets.find(t=>t.id===id);
  if(!t) return;
  document.getElementById('modal-title').textContent = `Edit ${t.id}`;
  document.getElementById('ticket-id-field').value = t.id;
  document.getElementById('f-subject').value = t.subject;
  document.getElementById('f-requester').value = t.requester;
  document.getElementById('f-email').value = t.email||'';
  document.getElementById('f-desc').value = t.description;
  document.getElementById('f-category').value = t.category;
  document.getElementById('f-priority').value = t.priority;
  document.getElementById('f-agent').value = t.agentId||'';
  document.getElementById('f-status').value = t.status;
  document.getElementById('ticket-modal-save').textContent='Update Ticket';
  document.getElementById('ticket-modal-overlay').classList.add('open');
}

function closeTicketModal() { document.getElementById('ticket-modal-overlay').classList.remove('open'); }

function saveTicketForm() {
  const subject = document.getElementById('f-subject').value.trim();
  const requester = document.getElementById('f-requester').value.trim();
  if (!subject || !requester) { showToast('Subject and Requester are required.','error'); return; }
  const data = {
    subject, requester,
    email: document.getElementById('f-email').value.trim(),
    category: document.getElementById('f-category').value,
    priority: document.getElementById('f-priority').value,
    agentId: document.getElementById('f-agent').value,
    status: document.getElementById('f-status').value,
    description: document.getElementById('f-desc').value.trim()||`Issue reported by ${requester}.`,
  };
  const existingId = document.getElementById('ticket-id-field').value;
  if(existingId){ updateTicket(existingId,data); }
  else { createTicket(data); }
  closeTicketModal();
}

function exportCSV() {
  const headers = ['ID','Subject','Requester','Category','Priority','Status','Agent','Created'];
  const rows = filteredTickets.map(t => [t.id,`"${t.subject}"`,t.requester,t.category,t.priority,t.status,getAgentName(t.agentId),t.created]);
  const csv = [headers.join(','),...rows.map(r=>r.join(','))].join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='tickets.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!','success');
}
