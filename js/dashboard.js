/* =============================================
   dashboard.js — Charts, KPIs, Activity feed
============================================= */

let activityFeed = [];

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

  datasets.forEach(ds => {
    const pts = ds.data.map((v, i) => ({
      x: pad.left + (i / (ds.data.length - 1)) * cw,
      y: pad.top + ch - (v / maxVal) * ch,
    }));

    if (ds.fill) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pad.top + ch);
      pts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(pts[pts.length - 1].x, pad.top + ch);
      ctx.closePath();
      ctx.fillStyle = ds.color.replace('#', 'rgba(') + ',0.12)'; // rough alpha
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

  data.forEach((val,i) => {
    const sweep = (val/total) * Math.PI * 2;
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

  // Legend below
  const legendY = size - 2;
  const lw = size / labels.length;
  labels.forEach((lbl,i) => {
    const x = i * lw + lw/2;
    ctx.beginPath(); ctx.arc(x-20,legendY-4,5,0,Math.PI*2); ctx.fillStyle=colors[i]; ctx.fill();
    ctx.fillStyle = isDark ? '#8b949e' : '#636c76';
    ctx.font = `${size*0.07}px Inter,sans-serif`; ctx.textAlign='left';
    ctx.fillText(lbl, x-12, legendY);
  });
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

  const barH = ch / labels.length * 0.6;
  const gap = ch / labels.length;

  labels.forEach((lbl,i)=>{
    const y = pad.top + i*gap + gap/2 - barH/2;
    const bw = (data[i]/maxVal)*cw;
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
  grid.innerHTML = '';
  AGENTS.forEach(ag => {
    const open = allTickets.filter(t=>t.agentId===ag.id&&t.status==='Open').length;
    const dotCls = ag.status==='online'?'dot-online':ag.status==='busy'?'dot-busy':'dot-offline';
    const card = document.createElement('div');
    card.className='agent-card';
    card.innerHTML=`
      <div class="agent-avatar-lg" style="background:linear-gradient(135deg,${ag.color},${ag.color}aa)">${ag.initials}</div>
      <div class="agent-name">${ag.name}</div>
      <div class="agent-role">${ag.role}</div>
      <div class="agent-dept">${ag.dept}</div>
      <div class="agent-stats">
        <div class="agent-stat"><div class="agent-stat-val">${ag.resolved}</div><div class="agent-stat-lbl">Resolved</div></div>
        <div class="agent-stat"><div class="agent-stat-val">${open}</div><div class="agent-stat-lbl">Open</div></div>
        <div class="agent-stat"><div class="agent-stat-val">${ag.rating}</div><div class="agent-stat-lbl">Rating</div></div>
      </div>
      <div class="agent-status"><span class="status-dot ${dotCls}"></span>${ag.status.charAt(0).toUpperCase()+ag.status.slice(1)}</div>`;
    grid.appendChild(card);
  });
}

/* ====== REPORTS EXPORT ====== */
function initReports() {
  const csvBtn = document.getElementById('export-reports-csv-btn');
  const pdfBtn = document.getElementById('export-reports-pdf-btn');
  const reportsToggle = document.getElementById('reports-orientation-toggle');
  
  if (csvBtn) csvBtn.addEventListener('click', exportReportsToCSV);
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
