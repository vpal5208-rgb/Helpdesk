/* =============================================
   data.js — Seed data & localStorage helpers
============================================= */

const AGENTS = [
  { id:'a1', name:'Sarah Chen', initials:'SC', role:'Senior Engineer', dept:'Infrastructure', color:'#58a6ff', status:'online', resolved:42, open:5, rating:4.9 },
  { id:'a2', name:'Marcus Rivera', initials:'MR', role:'Support Specialist', dept:'End User Support', color:'#bc8cff', status:'online', resolved:38, open:8, rating:4.7 },
  { id:'a3', name:'Priya Patel', initials:'PP', role:'Security Analyst', dept:'Security', color:'#3fb950', status:'busy', resolved:29, open:3, rating:4.8 },
  { id:'a4', name:'Tom Nakamura', initials:'TN', role:'Network Engineer', dept:'Networking', color:'#d29922', status:'online', resolved:35, open:6, rating:4.6 },
  { id:'a5', name:'Lisa Okonkwo', initials:'LO', role:'Help Desk Lead', dept:'End User Support', color:'#f85149', status:'busy', resolved:51, open:10, rating:4.9 },
  { id:'a6', name:'Alex Dubois', initials:'AD', role:'Systems Admin', dept:'Infrastructure', color:'#26d4b0', status:'offline', resolved:22, open:2, rating:4.5 },
];

const CATEGORIES = ['Network','Hardware','Software','Account','Security','Other'];
const PRIORITIES = ['Critical','High','Medium','Low'];
const STATUSES = ['Open','In Progress','Resolved','Closed'];

const SUBJECTS = [
  'VPN connection dropping intermittently',
  'Cannot access shared network drive',
  'Outlook not syncing emails',
  'Printer offline on 3rd floor',
  'Laptop screen flickering issue',
  'Password reset required immediately',
  'Software license expired',
  'Wi-Fi dropping in conference room B',
  'MS Teams audio issues during calls',
  'New employee account setup needed',
  'Malware detected on workstation',
  'USB ports not working',
  'Slow internet on entire floor',
  'Excel crashing on save',
  'Remote desktop connection refused',
  'Two-factor authentication not working',
  'Monitor not detected after docking',
  'Keyboard/mouse unresponsive',
  'Company website unreachable internally',
  'Zoom camera not working',
  'Backup software failing silently',
  'Email spam filter too aggressive',
  'Cannot install approved software',
  'Server room temperature alarm triggered',
  'Unauthorized access attempt detected',
];

const REQUESTERS = [
  { name:'James Wilson', email:'j.wilson@company.com' },
  { name:'Emily Davis', email:'e.davis@company.com' },
  { name:'Robert Martinez', email:'r.martinez@company.com' },
  { name:'Jennifer Thompson', email:'j.thompson@company.com' },
  { name:'Daniel Garcia', email:'d.garcia@company.com' },
  { name:'Ashley Johnson', email:'a.johnson@company.com' },
  { name:'Christopher Lee', email:'c.lee@company.com' },
  { name:'Amanda White', email:'a.white@company.com' },
  { name:'Kevin Brown', email:'k.brown@company.com' },
  { name:'Stephanie Harris', email:'s.harris@company.com' },
];

const CAT_MAP = {
  'VPN connection dropping intermittently':'Network',
  'Cannot access shared network drive':'Network',
  'Outlook not syncing emails':'Software',
  'Printer offline on 3rd floor':'Hardware',
  'Laptop screen flickering issue':'Hardware',
  'Password reset required immediately':'Account',
  'Software license expired':'Software',
  'Wi-Fi dropping in conference room B':'Network',
  'MS Teams audio issues during calls':'Software',
  'New employee account setup needed':'Account',
  'Malware detected on workstation':'Security',
  'USB ports not working':'Hardware',
  'Slow internet on entire floor':'Network',
  'Excel crashing on save':'Software',
  'Remote desktop connection refused':'Network',
  'Two-factor authentication not working':'Security',
  'Monitor not detected after docking':'Hardware',
  'Keyboard/mouse unresponsive':'Hardware',
  'Company website unreachable internally':'Network',
  'Zoom camera not working':'Hardware',
  'Backup software failing silently':'Software',
  'Email spam filter too aggressive':'Software',
  'Cannot install approved software':'Software',
  'Server room temperature alarm triggered':'Other',
  'Unauthorized access attempt detected':'Security',
};

function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function daysAgo(n){ const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString(); }

function generateSeedTickets(){
  const tickets=[];
  for(let i=1;i<=60;i++){
    const subj=SUBJECTS[(i-1)%SUBJECTS.length];
    const req=REQUESTERS[(i-1)%REQUESTERS.length];
    const daysBack=randInt(0,30);
    const pri=i<=5?'Critical':i<=15?'High':rand(['Medium','Low','High']);
    const cat=CAT_MAP[subj]||rand(CATEGORIES);
    let status;
    if(daysBack>20) status=rand(['Resolved','Closed','Resolved']);
    else if(daysBack>10) status=rand(['In Progress','Resolved','Open']);
    else status=rand(['Open','In Progress','Open','Open']);
    tickets.push({
      id:`TKT-${String(i).padStart(4,'0')}`,
      subject:subj,
      requester:req.name,
      email:req.email,
      category:cat,
      priority:pri,
      status,
      agentId:rand([...AGENTS.map(a=>a.id),'','','']),
      description:`User reported: "${subj}". The issue began approximately ${randInt(1,72)} hours ago and is affecting ${randInt(1,15)} user(s) in the ${rand(['Marketing','Engineering','Finance','HR','Sales','Operations'])} department.`,
      created:daysAgo(daysBack),
      comments:[],
      auditLog:[{action:`Ticket created`,time:daysAgo(daysBack),by:'System'}],
    });
  }
  return tickets;
}

const LS_KEY='hd_tickets_v1';
const LS_SLA='hd_sla_v1';

function updateAgentRatings(tickets) {
  if (!Array.isArray(tickets)) return;
  AGENTS.forEach(ag => {
    const rated = tickets.filter(t => t.agentId === ag.id && typeof t.rating === 'number' && t.rating >= 1 && t.rating <= 5);
    if (rated.length > 0) {
      const sum = rated.reduce((acc, t) => acc + t.rating, 0);
      const baselineCount = 5;
      const baselineRating = ag.baselineRating || ag.rating;
      if (!ag.baselineRating) {
        ag.baselineRating = ag.rating;
      }
      ag.rating = parseFloat(((baselineRating * baselineCount + sum) / (baselineCount + rated.length)).toFixed(1));
    } else {
      if (ag.baselineRating) {
        ag.rating = ag.baselineRating;
      }
    }
  });
}

function loadTickets(){
  let tickets = [];
  try{
    const raw=localStorage.getItem(LS_KEY);
    if(raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        tickets = parsed.filter(Boolean);
      }
    }
  }catch(e){}
  
  if (tickets.length === 0) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      tickets = generateSeedTickets();
      saveTickets(tickets);
    } else {
      saveTickets([]);
    }
  }
  
  updateAgentRatings(tickets);
  return tickets;
}
function saveTickets(tickets){ 
  try {
    localStorage.setItem(LS_KEY,JSON.stringify(tickets)); 
    updateAgentRatings(tickets);
  } catch(e) {
    console.warn("localStorage saveTickets failed:", e);
  }
}

function loadSLA(){
  try{
    const raw=localStorage.getItem(LS_SLA);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return { Critical:2, High:8, Medium:24, Low:72 };
}
function saveSLA(sla){ 
  try {
    localStorage.setItem(LS_SLA,JSON.stringify(sla)); 
  } catch(e) {
    console.warn("localStorage saveSLA failed:", e);
  }
}

/* ===== TICKET ID CUSTOMIZATION ===== */
const LS_TKT_ID = 'hd_tkt_id_config_v1';
const TKT_ID_DEFAULTS = {
  prefix: 'TKT',
  separator: '-',
  dateComp: 'none',
  padding: 4
};

function loadTicketIdConfig() {
  try {
    const r = localStorage.getItem(LS_TKT_ID);
    if (r) return JSON.parse(r);
  } catch(e) {}
  return { ...TKT_ID_DEFAULTS };
}

function saveTicketIdConfig(cfg) {
  try {
    localStorage.setItem(LS_TKT_ID, JSON.stringify(cfg));
  } catch(e) {
    console.warn("localStorage saveTicketIdConfig failed:", e);
  }
}

function generateTicketId(indexVal) {
  const cfg = loadTicketIdConfig();
  let parts = [cfg.prefix];
  
  if (cfg.dateComp !== 'none') {
    const d = new Date();
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    if (cfg.dateComp === 'yyyy') parts.push(yyyy);
    else if (cfg.dateComp === 'yyyymm') parts.push(yyyy + mm);
    else if (cfg.dateComp === 'yyyymmdd') parts.push(yyyy + mm + dd);
  }
  
  const seq = String(indexVal).padStart(parseInt(cfg.padding) || 4, '0');
  parts.push(seq);
  
  return parts.join(cfg.separator);
}

function getSLAHours(priority,sla){
  return sla[priority]||24;
}
function calcSLARemaining(ticket,sla){
  if(['Resolved','Closed'].includes(ticket.status)) return null;
  const created=new Date(ticket.created);
  const now=new Date();
  const elapsedH=(now-created)/3600000;
  const limitH=getSLAHours(ticket.priority,sla);
  return limitH-elapsedH;
}

function getAgentById(id){ return AGENTS.find(a=>a.id===id)||null; }
function getAgentName(id){ const a=getAgentById(id); return a?a.name:'Unassigned'; }

const NOTIFICATIONS=[
  { id:'n1', text:'Critical ticket TKT-0001 has breached SLA', time:'2 min ago', read:false },
  { id:'n2', text:'New ticket assigned to you: TKT-0047', time:'15 min ago', read:false },
  { id:'n3', text:'Sarah Chen resolved 5 tickets today', time:'1 hr ago', read:false },
  { id:'n4', text:'System maintenance scheduled for Sunday 2 AM', time:'3 hrs ago', read:true },
  { id:'n5', text:'Monthly report is ready for download', time:'1 day ago', read:true },
];

/* ===== MOCK EMAIL NOTIFICATION TRIGGERS ===== */
function triggerEmailNotification(triggerType, ticket) {
  try {
    const cfg = JSON.parse(localStorage.getItem('hd_email_config_v1')) || {
      fromName: 'HelpDesk Pro',
      fromAddr: 'noreply@company.com',
      signature: '-- \nHelpDesk Pro | IT Support\nsupport@company.com | +1 (800) 555-0199',
      triggers: {
        newTicket: true, newTicketRecv: 'all',
        assigned: true, assignedRecv: 'agent',
        status: true, statusRecv: 'requester',
        sla: true, slaRecv: 'agent',
        resolved: true, resolvedRecv: 'requester',
        comment: false, commentRecv: 'both',
        summary: false, summaryRecv: 'manager',
        critical: true, criticalRecv: 'manager'
      }
    };

    const triggers = cfg.triggers || {};
    let shouldSend = false;
    let recipientType = 'requester';

    if (triggerType === 'new_ticket' && triggers.newTicket) {
      shouldSend = true;
      recipientType = triggers.newTicketRecv || 'all';
    } else if (triggerType === 'assigned' && triggers.assigned) {
      shouldSend = true;
      recipientType = triggers.assignedRecv || 'agent';
    } else if (triggerType === 'resolved' && triggers.resolved) {
      shouldSend = true;
      recipientType = triggers.resolvedRecv || 'requester';
    } else if (triggerType === 'status' && triggers.status) {
      shouldSend = true;
      recipientType = triggers.statusRecv || 'requester';
    } else if (triggerType === 'comment' && triggers.comment) {
      shouldSend = true;
      recipientType = triggers.commentRecv || 'both';
    }

    if (!shouldSend) return;

    const tpls = JSON.parse(localStorage.getItem('hd_email_templates_custom_v1')) || {};
    const t = tpls[triggerType] || {
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
      status_change: {
        subject: 'Update on Your Ticket {ticketId}: {status}',
        header: 'Ticket Status Updated',
        body: 'The status of your support ticket has been updated to: {status}.',
        cta: 'View Ticket Status'
      }
    }[triggerType === 'status' ? 'status_change' : triggerType];

    if (!t) return;

    const data = {
      ticketId: ticket.id,
      ticketSubject: ticket.subject,
      priority: ticket.priority,
      status: ticket.status,
      requester: ticket.requester
    };

    const replacePlaceholders = (text, data) => {
      if (!text) return '';
      return text
        .replace(/{ticketId}/g, data.ticketId || '')
        .replace(/{subject}/g, data.ticketSubject || '')
        .replace(/{priority}/g, data.priority || '')
        .replace(/{status}/g, data.status || '')
        .replace(/{requester}/g, data.requester || '');
    };

    const subject = replacePlaceholders(t.subject, data);
    const headerTitle = replacePlaceholders(t.header, data);
    const bodyText = replacePlaceholders(t.body, data);
    const ctaText = replacePlaceholders(t.cta, data);

    let recipients = [];
    if (recipientType === 'requester' || recipientType === 'both') {
      recipients.push(ticket.email || `${ticket.requester.toLowerCase().replace(/\s/g, '.')}@company.com`);
    }
    if (recipientType === 'agent' || recipientType === 'both') {
      if (ticket.agentId) {
        const agents = [
          { id:'a1', email:'s.chen@company.com' },
          { id:'a2', email:'m.rivera@company.com' },
          { id:'a3', email:'p.patel@company.com' },
          { id:'a4', email:'t.nakamura@company.com' },
          { id:'a5', email:'l.okonkwo@company.com' },
          { id:'a6', email:'a.dubois@company.com' }
        ];
        const ag = agents.find(x => x.id === ticket.agentId);
        if (ag) recipients.push(ag.email);
      }
    }
    if (recipientType === 'manager') {
      recipients.push('manager@company.com');
    }
    if (recipientType === 'all') {
      recipients.push('all-agents@company.com');
    }

    if (!recipients.length) return;

    recipients.forEach(email => {
      displayMockEmailToast({
        to: email,
        from: `${cfg.fromName} <${cfg.fromAddr}>`,
        subject: subject,
        header: headerTitle,
        body: bodyText,
        cta: ctaText,
        ticketId: ticket.id,
        ticketSubject: ticket.subject,
        priority: ticket.priority,
        status: ticket.status,
        requester: ticket.requester,
        signature: cfg.signature
      });
    });

  } catch(e) {
    console.error("Error sending email notification:", e);
  }
}

function triggerPasswordResetEmail(user, password) {
  try {
    const cfg = JSON.parse(localStorage.getItem('hd_email_config_v1')) || {
      fromName: 'HelpDesk Pro',
      fromAddr: 'noreply@company.com',
      signature: '-- \nHelpDesk Pro | IT Support\nsupport@company.com | +1 (800) 555-0199'
    };

    const recipient = user.email || `${user.fname.toLowerCase()}.${user.lname.toLowerCase()}@company.com`;
    const name = user.fname + ' ' + user.lname;

    displayMockEmailToast({
      to: recipient,
      from: `${cfg.fromName} <${cfg.fromAddr}>`,
      subject: '🔑 Password Reset Notice — HelpDesk Pro',
      header: 'Your Password Has Been Reset',
      body: `Hello ${user.fname},\n\nYour password has been reset by the administrator.\n\nYour new temporary password is: **${password}**\n\nPlease use this to log in to the portal.`,
      cta: 'Go to Portal',
      ticketId: 'SEC-PWD',
      ticketSubject: 'Password Reset Notification',
      priority: 'High',
      status: 'Closed',
      signature: cfg.signature
    });
  } catch(e) {
    console.error("Error sending password reset email:", e);
  }
}

function displayMockEmailToast(mail) {
  const containerId = 'mock-email-toasts-container';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '999999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    container.style.maxWidth = '380px';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);
  }

  const badgeStyles = {
    Critical: 'background:#f85149;color:#fff',
    High: 'background:#d29922;color:#fff',
    Medium: 'background:#3b82f6;color:#fff',
    Low: 'background:#8b949e;color:#fff',
    Open: 'background:#d29922;color:#fff',
    'In Progress': 'background:#3b82f6;color:#fff',
    Resolved: 'background:#3fb950;color:#fff',
    Closed: 'background:#8b949e;color:#fff'
  };
  const priStyle = badgeStyles[mail.priority] || 'background:#6b7280;color:#fff';
  const statusStyle = badgeStyles[mail.status] || 'background:#6b7280;color:#fff';

  const toast = document.createElement('div');
  toast.style.background = 'var(--bg-card, #161b22)';
  toast.style.border = '1px solid var(--border, rgba(255,255,255,0.15))';
  toast.style.borderRadius = '12px';
  toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
  toast.style.padding = '16px';
  toast.style.width = '350px';
  toast.style.pointerEvents = 'auto';
  toast.style.transform = 'translateX(400px)';
  toast.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
  toast.style.fontFamily = 'var(--font, "Inter", sans-serif)';

  toast.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:6px">
      <div style="display:flex;align-items:center;gap:6px;font-size:0.75rem;font-weight:700;color:#58a6ff">
        <span>📧</span> <span>EMAIL NOTIFICATION (MOCK)</span>
      </div>
      <button style="background:none;border:none;color:var(--text-secondary,#8b949e);cursor:pointer;font-size:0.9rem;margin-left:auto" onclick="this.parentElement.parentElement.remove()">✕</button>
    </div>
    <div style="font-size:0.72rem;color:#8b949e;line-height:1.4">
      <div><strong>To:</strong> ${mail.to}</div>
      <div><strong>From:</strong> ${mail.from}</div>
      <div><strong>Subject:</strong> ${mail.subject}</div>
    </div>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:8px 0"/>
    <div style="font-size:0.8rem;line-height:1.4;color:#c9d1d9">
      <p style="margin-bottom:8px;font-weight:700;font-size:0.85rem">${mail.header}</p>
      <p style="margin-bottom:12px">${mail.body}</p>
      
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:8px;margin-bottom:12px">
        <div style="font-weight:700;font-size:0.75rem;color:#58a6ff">${mail.ticketId}</div>
        <div style="font-weight:600;font-size:0.78rem;margin:2px 0 6px">${mail.ticketSubject}</div>
        <div style="display:flex;gap:6px;align-items:center">
          <span style="font-size:0.65rem;padding:2px 6px;border-radius:4px;font-weight:700;${priStyle}">${mail.priority}</span>
          <span style="font-size:0.65rem;padding:2px 6px;border-radius:4px;font-weight:700;${statusStyle}">${mail.status}</span>
        </div>
      </div>
      
      <div style="font-size:0.75rem;color:#8b949e;white-space:pre-line;margin-top:10px">${mail.signature}</div>
    </div>
  `;

  container.appendChild(toast);
  toast.offsetHeight; // Force reflow
  toast.style.transform = 'translateX(0)';

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.transform = 'translateX(400px)';
      setTimeout(() => toast.remove(), 400);
    }
  }, 10000);
}
