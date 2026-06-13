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

