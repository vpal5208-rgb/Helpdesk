/* =============================================
   dashboard.js — Charts, KPIs, Activity feed
============================================= */

let activityFeed = [];

// Global metadata for chart elements to enable interactivity
const chartMetadata = {};

function updateDashboard() {
  updateKPIs();
  renderVolumeChart();
  renderPriorityChart();
  renderCategoryChart();
  renderLeaderboard();
  renderActivityFeed();
  renderMonthlyChart();
  renderResolutionChart();
  renderAgentPerfChart();
  
  // Initialize interactivity event listeners once
  initDashboardInteractivity();
}

// ====== KPIs ======
function updateKPIs() {
  const sla = loadSLA();
  const open = allTickets.filter(t => t.status === 'Open').length;
  const today = new Date().toDateString();
  const resolved = allTickets.filter(t => t.status === 'Resolved' && new Date(t.created).toDateString() === today).length;
  const breach = allTickets.filter(t => {
    const r = calcSLARemaining(t, sla);
    return r !== null && r < 0;
  }).length;
  const avgResp = 4.2; // simulated
  const total = allTickets.length;
  const activeAgents = AGENTS.filter(a => a.status !== 'offline').length;

  animateCount('kpi-open', open);
  animateCount('kpi-resolved', resolved);
  animateCount('kpi-breach', breach);
  document.getElementById('kpi-avg').textContent = avgResp + 'h';
  animateCount('kpi-total', total);
  animateCount('kpi-agents', activeAgents);

  document.getElementById('kpi-open-trend').textContent = '↑ 12% vs last week';
  document.getElementById('kpi-resolved-trend').textContent = '↑ 8% vs yesterday';
  document.getElementById('kpi-breach-trend').textContent = breach > 0 ? `↑ ${breach} active breach${breach>1?'es':''}` : '✓ All within SLA';
  document.getElementById('kpi-avg-trend').textContent = '↓ 0.3h from last week';
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const duration = 600;
  const step = (timestamp) => {
    if (!step.start) step.start = timestamp;
    const progress = Math.min((timestamp - step.start) / duration, 1);
    el.textContent = Math.round(start + (target - start) * easeOut(progress));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

// ====== VOLUME CHART ======
function renderVolumeChart() {
  const canvas = document.getElementById('chart-volume');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const labels = getLast7Days();
  const created = getLast7DayCounts('created');
  const resolvedD = getLast7DayCounts('resolved');
  drawLineChart(ctx, canvas, labels, [
    { data: created, color: '#58a6ff', fill: true },
    { data: resolvedD, color: '#3fb950', fill: true },
  ]);
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
  }
  return days;
}

function getLast7DayCounts(type) {
  const counts = new Array(7).fill(0);
  allTickets.forEach(t => {
    const created = new Date(t.created);
    const now = new Date();
    const diff = Math.round((now - created) / 86400000);
    const idx = 6 - diff;
    if (idx >= 0 && idx < 7) {
      if (type === 'created') counts[idx]++;
      else if (type === 'resolved' && t.status === 'Resolved') counts[idx]++;
    }
  });
  return counts;
}

function drawLineChart(ctx, canvas, labels, datasets) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const parentWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
  canvas.width = Math.max(0, (rect.width || parentWidth) * dpr);
  canvas.height = Math.max(0, (canvas.getAttribute('height') || 200) * dpr);
  ctx.scale(dpr, dpr);
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;

  const pad = { top: 20, right: 20, bottom: 36, left: 44 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const allVals = datasets.flatMap(d => d.data);
  const maxVal = Math.max(...allVals, 1);

  ctx.clearRect(0, 0, w, h);

  // Initialize/clear metadata for interactivity
  const chartId = canvas.id;
  chartMetadata[chartId] = { points: [] };

  // Grid lines
  const isDark = document.documentElement.dataset.theme !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const textColor = isDark ? '#8b949e' : '#636c76';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + ch - (i / 4) * ch;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y);
    ctx.strokeStyle = gridColor; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = textColor; ctx.font = '11px Inter,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round((i / 4) * maxVal), pad.left - 6, y + 4);
  }

  // Labels
  labels.forEach((lbl, i) => {
    const x = pad.left + (i / (labels.length - 1)) * cw;
    ctx.fillStyle = textColor; ctx.font = '11px Inter,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(lbl, x, h - 8);
  });

  datasets.forEach((ds, dsIndex) => {
    const pts = ds.data.map((v, i) => ({
      x: pad.left + (i / (ds.data.length - 1)) * cw,
      y: pad.top + ch - (v / maxVal) * ch,
    }));

    // Store point coordinates for interactivity
    pts.forEach((p, i) => {
      chartMetadata[chartId].points.push({
        x: p.x,
        y: p.y,
        value: ds.data[i],
        date: labels[i],
        type: dsIndex === 0 ? 'Created' : 'Resolved'
      });
    });

    if (ds.fill) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pad.top + ch);
      pts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(pts[pts.length - 1].x, pad.top + ch);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(ds.color, 0.12);
      ctx.fill();
    }

    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = ds.color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = ds.color; ctx.fill();
      ctx.strokeStyle = isDark ? '#161b22' : '#fff'; ctx.lineWidth = 2; ctx.stroke();
    });
  });
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ====== PRIORITY DONUT ======
function renderPriorityChart() {
  const canvas = document.getElementById('chart-priority');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = {
    Critical: allTickets.filter(t=>t.priority==='Critical').length,
    High: allTickets.filter(t=>t.priority==='High').length,
    Medium: allTickets.filter(t=>t.priority==='Medium').length,
    Low: allTickets.filter(t=>t.priority==='Low').length,
  };
  const colors = ['#f85149','#d29922','#58a6ff','#8b949e'];
  drawDonutChart(ctx, canvas, Object.keys(data), Object.values(data), colors);
}

function drawDonutChart(ctx, canvas, labels, data, colors) {
  const dpr = window.devicePixelRatio || 1;
  const parentWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 200;
  const size = Math.max(0, Math.min(parentWidth - 40, 200));
  if (size <= 0) return;
  canvas.width = size * dpr; canvas.height = size * dpr;
  ctx.scale(dpr, dpr);
  const cx = size/2, cy = size/2, r = size/2 - 20, inner = r * 0.55;
  const total = data.reduce((s,v)=>s+v,0) || 1;
  let angle = -Math.PI/2;
  ctx.clearRect(0,0,size,size);

  const chartId = canvas.id;
  chartMetadata[chartId] = {
    cx, cy, r, inner,
    slices: []
  };

  data.forEach((val,i) => {
    const sweep = (val/total) * Math.PI * 2;
    
    // Store slice details for interactivity
    chartMetadata[chartId].slices.push({
      startAngle: angle,
      endAngle: angle + sweep,
      value: val,
      label: labels[i],
      color: colors[i]
    });

    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,angle,angle+sweep);
    ctx.closePath();
    ctx.fillStyle = colors[i]; ctx.fill();
    angle += sweep;
  });

  // Inner hole
  ctx.beginPath();
  ctx.arc(cx,cy,inner,0,Math.PI*2);
  const isDark = document.documentElement.dataset.theme !== 'light';
  ctx.fillStyle = isDark ? '#161b22' : '#ffffff';
  ctx.fill();

  // Center text
  ctx.fillStyle = isDark ? '#e6edf3' : '#1f2328';
  ctx.font = `bold ${size*0.13}px Inter,sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(total, cx, cy-8);
  ctx.font = `${size*0.07}px Inter,sans-serif`;
  ctx.fillStyle = isDark ? '#8b949e' : '#636c76';
  ctx.fillText('tickets', cx, cy+12);

  // Render a responsive HTML legend at the bottom of the card container
  const filterType = chartId === 'chart-priority' ? 'priority' : 'status';
  createHtmlLegend(canvas, labels, data, colors, filterType);
}

// ====== CATEGORY BAR ======
function renderCategoryChart() {
  const canvas = document.getElementById('chart-category');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cats = CATEGORIES;
  const vals = cats.map(c => allTickets.filter(t=>t.category===c).length);
  const colors = ['#58a6ff','#3fb950','#d29922','#bc8cff','#f85149','#26d4b0'];
  drawBarChart(ctx, canvas, cats, vals, colors, true);
}

function drawBarChart(ctx, canvas, labels, data, colors, horizontal=false) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const parentWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
  canvas.width = Math.max(0, (rect.width || parentWidth) * dpr);
  canvas.height = Math.max(0, (canvas.getAttribute('height') || 220) * dpr);
  ctx.scale(dpr, dpr);
  const w = canvas.width/dpr, h = canvas.height/dpr;
  const pad = { top:12, right:16, bottom:12, left:80 };
  const cw = w-pad.left-pad.right, ch = h-pad.top-pad.bottom;
  const maxVal = Math.max(...data,1);
  const isDark = document.documentElement.dataset.theme !== 'light';
  const textColor = isDark ? '#8b949e':'#636c76';
  ctx.clearRect(0,0,w,h);

  const chartId = canvas.id;
  chartMetadata[chartId] = { bars: [] };

  const barH = ch / labels.length * 0.6;
  const gap = ch / labels.length;

  labels.forEach((lbl,i)=>{
    const y = pad.top + i*gap + gap/2 - barH/2;
    const bw = (data[i]/maxVal)*cw;

    // Store bar coordinates for interactivity
    chartMetadata[chartId].bars.push({
      yStart: y,
      yEnd: y + barH,
      xStart: pad.left,
      xEnd: pad.left + bw,
      value: data[i],
      label: lbl
    });

    ctx.fillStyle = hexToRgba(colors[i%colors.length],0.15);
    ctx.fillRect(pad.left, y, cw, barH);
    ctx.fillStyle = colors[i%colors.length];
    ctx.fillRect(pad.left, y, bw, barH);
    ctx.fillStyle = textColor; ctx.font='11px Inter,sans-serif'; ctx.textAlign='right';
    ctx.fillText(lbl, pad.left-6, y+barH/2+4);
    ctx.fillStyle = isDark?'#e6edf3':'#1f2328'; ctx.textAlign='left';
    ctx.fillText(data[i], pad.left+bw+6, y+barH/2+4);
  });
}


// ====== LEADERBOARD ======
function renderLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  if (!list) return;
  const sorted = [...AGENTS].sort((a,b)=>b.resolved-a.resolved);
  list.innerHTML = '';
  sorted.slice(0,5).forEach((ag,i) => {
    const ranks = ['🥇','🥈','🥉','4','5'];
    const rankCls = ['gold','silver','bronze','',''][i];
    const div = document.createElement('div');
    div.className='lb-item';
    div.innerHTML=`<div class="lb-rank ${rankCls}">${ranks[i]}</div>
      <div class="lb-avatar" style="background:${ag.color}">${ag.initials}</div>
      <div class="lb-info"><div class="lb-name">${ag.name}</div><div class="lb-sub">${ag.dept}</div></div>
      <div class="lb-score">${ag.resolved}</div>`;
    list.appendChild(div);
  });
}

// ====== ACTIVITY FEED ======
const defaultActivities = [
  { icon:'🎫', text:'Ticket <strong>TKT-0001</strong> marked as critical', time:'2 min ago' },
  { icon:'✅', text:'<strong>Sarah Chen</strong> resolved TKT-0035: VPN issue', time:'18 min ago' },
  { icon:'🔔', text:'SLA breach alert for TKT-0012', time:'35 min ago' },
  { icon:'👤', text:'New user <strong>Emily Davis</strong> submitted request', time:'1 hr ago' },
  { icon:'🔒', text:'TKT-0028 closed after resolution confirmed', time:'2 hrs ago' },
  { icon:'✏', text:'TKT-0041 reassigned to <strong>Marcus Rivera</strong>', time:'3 hrs ago' },
];

function renderActivityFeed() {
  const list = document.getElementById('activity-list');
  if (!list) return;
  const items = [...activityFeed, ...defaultActivities].slice(0,8);
  list.innerHTML = '';
  items.forEach(a => {
    const div = document.createElement('div');
    div.className='activity-item';
    div.innerHTML=`<div class="activity-icon">${a.icon}</div><div class="activity-text"><div>${a.text}</div><div class="activity-time">${a.time}</div></div>`;
    list.appendChild(div);
  });
}

function addActivity(icon, text) {
  activityFeed.unshift({ icon, text, time:'just now' });
  if (activityFeed.length > 10) activityFeed.pop();
  renderActivityFeed();
}

// ====== REPORTS CHARTS ======
function renderMonthlyChart() {
  const canvas = document.getElementById('chart-monthly');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const months = ['Dec','Jan','Feb','Mar','Apr','May'];
  const data = [28,35,42,38,45,52];
  const resolved = [22,30,38,32,40,48];
  drawLineChart(ctx, canvas, months, [
    { data, color:'#58a6ff', fill:true },
    { data:resolved, color:'#3fb950', fill:true },
  ]);
}

function renderResolutionChart() {
  const canvas = document.getElementById('chart-resolution');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = {
    Resolved: allTickets.filter(t=>t.status==='Resolved').length,
    Closed: allTickets.filter(t=>t.status==='Closed').length,
    Open: allTickets.filter(t=>t.status==='Open').length,
    'In Progress': allTickets.filter(t=>t.status==='In Progress').length,
  };
  const colors = ['#3fb950','#8b949e','#58a6ff','#d29922'];
  drawDonutChart(ctx, canvas, Object.keys(data), Object.values(data), colors);
}

function renderAgentPerfChart() {
  const canvas = document.getElementById('chart-agent-perf');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const names = AGENTS.map(a=>a.name.split(' ')[0]);
  const vals = AGENTS.map(a=>a.resolved);
  const colors = AGENTS.map(a=>a.color);
  drawBarChart(ctx, canvas, names, vals, colors, true);
}

// ====== AGENTS VIEW ======
function renderAgentsView() {
  const grid = document.getElementById('agents-grid');
  if (!grid) return;
  grid.innerHTML = `
    <div style="grid-column: 1 / -1; padding: 48px; text-align: center; color: var(--text-secondary); background: var(--bg-surface); border: 1px dashed var(--border); border-radius: var(--radius); display: flex; flex-direction: column; align-items: center; gap: 12px; margin: 16px 0; width: 100%;">
      <span style="font-size: 2.5rem;">👥</span>
      <div style="font-weight: 600; color: var(--text-primary); font-size: 1.1rem;">No Agents Available</div>
      <p style="margin: 0; font-size: 0.85rem; max-width: 320px; color: var(--text-secondary);">There are no support agents registered in the overview list at this time.</p>
    </div>
  `;
}

/* ====== REPORTS EXPORT & CUSTOM REPORTS ====== */
const TICKET_COLUMNS = [
  { key: 'id', name: 'ID' },
  { key: 'subject', name: 'Subject' },
  { key: 'requester', name: 'Requester' },
  { key: 'email', name: 'Email' },
  { key: 'category', name: 'Category' },
  { key: 'priority', name: 'Priority' },
  { key: 'status', name: 'Status' },
  { key: 'agent', name: 'Assigned To' },
  { key: 'created', name: 'Created Date' },
  { key: 'sla', name: 'SLA Status' }
];

const ASSET_COLUMNS = [
  { key: 'id', name: 'Asset Tag' },
  { key: 'name', name: 'Asset Name' },
  { key: 'model', name: 'Model' },
  { key: 'category', name: 'Category' },
  { key: 'status', name: 'Status' },
  { key: 'serial', name: 'Serial Number' },
  { key: 'vendor', name: 'Vendor' },
  { key: 'assignedTo', name: 'Assigned To' },
  { key: 'purchaseDate', name: 'Purchase Date' },
  { key: 'warranty', name: 'Warranty' }
];

const AUDIT_COLUMNS = [
  { key: 'time', name: 'Date & Time' },
  { key: 'id', name: 'Ref ID' },
  { key: 'by', name: 'Actor' },
  { key: 'action', name: 'Action Details' },
  { key: 'subject', name: 'Subject/Context' },
  { key: 'type', name: 'Type' }
];

const USER_COLUMNS = [
  { key: 'name', name: 'Full Name' },
  { key: 'email', name: 'Email' },
  { key: 'dept', name: 'Department' },
  { key: 'role', name: 'Role' },
  { key: 'status', name: 'Status' },
  { key: 'ticketsCount', name: 'Tickets Count' },
  { key: 'lastActive', name: 'Last Active' },
  { key: 'created', name: 'Created Date' }
];

let activeReportTab = 'standard';
let currentGeneratedReportData = null;

function initReports() {
  const csvBtn = document.getElementById('export-reports-csv-btn');
  const pdfBtn = document.getElementById('export-reports-pdf-btn');
  const reportsToggle = document.getElementById('reports-orientation-toggle');
  
  // Custom Reports Tab Navigation
  const viewTabs = document.getElementById('reports-view-tabs');
  if (viewTabs) {
    viewTabs.addEventListener('click', e => {
      const btn = e.target.closest('.settings-tab');
      if (!btn) return;
      viewTabs.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      toggleReportViews(btn.dataset.reportView);
    });
  }

  // Custom Reports event bindings
  const sourceSel = document.getElementById('custom-report-source');
  if (sourceSel) {
    sourceSel.addEventListener('change', rebuildCustomReportBuilder);
  }
  
  const generateBtn = document.getElementById('btn-custom-report-generate');
  if (generateBtn) {
    generateBtn.addEventListener('click', generateCustomReport);
  }
  
  const resetBtn = document.getElementById('btn-custom-report-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetCustomReportFilters);
  }

  if (csvBtn) {
    csvBtn.addEventListener('click', () => {
      if (activeReportTab === 'standard') {
        exportReportsToCSV();
      } else {
        exportCustomReportToCSV();
      }
    });
  }
  
  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      window.print();
    });
  }
  
  if (reportsToggle) {
    reportsToggle.addEventListener('click', e => {
      const btn = e.target.closest('.toggle-btn');
      if (!btn) return;
      reportsToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const grid = document.querySelector('.reports-grid');
      if (grid) {
        if (btn.dataset.orientation === 'list') {
          grid.classList.add('list-orientation');
        } else {
          grid.classList.remove('list-orientation');
        }
      }
      
      // Re-render charts to fit the updated dimensions
      setTimeout(() => {
        try {
          renderMonthlyChart();
          renderResolutionChart();
          renderAgentPerfChart();
        } catch (err) {}
      }, 150);
    });
  }
}

function toggleReportViews(view) {
  activeReportTab = view;
  const standardContainer = document.getElementById('reports-standard-container');
  const customContainer = document.getElementById('reports-custom-container');
  const orientationToggle = document.getElementById('reports-orientation-toggle');
  
  if (view === 'standard') {
    if (standardContainer) standardContainer.style.display = 'block';
    if (customContainer) customContainer.style.display = 'none';
    if (orientationToggle) orientationToggle.style.display = 'flex';
  } else {
    if (standardContainer) standardContainer.style.display = 'none';
    if (customContainer) customContainer.style.display = 'block';
    if (orientationToggle) orientationToggle.style.display = 'none';
    
    rebuildCustomReportBuilder();
  }
}

function renderCustomColumnsChecklist(columns) {
  const container = document.getElementById('custom-report-columns');
  if (!container) return;
  container.innerHTML = columns.map(c => `
    <label class="user-checkbox-label" style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:0;font-size:0.85rem">
      <input type="checkbox" name="custom-col" value="${c.key}" checked style="width:auto;margin:0;"/>
      <span>${c.name}</span>
    </label>
  `).join('');
}

function rebuildCustomReportBuilder() {
  const source = document.getElementById('custom-report-source').value;
  const filtersContainer = document.getElementById('custom-report-filters');
  
  // Rebuild columns
  let cols = [];
  if (source === 'tickets') cols = TICKET_COLUMNS;
  else if (source === 'assets') cols = ASSET_COLUMNS;
  else if (source === 'audit') cols = AUDIT_COLUMNS;
  else if (source === 'users') cols = USER_COLUMNS;
  renderCustomColumnsChecklist(cols);
  
  // Rebuild filters
  if (!filtersContainer) return;
  filtersContainer.innerHTML = '';
  
  if (source === 'tickets') {
    // Status
    const statusDiv = document.createElement('div');
    statusDiv.className = 'form-group';
    statusDiv.innerHTML = `
      <label>Status</label>
      <select id="cr-filter-status" class="form-input">
        <option value="">All Statuses</option>
        <option>Open</option>
        <option>In Progress</option>
        <option>Resolved</option>
        <option>Closed</option>
      </select>
    `;
    filtersContainer.appendChild(statusDiv);
    
    // Priority
    const priDiv = document.createElement('div');
    priDiv.className = 'form-group';
    priDiv.innerHTML = `
      <label>Priority</label>
      <select id="cr-filter-priority" class="form-input">
        <option value="">All Priorities</option>
        <option>Critical</option>
        <option>High</option>
        <option>Medium</option>
        <option>Low</option>
      </select>
    `;
    filtersContainer.appendChild(priDiv);
    
    // Category
    const catDiv = document.createElement('div');
    catDiv.className = 'form-group';
    catDiv.innerHTML = `
      <label>Category</label>
      <select id="cr-filter-category" class="form-input">
        <option value="">All Categories</option>
        ${(typeof CATEGORIES !== 'undefined' ? CATEGORIES : []).map(c => `<option>${c}</option>`).join('')}
      </select>
    `;
    filtersContainer.appendChild(catDiv);
    
    // Agent
    const agentDiv = document.createElement('div');
    agentDiv.className = 'form-group';
    agentDiv.innerHTML = `
      <label>Agent</label>
      <select id="cr-filter-agent" class="form-input">
        <option value="">All Agents</option>
      </select>
    `;
    filtersContainer.appendChild(agentDiv);
    
  } else if (source === 'assets') {
    // Status
    const statusDiv = document.createElement('div');
    statusDiv.className = 'form-group';
    statusDiv.innerHTML = `
      <label>Status</label>
      <select id="cr-filter-status" class="form-input">
        <option value="">All Statuses</option>
        <option>Ready to Deploy</option>
        <option>Deployed</option>
        <option>Archived</option>
      </select>
    `;
    filtersContainer.appendChild(statusDiv);
    
    // Category
    const catDiv = document.createElement('div');
    catDiv.className = 'form-group';
    catDiv.innerHTML = `
      <label>Category</label>
      <select id="cr-filter-category" class="form-input">
        <option value="">All Categories</option>
        <option>Hardware</option>
        <option>Software</option>
      </select>
    `;
    filtersContainer.appendChild(catDiv);
    
    // Vendor
    const vendors = (typeof loadVendors === 'function') ? loadVendors() : [];
    const vendorNames = [...new Set(vendors.map(v => v.name))];
    const vendDiv = document.createElement('div');
    vendDiv.className = 'form-group';
    vendDiv.innerHTML = `
      <label>Vendor</label>
      <select id="cr-filter-vendor" class="form-input">
        <option value="">All Vendors</option>
        ${vendorNames.map(v => `<option>${v}</option>`).join('')}
      </select>
    `;
    filtersContainer.appendChild(vendDiv);
    
  } else if (source === 'audit') {
    // Action Type
    const actionDiv = document.createElement('div');
    actionDiv.className = 'form-group';
    actionDiv.innerHTML = `
      <label>Action Type</label>
      <select id="cr-filter-action" class="form-input">
        <option value="">All Action Types</option>
        <option value="created">Created</option>
        <option value="status">Status Changes</option>
        <option value="assigned">Assignments</option>
        <option value="comment">Comments / Notes</option>
        <option value="escalated">Escalated</option>
        <option value="closed">Closed</option>
        <option value="asset">Asset Operations</option>
      </select>
    `;
    filtersContainer.appendChild(actionDiv);
    
    // Actor Search
    const actorDiv = document.createElement('div');
    actorDiv.className = 'form-group';
    actorDiv.innerHTML = `
      <label>Actor Name</label>
      <input type="text" id="cr-filter-actor" class="form-input" placeholder="e.g. Sarah Chen"/>
    `;
    filtersContainer.appendChild(actorDiv);
    
  } else if (source === 'users') {
    // Status
    const statusDiv = document.createElement('div');
    statusDiv.className = 'form-group';
    statusDiv.innerHTML = `
      <label>Status</label>
      <select id="cr-filter-status" class="form-input">
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
        <option value="pending">Pending</option>
      </select>
    `;
    filtersContainer.appendChild(statusDiv);
    
    // Department
    const deptsList = typeof DEPTS !== 'undefined' ? DEPTS : ['Engineering','Marketing','Finance','HR','Sales','Operations','Design','Legal'];
    const deptDiv = document.createElement('div');
    deptDiv.className = 'form-group';
    deptDiv.innerHTML = `
      <label>Department</label>
      <select id="cr-filter-dept" class="form-input">
        <option value="">All Departments</option>
        ${deptsList.map(d => `<option>${d}</option>`).join('')}
      </select>
    `;
    filtersContainer.appendChild(deptDiv);
    
    // Role
    const roles = (typeof loadRoles === 'function') ? loadRoles() : [];
    const roleDiv = document.createElement('div');
    roleDiv.className = 'form-group';
    roleDiv.innerHTML = `
      <label>Role</label>
      <select id="cr-filter-role" class="form-input">
        <option value="">All Roles</option>
        ${roles.map(r => `<option value="${r.key}">${r.name}</option>`).join('')}
      </select>
    `;
    filtersContainer.appendChild(roleDiv);
  }
}

function generateCustomReport() {
  const source = document.getElementById('custom-report-source').value;
  const startDateVal = document.getElementById('custom-report-start-date').value;
  const endDateVal = document.getElementById('custom-report-end-date').value;
  
  const startDate = startDateVal ? new Date(startDateVal) : null;
  const endDate = endDateVal ? new Date(endDateVal) : null;
  if (endDate) endDate.setHours(23, 59, 59, 999);
  
  const checkedCheckboxes = document.querySelectorAll('input[name="custom-col"]:checked');
  const activeColumns = Array.from(checkedCheckboxes).map(cb => cb.value);
  
  if (activeColumns.length === 0) {
    if (typeof showToast === 'function') {
      showToast('Please select at least one column to display.', 'error');
    } else {
      alert('Please select at least one column to display.');
    }
    return;
  }
  
  let rawData = [];
  if (source === 'tickets') {
    rawData = loadTickets();
  } else if (source === 'assets') {
    rawData = (typeof loadAssets === 'function') ? loadAssets() : [];
  } else if (source === 'audit') {
    const tickets = loadTickets();
    const ticketsAudits = [];
    tickets.forEach(t => {
      if (Array.isArray(t.auditLog)) {
        t.auditLog.forEach(log => {
          ticketsAudits.push({
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
    const systemLogs = (typeof loadSystemAuditLogs === 'function') ? loadSystemAuditLogs() : [];
    const systemAudits = systemLogs.map(log => ({
      id: log.refId || 'System',
      subject: log.type === 'asset' ? 'Asset Action' : 'System Action',
      time: log.time,
      by: log.by || 'System',
      action: log.action,
      type: log.type || 'asset'
    }));
    rawData = [...ticketsAudits, ...systemAudits];
    rawData.sort((a, b) => new Date(b.time) - new Date(a.time));
  } else if (source === 'users') {
    rawData = (typeof loadUsers === 'function') ? loadUsers() : [];
  }
  
  const filtered = rawData.filter(item => {
    // 1. Date filter
    let itemDate = null;
    if (source === 'tickets') itemDate = new Date(item.created);
    else if (source === 'assets') itemDate = item.purchaseDate ? new Date(item.purchaseDate) : null;
    else if (source === 'audit') itemDate = new Date(item.time);
    else if (source === 'users') itemDate = item.created ? new Date(item.created) : null;
    
    if (itemDate) {
      if (startDate && itemDate < startDate) return false;
      if (endDate && itemDate > endDate) return false;
    } else if (startDate || endDate) {
      return false;
    }
    
    // 2. Source-specific filters
    if (source === 'tickets') {
      const fStatus = document.getElementById('cr-filter-status').value;
      const fPriority = document.getElementById('cr-filter-priority').value;
      const fCategory = document.getElementById('cr-filter-category').value;
      const fAgent = document.getElementById('cr-filter-agent').value;
      
      if (fStatus && item.status !== fStatus) return false;
      if (fPriority && item.priority !== fPriority) return false;
      if (fCategory && item.category !== fCategory) return false;
      if (fAgent && item.agentId !== fAgent) return false;
      
    } else if (source === 'assets') {
      const fStatus = document.getElementById('cr-filter-status').value;
      const fCategory = document.getElementById('cr-filter-category').value;
      const fVendor = document.getElementById('cr-filter-vendor').value;
      
      if (fStatus && item.status !== fStatus) return false;
      if (fCategory && item.category !== fCategory) return false;
      if (fVendor && item.vendor !== fVendor) return false;
      
    } else if (source === 'audit') {
      const fAction = document.getElementById('cr-filter-action').value;
      const fActor = document.getElementById('cr-filter-actor').value.trim().toLowerCase();
      
      if (fAction) {
        if (fAction === 'asset') {
          if (item.type !== 'asset') return false;
        } else {
          if (item.type !== 'ticket') return false;
          const act = item.action.toLowerCase();
          if (fAction === 'created' && !act.includes('created') && !act.includes('submitted')) return false;
          if (fAction === 'status' && !act.includes('status changed')) return false;
          if (fAction === 'assigned' && !act.includes('assigned')) return false;
          if (fAction === 'comment' && !act.includes('comment') && !act.includes('note')) return false;
          if (fAction === 'escalated' && !act.includes('escalated')) return false;
          if (fAction === 'closed' && !act.includes('closed')) return false;
        }
      }
      if (fActor && !item.by.toLowerCase().includes(fActor)) return false;
      
    } else if (source === 'users') {
      const fStatus = document.getElementById('cr-filter-status').value;
      const fDept = document.getElementById('cr-filter-dept').value;
      const fRole = document.getElementById('cr-filter-role').value;
      
      if (fStatus && item.status !== fStatus) return false;
      if (fDept && item.dept !== fDept) return false;
      if (fRole && item.role !== fRole) return false;
    }
    
    return true;
  });
  
  currentGeneratedReportData = {
    source,
    columns: activeColumns,
    records: filtered
  };
  
  renderCustomReportPreview();
}

function renderCustomReportPreview() {
  const panel = document.getElementById('custom-report-preview-panel');
  const label = document.getElementById('custom-report-preview-label');
  const thead = document.getElementById('custom-report-preview-thead');
  const tbody = document.getElementById('custom-report-preview-tbody');
  
  if (!panel || !label || !thead || !tbody || !currentGeneratedReportData) return;
  
  const { source, columns, records } = currentGeneratedReportData;
  
  label.textContent = `${records.length} record${records.length === 1 ? '' : 's'} matching criteria`;
  panel.style.display = 'block';
  
  let allCols = [];
  if (source === 'tickets') allCols = TICKET_COLUMNS;
  else if (source === 'assets') allCols = ASSET_COLUMNS;
  else if (source === 'audit') allCols = AUDIT_COLUMNS;
  else if (source === 'users') allCols = USER_COLUMNS;
  
  const activeColObjs = columns.map(k => allCols.find(c => c.key === k)).filter(Boolean);
  
  thead.innerHTML = `<tr>${activeColObjs.map(c => `<th>${c.name}</th>`).join('')}</tr>`;
  
  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${activeColObjs.length}" style="text-align:center;color:var(--text-muted);padding:30px">No matching records found.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = records.map(item => {
    const cells = activeColObjs.map(col => {
      let val = '';
      
      if (source === 'tickets') {
        if (col.key === 'id') val = `<span class="ticket-id">${item.id}</span>`;
        else if (col.key === 'subject') val = `<span class="ticket-subject" title="${item.subject}">${item.subject}</span>`;
        else if (col.key === 'agent') val = item.agentId ? getAgentName(item.agentId) : '<span style="color:var(--text-muted)">Unassigned</span>';
        else if (col.key === 'created') val = new Date(item.created).toLocaleDateString();
        else if (col.key === 'sla') {
          const sla = loadSLA();
          const slaRem = calcSLARemaining(item, sla);
          if (slaRem === null) val = '<span class="sla-ok">—</span>';
          else if (slaRem < 0) val = `<span class="sla-breach">⚠ Breached</span>`;
          else if (slaRem < 2) val = `<span class="sla-warn">${slaRem.toFixed(1)}h left</span>`;
          else val = `<span class="sla-ok">${slaRem.toFixed(0)}h left</span>`;
        }
        else if (col.key === 'status') {
          const cls = { 'Open':'badge-open','In Progress':'badge-inprogress','Resolved':'badge-resolved','Closed':'badge-closed' }[item.status];
          val = `<span class="badge ${cls||''}">${item.status}</span>`;
        }
        else if (col.key === 'priority') {
          const cls = { 'Critical':'badge-critical','High':'badge-high','Medium':'badge-medium','Low':'badge-low' }[item.priority];
          val = `<span class="badge ${cls||''}">${item.priority}</span>`;
        }
        else val = item[col.key] || '—';
        
      } else if (source === 'assets') {
        if (col.key === 'id') val = `<span style="font-family:monospace;font-weight:700;">${item.id}</span>`;
        else if (col.key === 'warranty') val = item.warrantyMonths ? `${item.warrantyMonths} months` : '—';
        else if (col.key === 'purchaseDate') val = item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : '—';
        else if (col.key === 'assignedTo') val = item.assignedTo || '<span style="color:var(--text-muted)">Unassigned</span>';
        else if (col.key === 'status') {
          const dot = item.status === 'Ready to Deploy' ? 'online' : item.status === 'Deployed' ? 'busy' : 'offline';
          val = `<span style="display:flex;align-items:center;gap:6px"><span class="status-dot dot-${dot}"></span>${item.status}</span>`;
        }
        else val = item[col.key] || '—';
        
      } else if (source === 'audit') {
        if (col.key === 'time') val = new Date(item.time).toLocaleString();
        else if (col.key === 'id') val = `<span style="font-family:monospace;font-weight:700;">${item.id}</span>`;
        else if (col.key === 'action') val = `<div style="font-weight:600">${item.action}</div>`;
        else val = item[col.key] || '—';
        
      } else if (source === 'users') {
        if (col.key === 'name') val = `<strong>${item.fname} ${item.lname}</strong>`;
        else if (col.key === 'ticketsCount') {
          const count = (typeof userTicketCount === 'function') ? userTicketCount(item.email) : 0;
          val = `<span style="font-weight:600">${count}</span>`;
        }
        else if (col.key === 'lastActive') {
          const la = (typeof lastActiveLabel === 'function') ? lastActiveLabel(item.lastActive) : { label: item.lastActive || '—', cls: 'dot-offline' };
          val = `<span style="display:inline-flex;align-items:center;gap:6px"><span class="activity-dot ${la.cls}"></span>${la.label}</span>`;
        }
        else if (col.key === 'created') val = item.created ? new Date(item.created).toLocaleDateString() : '—';
        else if (col.key === 'status') {
          const cls = { active:'badge-active', suspended:'badge-suspended', pending:'badge-pending' }[item.status]||'';
          val = `<span class="badge ${cls}">${item.status.charAt(0).toUpperCase()+item.status.slice(1)}</span>`;
        }
        else if (col.key === 'role') {
          const roles = (typeof loadRoles === 'function') ? loadRoles() : [];
          const roleObj = roles.find(r => r.key === item.role) || { name: item.role, color: 'gray' };
          let badgeStyle = '';
          if (roleObj.color === 'red') badgeStyle = 'background:var(--red-glow);color:var(--accent-red);';
          else if (roleObj.color === 'blue') badgeStyle = 'background:var(--blue-glow);color:var(--accent-blue);';
          else if (roleObj.color === 'green') badgeStyle = 'background:var(--green-glow);color:var(--accent-green);';
          else if (roleObj.color === 'orange') badgeStyle = 'background:var(--orange-glow);color:var(--accent-orange);';
          else if (roleObj.color === 'purple') badgeStyle = 'background:var(--purple-glow);color:var(--accent-purple);';
          else badgeStyle = 'background:var(--bg-elevated);color:var(--text-secondary);';
          val = `<span class="role-pill" style="${badgeStyle}">${roleObj.name}</span>`;
        }
        else val = item[col.key] || '—';
      }
      
      return `<td>${val}</td>`;
    }).join('');
    
    return `<tr>${cells}</tr>`;
  }).join('');
}

function resetCustomReportFilters() {
  document.getElementById('custom-report-start-date').value = '';
  document.getElementById('custom-report-end-date').value = '';
  
  const source = document.getElementById('custom-report-source').value;
  if (source === 'tickets') {
    document.getElementById('cr-filter-status').value = '';
    document.getElementById('cr-filter-priority').value = '';
    document.getElementById('cr-filter-category').value = '';
    document.getElementById('cr-filter-agent').value = '';
  } else if (source === 'assets') {
    document.getElementById('cr-filter-status').value = '';
    document.getElementById('cr-filter-category').value = '';
    document.getElementById('cr-filter-vendor').value = '';
  } else if (source === 'audit') {
    document.getElementById('cr-filter-action').value = '';
    document.getElementById('cr-filter-actor').value = '';
  } else if (source === 'users') {
    document.getElementById('cr-filter-status').value = '';
    document.getElementById('cr-filter-dept').value = '';
    document.getElementById('cr-filter-role').value = '';
  }
}

function exportCustomReportToCSV() {
  if (!currentGeneratedReportData || currentGeneratedReportData.records.length === 0) {
    if (typeof showToast === 'function') {
      showToast('No report data available to export. Please generate a report first.', 'warning');
    } else {
      alert('No report data available to export. Please generate a report first.');
    }
    return;
  }
  
  const { source, columns, records } = currentGeneratedReportData;
  
  let allCols = [];
  if (source === 'tickets') allCols = TICKET_COLUMNS;
  else if (source === 'assets') allCols = ASSET_COLUMNS;
  else if (source === 'audit') allCols = AUDIT_COLUMNS;
  else if (source === 'users') allCols = USER_COLUMNS;
  
  const activeColObjs = columns.map(k => allCols.find(c => c.key === k)).filter(Boolean);
  
  let csvContent = activeColObjs.map(c => `"${c.name.replace(/"/g, '""')}"`).join(',') + '\r\n';
  
  records.forEach(item => {
    const rowStr = activeColObjs.map(col => {
      let val = '';
      if (source === 'tickets') {
        if (col.key === 'agent') val = item.agentId ? getAgentName(item.agentId) : 'Unassigned';
        else if (col.key === 'created') val = new Date(item.created).toISOString();
        else if (col.key === 'sla') {
          const sla = loadSLA();
          const slaRem = calcSLARemaining(item, sla);
          if (slaRem === null) val = '—';
          else if (slaRem < 0) val = 'Breached';
          else val = `${slaRem.toFixed(1)}h left`;
        }
        else val = item[col.key] || '';
      } else if (source === 'assets') {
        if (col.key === 'warranty') val = item.warrantyMonths ? `${item.warrantyMonths} months` : '';
        else if (col.key === 'purchaseDate') val = item.purchaseDate || '';
        else val = item[col.key] || '';
      } else if (source === 'audit') {
        if (col.key === 'time') val = new Date(item.time).toISOString();
        else val = item[col.key] || '';
      } else if (source === 'users') {
        if (col.key === 'name') val = `${item.fname} ${item.lname}`;
        else if (col.key === 'ticketsCount') val = (typeof userTicketCount === 'function') ? userTicketCount(item.email) : 0;
        else if (col.key === 'lastActive') val = item.lastActive || 'Never';
        else val = item[col.key] || '';
      }
      
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
    
    csvContent += rowStr + '\r\n';
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `HelpDesk_Custom_Report_${source}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof showToast === 'function') {
    showToast("Custom Report CSV downloaded!", "success");
  }
}

function exportReportsToCSV() {
  const tickets = loadTickets();
  const agents = AGENTS;
  
  let csvContent = "--- MONTHLY TICKET TREND ---\r\n";
  csvContent += "Month,Volume\r\n";
  const monthlyData = {};
  tickets.forEach(t => {
    const month = new Date(t.created).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    monthlyData[month] = (monthlyData[month] || 0) + 1;
  });
  Object.entries(monthlyData).forEach(([m, count]) => {
    csvContent += `"${m}",${count}\r\n`;
  });
  csvContent += "\r\n";
  
  csvContent += "--- TICKET STATUS DISTRIBUTION ---\r\n";
  csvContent += "Status,Count\r\n";
  const statusData = { 'Open': 0, 'In Progress': 0, 'Resolved': 0, 'Closed': 0 };
  tickets.forEach(t => {
    if (statusData[t.status] !== undefined) statusData[t.status]++;
  });
  Object.entries(statusData).forEach(([status, count]) => {
    csvContent += `"${status}",${count}\r\n`;
  });
  csvContent += "\r\n";
  
  csvContent += "--- AGENT PERFORMANCE METRICS ---\r\n";
  csvContent += "Agent Name,Email,Assigned Tickets,Open,Resolved\r\n";
  agents.forEach(a => {
    const assigned = tickets.filter(t => t.agentId === a.id);
    const open = assigned.filter(t => ['Open', 'In Progress'].includes(t.status)).length;
    const resolved = assigned.filter(t => ['Resolved', 'Closed'].includes(t.status)).length;
    csvContent += `"${a.name}","${a.email}",${assigned.length},${open},${resolved}\r\n`;
  });
  
  const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "HelpDesk_Analytics_Report.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof showToast === 'function') {
    showToast("Reports CSV downloaded!", "success");
  }
}

/* ====== DASHBOARD INTERACTIVITY ====== */
function filterTicketsAndNavigate(filterType, filterValue) {
  // Clear other filters first
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-priority').value = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-agent').value = '';
  document.getElementById('ticket-search').value = '';

  if (filterType === 'status') {
    document.getElementById('filter-status').value = filterValue;
  } else if (filterType === 'priority') {
    document.getElementById('filter-priority').value = filterValue;
  } else if (filterType === 'category') {
    document.getElementById('filter-category').value = filterValue;
  } else if (filterType === 'agent') {
    document.getElementById('filter-agent').value = filterValue;
  } else if (filterType === 'sla') {
    document.getElementById('ticket-search').value = 'breach';
  }

  applyFilters();
  navigateTo('tickets');
}

function createHtmlLegend(canvas, labels, values, colors, filterType) {
  let legend = canvas.parentElement.querySelector('.custom-html-legend');
  if (!legend) {
    legend = document.createElement('div');
    legend.className = 'custom-html-legend';
    legend.style.display = 'flex';
    legend.style.justifyContent = 'center';
    legend.style.flexWrap = 'wrap';
    legend.style.gap = '12px';
    legend.style.marginTop = '12px';
    canvas.parentElement.appendChild(legend);
  }

  legend.innerHTML = labels.map((lbl, i) => {
    return `<div class="legend-item" style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--text-secondary,#8b949e);cursor:pointer;" onclick="filterTicketsAndNavigate('${filterType}', '${lbl}')">
      <span style="width:8px;height:8px;border-radius:50%;background:${colors[i]};display:inline-block"></span>
      <span class="legend-label" style="font-weight:600">${lbl}</span>
      <span class="legend-value" style="color:var(--text-muted,#6b7280)">(${values[i]})</span>
    </div>`;
  }).join('');
}

let dashboardInteractivityInitialized = false;

function initDashboardInteractivity() {
  if (dashboardInteractivityInitialized) return;
  
  // Bind KPI cards click listeners
  const openCard = document.getElementById('kpi-open')?.closest('.kpi-card');
  if (openCard) openCard.onclick = () => filterTicketsAndNavigate('status', 'Open');

  const resolvedCard = document.getElementById('kpi-resolved')?.closest('.kpi-card');
  if (resolvedCard) resolvedCard.onclick = () => filterTicketsAndNavigate('status', 'Resolved');

  const breachCard = document.getElementById('kpi-breach')?.closest('.kpi-card');
  if (breachCard) breachCard.onclick = () => filterTicketsAndNavigate('sla');

  const totalCard = document.getElementById('kpi-total')?.closest('.kpi-card');
  if (totalCard) totalCard.onclick = () => filterTicketsAndNavigate('all');

  const agentsCard = document.getElementById('kpi-agents')?.closest('.kpi-card');
  if (agentsCard) agentsCard.onclick = () => navigateTo('agents');

  const avgCard = document.getElementById('kpi-avg')?.closest('.kpi-card');
  if (avgCard) avgCard.onclick = () => navigateTo('reports');

  // Set up listeners for canvases
  const canvases = ['chart-volume', 'chart-priority', 'chart-category', 'chart-monthly', 'chart-resolution', 'chart-agent-perf'];
  
  canvases.forEach(id => {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    
    canvas.addEventListener('mousemove', e => handleChartMouseMove(e, canvas));
    canvas.addEventListener('mouseleave', () => hideChartTooltip(canvas));
    canvas.addEventListener('click', e => handleChartClick(e, canvas));
  });

  dashboardInteractivityInitialized = true;
}

function handleChartMouseMove(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  const tooltip = document.getElementById('chart-tooltip');
  if (!tooltip) return;
  
  let hoveredElement = null;
  let tooltipHtml = '';
  
  const id = canvas.id;
  const meta = chartMetadata[id];
  
  if (id === 'chart-volume' || id === 'chart-monthly') {
    if (meta && meta.points) {
      let closestDist = Infinity;
      let closestPt = null;
      meta.points.forEach(pt => {
        const dx = mouseX - pt.x;
        const dy = mouseY - pt.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestPt = pt;
        }
      });
      if (closestPt && closestDist <= 15) {
        hoveredElement = closestPt;
        tooltipHtml = `<strong>${closestPt.type || 'Volume'}</strong>Date: ${closestPt.date}<br>Tickets: ${closestPt.value}`;
      }
    }
  } else if (id === 'chart-priority' || id === 'chart-resolution') {
    if (meta && meta.slices) {
      const dx = mouseX - meta.cx;
      const dy = mouseY - meta.cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist >= meta.inner && dist <= meta.r) {
        let mouseAngle = Math.atan2(dy, dx);
        if (mouseAngle < -Math.PI / 2) {
          mouseAngle += 2 * Math.PI;
        }
        
        meta.slices.forEach(slice => {
          let start = slice.startAngle;
          let end = slice.endAngle;
          
          let normMouse = mouseAngle - (-Math.PI/2);
          if (normMouse < 0) normMouse += 2 * Math.PI;
          if (normMouse >= 2 * Math.PI) normMouse -= 2 * Math.PI;
          
          let normStart = start - (-Math.PI/2);
          if (normStart < 0) normStart += 2 * Math.PI;
          
          let normEnd = end - (-Math.PI/2);
          if (normEnd < 0) normEnd += 2 * Math.PI;
          if (normEnd === 0) normEnd = 2 * Math.PI;
          
          let match = false;
          if (normStart <= normEnd) {
            match = normMouse >= normStart && normMouse <= normEnd;
          } else {
            match = normMouse >= normStart || normMouse <= normEnd;
          }
          
          if (match) {
            hoveredElement = slice;
            tooltipHtml = `<strong>${slice.label}</strong>Tickets: ${slice.value}`;
          }
        });
      }
    }
  } else if (id === 'chart-category' || id === 'chart-agent-perf') {
    if (meta && meta.bars) {
      meta.bars.forEach(bar => {
        if (mouseY >= bar.yStart && mouseY <= bar.yEnd && mouseX >= bar.xStart && mouseX <= bar.xEnd) {
          hoveredElement = bar;
          tooltipHtml = `<strong>${bar.label}</strong>Tickets: ${bar.value}`;
        }
      });
    }
  }
  
  if (hoveredElement) {
    canvas.classList.add('clickable');
    tooltip.innerHTML = tooltipHtml;
    tooltip.style.display = 'block';
    tooltip.style.left = (e.clientX + 12) + 'px';
    tooltip.style.top = (e.clientY + 12) + 'px';
  } else {
    canvas.classList.remove('clickable');
    tooltip.style.display = 'none';
  }
}

function hideChartTooltip(canvas) {
  canvas.classList.remove('clickable');
  const tooltip = document.getElementById('chart-tooltip');
  if (tooltip) tooltip.style.display = 'none';
}

function handleChartClick(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  const id = canvas.id;
  const meta = chartMetadata[id];
  
  if (id === 'chart-volume' || id === 'chart-monthly') {
    if (meta && meta.points) {
      let closestDist = Infinity;
      let closestPt = null;
      meta.points.forEach(pt => {
        const dx = mouseX - pt.x;
        const dy = mouseY - pt.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestPt = pt;
        }
      });
      if (closestPt && closestDist <= 15) {
        const statusVal = closestPt.type === 'Resolved' ? 'Resolved' : 'Open';
        filterTicketsAndNavigate('status', statusVal);
      }
    }
  } else if (id === 'chart-priority' || id === 'chart-resolution') {
    if (meta && meta.slices) {
      const dx = mouseX - meta.cx;
      const dy = mouseY - meta.cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist >= meta.inner && dist <= meta.r) {
        let mouseAngle = Math.atan2(dy, dx);
        if (mouseAngle < -Math.PI / 2) {
          mouseAngle += 2 * Math.PI;
        }
        
        meta.slices.forEach(slice => {
          let start = slice.startAngle;
          let end = slice.endAngle;
          
          let normMouse = mouseAngle - (-Math.PI/2);
          if (normMouse < 0) normMouse += 2 * Math.PI;
          if (normMouse >= 2 * Math.PI) normMouse -= 2 * Math.PI;
          
          let normStart = start - (-Math.PI/2);
          if (normStart < 0) normStart += 2 * Math.PI;
          
          let normEnd = end - (-Math.PI/2);
          if (normEnd < 0) normEnd += 2 * Math.PI;
          
          let match = false;
          if (normStart <= normEnd) {
            match = normMouse >= normStart && normMouse <= normEnd;
          } else {
            match = normMouse >= normStart || normMouse <= normEnd;
          }
          
          if (match) {
            const filterType = id === 'chart-priority' ? 'priority' : 'status';
            filterTicketsAndNavigate(filterType, slice.label);
          }
        });
      }
    }
  } else if (id === 'chart-category' || id === 'chart-agent-perf') {
    if (meta && meta.bars) {
      meta.bars.forEach(bar => {
        if (mouseY >= bar.yStart && mouseY <= bar.yEnd && mouseX >= bar.xStart && mouseX <= bar.xEnd) {
          if (id === 'chart-category') {
            filterTicketsAndNavigate('category', bar.label);
          } else {
            const ag = AGENTS.find(a => a.name.startsWith(bar.label));
            if (ag) {
              filterTicketsAndNavigate('agent', ag.id);
            }
          }
        }
      });
    }
  }
}

window.filterTicketsAndNavigate = filterTicketsAndNavigate;

