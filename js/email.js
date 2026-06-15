/* =============================================
   email.js — Email Configuration Logic
============================================= */

const LS_EMAIL_CONFIG = 'hd_email_config_v1';
const LS_EMAIL_TEMPLATES = 'hd_email_templates_custom_v1';

const TEMPLATE_DEFAULTS = {
  new_ticket: {
    subject: 'New Support Ticket Created',
    header: 'New Ticket Submitted',
    body: 'A new support ticket has been submitted and requires attention.',
    cta: 'View Ticket'
  },
  assigned: {
    subject: 'Ticket Assigned to You',
    header: 'Ticket Assignment',
    body: 'A support ticket has been assigned to you and requires your attention.',
    cta: 'Work on Ticket'
  },
  resolved: {
    subject: 'Your Ticket Has Been Resolved',
    header: 'Ticket Resolved',
    body: 'Great news! Your support ticket has been resolved by our IT team. Please review the resolution and let us know if the issue persists.',
    cta: 'View Resolution'
  },
  sla_breach: {
    subject: '⚠ SLA Breach Warning — Immediate Action Required',
    header: 'SLA Breach Alert',
    body: 'URGENT: The following ticket has breached its SLA deadline and requires immediate attention.',
    cta: 'Resolve Now'
  },
  status_change: {
    subject: 'Update on Your Ticket {ticketId}: {status}',
    header: 'Ticket Status Updated',
    body: 'The status of your support ticket has been updated to: {status}.',
    cta: 'View Ticket Status'
  }
};

function loadEmailTemplates() {
  try {
    const r = localStorage.getItem(LS_EMAIL_TEMPLATES);
    if (r) return JSON.parse(r);
  } catch(e) {}
  return JSON.parse(JSON.stringify(TEMPLATE_DEFAULTS));
}

function saveEmailTemplates(templates) {
  localStorage.setItem(LS_EMAIL_TEMPLATES, JSON.stringify(templates));
}

function replacePlaceholders(text, data) {
  if (!text) return '';
  return text
    .replace(/{ticketId}/g, data.ticketId || '')
    .replace(/{subject}/g, data.ticketSubject || '')
    .replace(/{priority}/g, data.priority || '')
    .replace(/{status}/g, data.status || '')
    .replace(/{requester}/g, data.requester || '');
}

const EMAIL_DEFAULTS = {
  smtpHost: 'smtp.company.com',
  smtpPort: 587,
  smtpUser: 'helpdesk@company.com',
  smtpPass: 'secret123',
  smtpEnc: 'tls',
  smtpTimeout: 30,
  fromName: 'HelpDesk Pro',
  fromAddr: 'noreply@company.com',
  replyTo: 'support@company.com',
  signature: '-- \nHelpDesk Pro | IT Support\nsupport@company.com | +1 (800) 555-0199',
  triggers: {
    newTicket: true, newTicketRecv: 'all',
    assigned: true, assignedRecv: 'agent',
    status: true, statusRecv: 'requester',
    sla: true, slaRecv: 'agent',
    resolved: true, resolvedRecv: 'requester',
    comment: false, commentRecv: 'both',
    summary: false, summaryRecv: 'manager',
    critical: true, criticalRecv: 'manager',
  }
};

const EMAIL_TEMPLATES = {
  new_ticket: (cfg) => {
    const tpls = loadEmailTemplates();
    const t = tpls.new_ticket || TEMPLATE_DEFAULTS.new_ticket;
    const data = {
      ticketId: 'TKT-0064', ticketSubject: 'VPN connection dropping intermittently',
      priority: 'High', status: 'Open', requester: 'John Smith'
    };
    return renderEmailPreview({
      icon:'🎫', subject: replacePlaceholders(t.subject, data),
      headerTitle: replacePlaceholders(t.header, data), headerSub: 'IT Support Management',
      greeting:`Hello ${cfg.fromName} Team,`,
      body: replacePlaceholders(t.body, data),
      ...data,
      badgeClass:'badge-high',
      cta: replacePlaceholders(t.cta, data), ctaHref:'#',
      footer:`This notification was sent to: All Agents\nTicket notifications are managed in Settings › Email Configuration`,
      sig: cfg.signature,
    });
  },
  assigned: (cfg) => {
    const tpls = loadEmailTemplates();
    const t = tpls.assigned || TEMPLATE_DEFAULTS.assigned;
    const data = {
      ticketId: 'TKT-0042', ticketSubject: 'Printer offline on 3rd floor',
      priority: 'Medium', status: 'In Progress', requester: 'Emily Davis'
    };
    return renderEmailPreview({
      icon:'👤', subject: replacePlaceholders(t.subject, data),
      headerTitle: replacePlaceholders(t.header, data), headerSub: 'IT Support Management',
      greeting:`Hello Sarah Chen,`,
      body: replacePlaceholders(t.body, data),
      ...data,
      badgeClass:'badge-medium',
      cta: replacePlaceholders(t.cta, data), ctaHref:'#',
      footer:`You received this because you were assigned to this ticket.\nManage notification settings in Settings › Email Configuration`,
      sig: cfg.signature,
    });
  },
  resolved: (cfg) => {
    const tpls = loadEmailTemplates();
    const t = tpls.resolved || TEMPLATE_DEFAULTS.resolved;
    const data = {
      ticketId: 'TKT-0031', ticketSubject: 'Outlook not syncing emails',
      priority: 'High', status: 'Resolved', requester: 'James Wilson'
    };
    return renderEmailPreview({
      icon:'✅', subject: replacePlaceholders(t.subject, data),
      headerTitle: replacePlaceholders(t.header, data), headerSub: 'IT Support Management',
      greeting:`Hello James Wilson,`,
      body: replacePlaceholders(t.body, data),
      ...data,
      badgeClass:'badge-resolved',
      cta: replacePlaceholders(t.cta, data), ctaHref:'#',
      footer:`If the issue is not resolved, please reply to this email or reopen the ticket.\nHelpDesk Pro | IT Support`,
      sig: cfg.signature,
    });
  },
  sla_breach: (cfg) => {
    const tpls = loadEmailTemplates();
    const t = tpls.sla_breach || TEMPLATE_DEFAULTS.sla_breach;
    const data = {
      ticketId: 'TKT-0005', ticketSubject: 'Malware detected on workstation',
      priority: 'Critical', status: 'Open', requester: 'Robert Martinez'
    };
    return renderEmailPreview({
      icon:'🚨', subject: replacePlaceholders(t.subject, data),
      headerTitle: replacePlaceholders(t.header, data), headerSub: 'IT Support Management',
      greeting:`Hello IT Manager,`,
      body: replacePlaceholders(t.body, data),
      ...data,
      badgeClass:'badge-critical',
      cta: replacePlaceholders(t.cta, data), ctaHref:'#',
      footer:`SLA Configuration: Critical = 2h | High = 8h | Medium = 24h | Low = 72h\nManage SLA thresholds in Settings › SLA Configuration`,
      sig: cfg.signature,
    });
  },
  status_change: (cfg) => {
    const tpls = loadEmailTemplates();
    const t = tpls.status_change || TEMPLATE_DEFAULTS.status_change;
    const data = {
      ticketId: 'TKT-0042', ticketSubject: 'Printer offline on 3rd floor',
      priority: 'Medium', status: 'In Progress', requester: 'Emily Davis'
    };
    return renderEmailPreview({
      icon:'🔄', subject: replacePlaceholders(t.subject, data),
      headerTitle: replacePlaceholders(t.header, data), headerSub: 'IT Support Management',
      greeting:`Hello Emily Davis,`,
      body: replacePlaceholders(t.body, data),
      ...data,
      badgeClass:'badge-inprogress',
      cta: replacePlaceholders(t.cta, data), ctaHref:'#',
      footer:`You received this notification because your ticket status changed.\nManage your subscription in Settings › Email Configuration`,
      sig: cfg.signature,
    });
  },
  summary: (cfg) => renderSummaryPreview(cfg),
};

function renderEmailPreview({ icon, subject, headerTitle, headerSub, greeting, body, ticketId, ticketSubject, priority, status, requester, badgeClass, cta, ctaHref, footer, sig }) {
  return `
  <div class="ep-email">
    <div class="ep-header">
      <div class="ep-header-icon">${icon}</div>
      <div><div class="ep-header-title">${headerTitle}</div><div class="ep-header-sub">${headerSub}</div></div>
    </div>
    <div class="ep-body">
      <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:4px">To: recipient@company.com &nbsp;·&nbsp; Subject: ${subject}</p>
      <hr style="border:none;border-top:1px solid var(--border);margin:10px 0"/>
      <p>${greeting}</p>
      <p style="margin-top:10px">${body}</p>
      <div class="ep-ticket-card">
        <div class="ep-ticket-id">${ticketId}</div>
        <div class="ep-ticket-subject">${ticketSubject}</div>
        <div class="ep-meta-row">
          <span class="ep-badge badge ${badgeClass}">${priority}</span>
          <span class="ep-badge badge badge-${status.toLowerCase().replace(' ','')}">${status}</span>
          <span class="ep-meta-item">👤 ${requester}</span>
        </div>
      </div>
      <a class="ep-btn" href="${ctaHref}">${cta} →</a>
      <div style="margin-top:20px;font-size:0.8rem;color:var(--text-secondary);white-space:pre-line">${sig}</div>
    </div>
    <div class="ep-footer" style="white-space:pre-line">${footer}</div>
  </div>`;
}

function renderSummaryPreview(cfg) {
  const open = allTickets.filter(t => t.status === 'Open').length;
  const inprog = allTickets.filter(t => t.status === 'In Progress').length;
  const resolved = allTickets.filter(t => t.status === 'Resolved').length;
  const sla = loadSLA();
  const breaches = allTickets.filter(t => { const r = calcSLARemaining(t, sla); return r !== null && r < 0; }).length;
  const today = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  return `
  <div class="ep-email">
    <div class="ep-header">
      <div class="ep-header-icon">📊</div>
      <div><div class="ep-header-title">Daily Summary Digest</div><div class="ep-header-sub">${today}</div></div>
    </div>
    <div class="ep-body">
      <p>Hello IT Manager,</p>
      <p style="margin-top:10px">Here is your daily helpdesk summary report:</p>
      <div class="ep-ticket-card" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px">
        <div style="text-align:center;padding:10px">
          <div style="font-size:1.8rem;font-weight:800;color:var(--accent-blue)">${open}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary)">Open Tickets</div>
        </div>
        <div style="text-align:center;padding:10px">
          <div style="font-size:1.8rem;font-weight:800;color:var(--accent-orange)">${inprog}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary)">In Progress</div>
        </div>
        <div style="text-align:center;padding:10px">
          <div style="font-size:1.8rem;font-weight:800;color:var(--accent-green)">${resolved}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary)">Resolved Today</div>
        </div>
        <div style="text-align:center;padding:10px">
          <div style="font-size:1.8rem;font-weight:800;color:var(--accent-red)">${breaches}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary)">SLA Breaches</div>
        </div>
      </div>
      <a class="ep-btn" href="#">View Full Dashboard →</a>
      <div style="margin-top:20px;font-size:0.8rem;color:var(--text-secondary);white-space:pre-line">${cfg.signature}</div>
    </div>
    <div class="ep-footer">This digest is sent daily to: Manager Only · Manage in Settings › Email Configuration</div>
  </div>`;
}

function loadEmailConfig() {
  try { const r = localStorage.getItem(LS_EMAIL_CONFIG); if (r) return JSON.parse(r); } catch(e) {}
  return { ...EMAIL_DEFAULTS };
}
function saveEmailConfigToStorage(cfg) { localStorage.setItem(LS_EMAIL_CONFIG, JSON.stringify(cfg)); }

function readEmailFormValues() {
  return {
    smtpHost: document.getElementById('smtp-host').value.trim(),
    smtpPort: parseInt(document.getElementById('smtp-port').value) || 587,
    smtpUser: document.getElementById('smtp-user').value.trim(),
    smtpPass: document.getElementById('smtp-pass').value,
    smtpEnc: document.getElementById('smtp-enc').value,
    smtpTimeout: parseInt(document.getElementById('smtp-timeout').value) || 30,
    fromName: document.getElementById('email-from-name').value.trim(),
    fromAddr: document.getElementById('email-from-addr').value.trim(),
    replyTo: document.getElementById('email-reply-to').value.trim(),
    signature: document.getElementById('email-signature').value,
    triggers: {
      newTicket: document.getElementById('trig-new-ticket').checked,
      newTicketRecv: document.getElementById('recv-new-ticket').value,
      assigned: document.getElementById('trig-assigned').checked,
      assignedRecv: document.getElementById('recv-assigned').value,
      status: document.getElementById('trig-status').checked,
      statusRecv: document.getElementById('recv-status').value,
      sla: document.getElementById('trig-sla').checked,
      slaRecv: document.getElementById('recv-sla').value,
      resolved: document.getElementById('trig-resolved').checked,
      resolvedRecv: document.getElementById('recv-resolved').value,
      comment: document.getElementById('trig-comment').checked,
      commentRecv: document.getElementById('recv-comment').value,
      summary: document.getElementById('trig-summary').checked,
      summaryRecv: document.getElementById('recv-summary').value,
      critical: document.getElementById('trig-critical').checked,
      criticalRecv: document.getElementById('recv-critical').value,
    }
  };
}

function applyEmailConfigToForm(cfg) {
  document.getElementById('smtp-host').value = cfg.smtpHost || '';
  document.getElementById('smtp-port').value = cfg.smtpPort || 587;
  document.getElementById('smtp-user').value = cfg.smtpUser || '';
  document.getElementById('smtp-pass').value = cfg.smtpPass || '';
  document.getElementById('smtp-enc').value = cfg.smtpEnc || 'tls';
  document.getElementById('smtp-timeout').value = cfg.smtpTimeout || 30;
  document.getElementById('email-from-name').value = cfg.fromName || '';
  document.getElementById('email-from-addr').value = cfg.fromAddr || '';
  document.getElementById('email-reply-to').value = cfg.replyTo || '';
  document.getElementById('email-signature').value = cfg.signature || '';
  const t = cfg.triggers || {};
  document.getElementById('trig-new-ticket').checked = !!t.newTicket;
  document.getElementById('recv-new-ticket').value = t.newTicketRecv || 'all';
  document.getElementById('trig-assigned').checked = !!t.assigned;
  document.getElementById('recv-assigned').value = t.assignedRecv || 'agent';
  document.getElementById('trig-status').checked = !!t.status;
  document.getElementById('recv-status').value = t.statusRecv || 'requester';
  document.getElementById('trig-sla').checked = !!t.sla;
  document.getElementById('recv-sla').value = t.slaRecv || 'agent';
  document.getElementById('trig-resolved').checked = !!t.resolved;
  document.getElementById('recv-resolved').value = t.resolvedRecv || 'requester';
  document.getElementById('trig-comment').checked = !!t.comment;
  document.getElementById('recv-comment').value = t.commentRecv || 'both';
  document.getElementById('trig-summary').checked = !!t.summary;
  document.getElementById('recv-summary').value = t.summaryRecv || 'manager';
  document.getElementById('trig-critical').checked = !!t.critical;
  document.getElementById('recv-critical').value = t.criticalRecv || 'manager';
}

function markUnsaved() {
  const s = document.getElementById('email-save-status');
  s.textContent = '● Unsaved changes';
  s.className = 'save-status unsaved';
}

function markSaved() {
  const s = document.getElementById('email-save-status');
  s.textContent = '✓ All changes saved';
  s.className = 'save-status';
  setTimeout(() => { s.textContent = ''; }, 4000);
}

function updateEmailPreview() {
  const tpl = document.getElementById('test-email-template').value;
  const cfg = readEmailFormValues();
  const html = EMAIL_TEMPLATES[tpl] ? EMAIL_TEMPLATES[tpl](cfg) : '<p style="color:var(--text-muted)">Select a template to preview.</p>';
  document.getElementById('email-preview-content').innerHTML = html;
}

function initEmailConfig() {
  const cfg = loadEmailConfig();
  applyEmailConfigToForm(cfg);
  updateEmailPreview();

  // Load custom templates config
  let customTemplates = loadEmailTemplates();

  const tempSelect = document.getElementById('template-select');
  const tempSub = document.getElementById('template-subject');
  const tempHead = document.getElementById('template-header');
  const tempCta = document.getElementById('template-cta');
  const tempBody = document.getElementById('template-body');

  const populateTemplateFields = () => {
    if (!tempSelect) return;
    const key = tempSelect.value;
    const t = customTemplates[key] || TEMPLATE_DEFAULTS[key];
    if (t) {
      if (tempSub) tempSub.value = t.subject || '';
      if (tempHead) tempHead.value = t.header || '';
      if (tempCta) tempCta.value = t.cta || '';
      if (tempBody) tempBody.value = t.body || '';
    }
  };

  if (tempSelect) {
    tempSelect.addEventListener('change', populateTemplateFields);
    populateTemplateFields();
  }

  const updateCurrentTemplate = () => {
    if (!tempSelect) return;
    const key = tempSelect.value;
    if (!customTemplates[key]) customTemplates[key] = {};
    if (tempSub) customTemplates[key].subject = tempSub.value;
    if (tempHead) customTemplates[key].header = tempHead.value;
    if (tempCta) customTemplates[key].cta = tempCta.value;
    if (tempBody) customTemplates[key].body = tempBody.value;
    
    saveEmailTemplates(customTemplates);
    markUnsaved();

    clearTimeout(window._previewTimer);
    window._previewTimer = setTimeout(updateEmailPreview, 400);
  };

  [tempSub, tempHead, tempCta, tempBody].forEach(el => {
    if (el) el.addEventListener('input', updateCurrentTemplate);
  });

  // Settings Tabs
  document.querySelectorAll('.settings-tab[data-stab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab[data-stab]').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.stab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById('stab-' + tab.dataset.stab);
      if (panel) panel.classList.add('active');
    });
  });

  // Password visibility toggle
  document.getElementById('toggle-smtp-pass').addEventListener('click', () => {
    const inp = document.getElementById('smtp-pass');
    const btn = document.getElementById('toggle-smtp-pass');
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
    else { inp.type = 'password'; btn.textContent = '👁'; }
  });

  // Test SMTP connection (simulated)
  document.getElementById('test-smtp-btn').addEventListener('click', () => {
    const btn = document.getElementById('test-smtp-btn');
    const result = document.getElementById('smtp-test-result');
    const badge = document.getElementById('smtp-status-badge');
    btn.disabled = true; btn.textContent = '⏳ Testing…';
    result.className = 'smtp-test-result'; result.textContent = '';
    setTimeout(() => {
      btn.disabled = false; btn.textContent = '🔌 Test Connection';
      const host = document.getElementById('smtp-host').value.trim();
      const port = document.getElementById('smtp-port').value;
      if (!host) {
        result.className = 'smtp-test-result fail';
        result.textContent = '✕ SMTP Host is required';
        badge.className = 'email-status-badge failed';
        badge.innerHTML = '<span class="status-dot dot-offline"></span> Failed';
        return;
      }
      result.className = 'smtp-test-result ok';
      result.textContent = `✓ Connected to ${host}:${port} successfully`;
      badge.className = 'email-status-badge connected';
      badge.innerHTML = '<span class="status-dot dot-online"></span> Connected';
      showToast('SMTP connection verified!', 'success');
    }, 1800);
  });

  // Send test email (simulated)
  document.getElementById('send-test-email-btn').addEventListener('click', () => {
    const addr = document.getElementById('test-email-addr').value.trim();
    if (!addr) { showToast('Enter a recipient email address.', 'error'); return; }
    const btn = document.getElementById('send-test-email-btn');
    btn.disabled = true; btn.textContent = '⏳ Sending…';
    setTimeout(() => {
      btn.disabled = false; btn.textContent = '📨 Send Test Email';
      showToast(`Test email sent to ${addr}!`, 'success');
      addNotification(`Test email successfully sent to ${addr}`);
    }, 1500);
  });

  // Preview template refresh
  document.getElementById('refresh-preview-btn').addEventListener('click', updateEmailPreview);
  document.getElementById('test-email-template').addEventListener('change', updateEmailPreview);

  // Mark unsaved on any change
  document.getElementById('stab-email').addEventListener('change', markUnsaved);
  document.getElementById('stab-email').addEventListener('input', () => {
    markUnsaved();
    // live preview update
    clearTimeout(window._previewTimer);
    window._previewTimer = setTimeout(updateEmailPreview, 400);
  });

  // Save
  document.getElementById('save-email-btn').addEventListener('click', () => {
    const cfg = readEmailFormValues();
    if (!cfg.smtpHost || !cfg.smtpUser || !cfg.fromAddr) {
      showToast('Please fill in all required SMTP and sender fields.', 'error');
      return;
    }
    saveEmailConfigToStorage(cfg);
    markSaved();
    showToast('Email configuration saved!', 'success');
  });

  // Reset to defaults
  document.getElementById('reset-email-btn').addEventListener('click', () => {
    if (!confirm('Reset all email settings to defaults?')) return;
    applyEmailConfigToForm(EMAIL_DEFAULTS);
    saveEmailConfigToStorage(EMAIL_DEFAULTS);
    
    // Reset custom templates as well
    customTemplates = JSON.parse(JSON.stringify(TEMPLATE_DEFAULTS));
    saveEmailTemplates(customTemplates);
    populateTemplateFields();

    markSaved();
    showToast('Email configuration reset to defaults.', 'info');
    updateEmailPreview();
  });
}
