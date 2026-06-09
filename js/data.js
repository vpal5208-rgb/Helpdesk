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

function loadTickets(){
  try{
    const raw=localStorage.getItem(LS_KEY);
    if(raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    }
  }catch(e){}
  const seed=generateSeedTickets();
  saveTickets(seed);
  return seed;
}
function saveTickets(tickets){ localStorage.setItem(LS_KEY,JSON.stringify(tickets)); }

function loadSLA(){
  try{
    const raw=localStorage.getItem(LS_SLA);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return { Critical:2, High:8, Medium:24, Low:72 };
}
function saveSLA(sla){ localStorage.setItem(LS_SLA,JSON.stringify(sla)); }

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
  localStorage.setItem(LS_TKT_ID, JSON.stringify(cfg));
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
