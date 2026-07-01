/* software.js — Software license allocation, tracking, and AMC renewals */

// Initialize Software Management
function initSoftware() {
  // Bind tab navigation inside software modal
  document.querySelectorAll('#software-modal-tabs .settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#software-modal-tabs .settings-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const targetId = tab.dataset.tab;
      document.querySelectorAll('#software-modal .modal-tab-content').forEach(content => {
        content.style.display = content.id === targetId ? 'block' : 'none';
      });
    });
  });

  // AMC Toggle change event
  const amcToggle = document.getElementById('sm-amc-enabled');
  if (amcToggle) {
    amcToggle.addEventListener('change', (e) => {
      const amcFields = document.getElementById('sm-amc-fields');
      if (amcFields) {
        amcFields.style.display = e.target.checked ? 'flex' : 'none';
      }
      updateModalAMCStatusBadge();
    });
  }

  // Real-time calculation of AMC status badge in modal
  ['sm-amc-end', 'sm-amc-enabled'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateModalAMCStatusBadge);
  });

  // Modal Cancel/Close buttons
  ['software-modal-cancel', 'software-modal-close'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      document.getElementById('software-modal-overlay').classList.remove('open');
    });
  });

  // Modal Save button
  document.getElementById('software-modal-save')?.addEventListener('click', saveSoftwareForm);

  // Add Software button click
  document.getElementById('btn-add-software')?.addEventListener('click', () => openSoftwareModal());

  // Search and Filters
  ['software-search', 'software-filter-category', 'software-filter-amc'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => renderSoftwareView());
    document.getElementById(id)?.addEventListener('change', () => renderSoftwareView());
  });

  // Allocation Modal Close buttons
  ['software-alloc-modal-close'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      document.getElementById('software-alloc-modal-overlay').classList.remove('open');
    });
  });

  // Assign license seat click
  document.getElementById('btn-alloc-save')?.addEventListener('click', () => {
    const sId = document.getElementById('alloc-software-id').value;
    const uId = document.getElementById('alloc-user-select').value;
    if (sId && uId) {
      assignSeat(sId, uId);
    } else {
      showToast('❌ Please select a user to assign.', 'error');
    }
  });

  // Check AMC contract warnings on application load
  checkSoftwareAMCAlerts();
}

// Calculate software contract AMC status details
function getSoftwareAMCStatus(s) {
  if (!s.amcEnabled) {
    return { label: 'None', class: 'badge-gray' };
  }
  if (!s.amcEnd) {
    return { label: 'Active', class: 'badge-green' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(s.amcEnd);
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: 'Expired', class: 'badge-red', days: diffDays };
  } else if (diffDays <= 30) {
    return { label: 'Expiring Soon', class: 'badge-orange', days: diffDays };
  } else {
    return { label: 'Active', class: 'badge-green', days: diffDays };
  }
}

// Update modal AMC badge in real-time
function updateModalAMCStatusBadge() {
  const amcToggle = document.getElementById('sm-amc-enabled');
  const badge = document.getElementById('sm-amc-status-badge');
  if (!badge) return;

  if (!amcToggle || !amcToggle.checked) {
    badge.textContent = 'None';
    badge.className = 'badge badge-gray';
    return;
  }

  const endDateVal = document.getElementById('sm-amc-end')?.value;
  if (!endDateVal) {
    badge.textContent = 'Active';
    badge.className = 'badge badge-green';
    return;
  }

  const status = getSoftwareAMCStatus({ amcEnabled: true, amcEnd: endDateVal });
  badge.textContent = status.label;
  badge.className = `badge ${status.class.replace('badge-', 'badge-')}`; // standard badge class styling
  if (status.label === 'Expiring Soon') {
    badge.classList.add('badge-orange');
  }
}

// Render Software view table & KPIs
function renderSoftwareView() {
  const sList = loadSoftware();
  const aList = loadSoftwareAssignments();

  // 1. Calculate and animate KPI stats
  const totalSoftware = sList.length;
  let totalAllocated = 0;
  let totalSeats = 0;
  let amcAlertsCount = 0;
  let totalSpending = 0;

  sList.forEach(s => {
    const qty = parseInt(s.quantity) || 0;
    totalSeats += qty;

    const assignedCount = aList.filter(a => a.softwareId === s.id).length;
    totalAllocated += assignedCount;

    const status = getSoftwareAMCStatus(s);
    if (status.label === 'Expired' || status.label === 'Expiring Soon') {
      amcAlertsCount++;
    }

    // Cost formula: purchase cost per seat (if cost is per seat) * quantity, plus AMC charges and renewal charges if tracking is active
    const licenseCost = (parseFloat(s.cost) || 0) * qty;
    const amcCharges = s.amcEnabled ? (parseFloat(s.amcCost) || 0) : 0;
    const renewalCharges = s.amcEnabled ? (parseFloat(s.renewalCost) || 0) : 0;
    totalSpending += licenseCost + amcCharges + renewalCharges;
  });

  // Animate stats values
  animateCounter('kpi-software-total', totalSoftware);
  document.getElementById('kpi-software-allocated').textContent = `${totalAllocated} / ${totalSeats}`;
  animateCounter('kpi-software-amc-alerts', amcAlertsCount);
  document.getElementById('kpi-software-cost').textContent = `₹${totalSpending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // 2. Filter list
  const query = (document.getElementById('software-search')?.value || '').toLowerCase();
  const categoryFilter = document.getElementById('software-filter-category')?.value || '';
  const amcFilter = document.getElementById('software-filter-amc')?.value || '';

  const filtered = sList.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(query) ||
      s.vendor.toLowerCase().includes(query) ||
      (s.licenseKey && s.licenseKey.toLowerCase().includes(query)) ||
      s.id.toLowerCase().includes(query);

    const matchesCategory = !categoryFilter || s.category === categoryFilter;

    let matchesAmc = true;
    if (amcFilter) {
      const statusObj = getSoftwareAMCStatus(s);
      if (amcFilter === 'none') matchesAmc = !s.amcEnabled;
      else if (amcFilter === 'active') matchesAmc = s.amcEnabled && statusObj.label === 'Active';
      else if (amcFilter === 'expiring') matchesAmc = s.amcEnabled && statusObj.label === 'Expiring Soon';
      else if (amcFilter === 'expired') matchesAmc = s.amcEnabled && statusObj.label === 'Expired';
    }

    return matchesSearch && matchesCategory && matchesAmc;
  });

  // 3. Render table body
  const tbody = document.getElementById('software-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 30px; color: var(--text-secondary); font-style: italic;">
          No software applications found matching filters.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(s => {
    const assignedSeats = aList.filter(a => a.softwareId === s.id).length;
    const totalSeatsLimit = parseInt(s.quantity) || 0;
    const seatsDisplay = `${assignedSeats} / ${totalSeatsLimit}`;

    const amcStatus = getSoftwareAMCStatus(s);
    let amcBadgeHTML = '';
    if (s.amcEnabled) {
      let titleMsg = '';
      if (amcStatus.label === 'Expired') titleMsg = `Expired on ${s.amcEnd}`;
      else if (amcStatus.label === 'Expiring Soon') titleMsg = `Expires in ${amcStatus.days} days (${s.amcEnd})`;
      else titleMsg = `Valid until ${s.amcEnd}`;

      let badgeColor = '';
      if (amcStatus.label === 'Expired') badgeColor = 'background:var(--red-glow);color:var(--accent-red);';
      else if (amcStatus.label === 'Expiring Soon') badgeColor = 'background:var(--orange-glow);color:var(--accent-orange);';
      else badgeColor = 'background:var(--green-glow);color:var(--accent-green);';

      amcBadgeHTML = `<span class="role-pill" style="${badgeColor} font-size:0.75rem; padding: 2px 8px; font-weight:600;" title="${titleMsg}">${amcStatus.label}</span>`;
    } else {
      amcBadgeHTML = `<span class="role-pill" style="background:var(--bg-elevated);color:var(--text-secondary); font-size:0.75rem; padding: 2px 8px;" title="No contract tracked">None</span>`;
    }

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    tr.innerHTML = `
      <td style="padding: 12px; font-family: monospace; font-weight: 700; color: var(--text-secondary);">${s.id}</td>
      <td style="padding: 12px; font-weight: 600; color: var(--text-primary);">${escapeHTML(s.name)}</td>
      <td style="padding: 12px; color: var(--text-secondary);">${escapeHTML(s.vendor)}</td>
      <td style="padding: 12px; color: var(--text-secondary);">${escapeHTML(s.version || 'N/A')}</td>
      <td style="padding: 12px; color: var(--text-secondary);"><span class="badge badge-gray" style="font-size:0.75rem;">${s.category}</span></td>
      <td style="padding: 12px; color: var(--text-primary); font-weight: 600;">${seatsDisplay}</td>
      <td style="padding: 12px; color: var(--text-primary);">₹${(parseFloat(s.cost) || 0).toFixed(2)}</td>
      <td style="padding: 12px;">${amcBadgeHTML}</td>
      <td style="padding: 12px; text-align: right;">
        <button class="btn btn-ghost btn-sm btn-manage-allocs" onclick="openAllocationsModal('${s.id}')" title="Allocate seats to users" style="padding:4px 8px; font-size:0.8rem; margin-right:4px;">👥 Licenses</button>
        <button class="btn btn-ghost btn-sm btn-edit-software" onclick="openSoftwareModal('${s.id}')" title="Edit details" style="padding:4px 8px; font-size:0.8rem; margin-right:4px;">✏ Edit</button>
        <button class="btn btn-ghost btn-sm btn-delete-software" onclick="deleteSoftware('${s.id}')" title="Delete application" style="padding:4px 8px; font-size:0.8rem; color: var(--accent-red);">🗑 Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Animate numbers inside dashboard/KPIs
function animateCounter(elementId, targetValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  let currentVal = parseInt(el.textContent) || 0;
  if (currentVal === targetValue) {
    el.textContent = targetValue;
    return;
  }
  
  const diff = targetValue - currentVal;
  const duration = 300; // ms
  const steps = 15;
  const increment = Math.ceil(diff / steps) || (diff > 0 ? 1 : -1);
  const stepTime = Math.abs(Math.floor(duration / steps));
  
  let timer = setInterval(() => {
    currentVal += increment;
    if ((increment > 0 && currentVal >= targetValue) || (increment < 0 && currentVal <= targetValue)) {
      el.textContent = targetValue;
      clearInterval(timer);
    } else {
      el.textContent = currentVal;
    }
  }, stepTime);
}

// Open Software Edit/Add Modal
function openSoftwareModal(id = null) {
  const modal = document.getElementById('software-modal-overlay');
  if (!modal) return;

  // Reset tab selection
  document.querySelectorAll('#software-modal-tabs .settings-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('#software-modal-tabs .settings-tab[data-tab="smodal-general"]').classList.add('active');
  document.getElementById('smodal-general').style.display = 'block';
  document.getElementById('smodal-amc').style.display = 'none';

  // Fields resets
  document.getElementById('sm-id').value = id || '';
  document.getElementById('sm-name').value = '';
  document.getElementById('sm-vendor').value = '';
  document.getElementById('sm-version').value = '';
  document.getElementById('sm-category').value = 'Productivity';
  document.getElementById('sm-key').value = '';
  document.getElementById('sm-quantity').value = '';
  document.getElementById('sm-cost').value = '';
  document.getElementById('sm-purchase-date').value = '';
  
  document.getElementById('sm-amc-enabled').checked = false;
  document.getElementById('sm-amc-fields').style.display = 'none';
  document.getElementById('sm-amc-vendor').value = '';
  document.getElementById('sm-amc-contract').value = '';
  document.getElementById('sm-amc-start').value = '';
  document.getElementById('sm-amc-end').value = '';
  document.getElementById('sm-amc-cost').value = '';
  document.getElementById('sm-renewal-cost').value = '';
  document.getElementById('sm-amc-details').value = '';

  if (id) {
    // Edit Mode
    document.getElementById('software-modal-title').textContent = '✏ Edit Software';
    const sList = loadSoftware();
    const s = sList.find(x => x.id === id);
    if (s) {
      document.getElementById('sm-name').value = s.name || '';
      document.getElementById('sm-vendor').value = s.vendor || '';
      document.getElementById('sm-version').value = s.version || '';
      document.getElementById('sm-category').value = s.category || 'Productivity';
      document.getElementById('sm-key').value = s.licenseKey || '';
      document.getElementById('sm-quantity').value = s.quantity || '';
      document.getElementById('sm-cost').value = s.cost || '';
      document.getElementById('sm-purchase-date').value = s.purchaseDate || '';
      
      const hasAmc = !!s.amcEnabled;
      document.getElementById('sm-amc-enabled').checked = hasAmc;
      document.getElementById('sm-amc-fields').style.display = hasAmc ? 'flex' : 'none';
      document.getElementById('sm-amc-vendor').value = s.amcVendor || '';
      document.getElementById('sm-amc-contract').value = s.amcContract || '';
      document.getElementById('sm-amc-start').value = s.amcStart || '';
      document.getElementById('sm-amc-end').value = s.amcEnd || '';
      document.getElementById('sm-amc-cost').value = s.amcCost || '';
      document.getElementById('sm-renewal-cost').value = s.renewalCost || '';
      document.getElementById('sm-amc-details').value = s.amcDetails || '';
    }
  } else {
    // Add Mode
    document.getElementById('software-modal-title').textContent = '➕ Add Software Application';
  }

  updateModalAMCStatusBadge();
  modal.classList.add('open');
}

// Save Software Form
function saveSoftwareForm() {
  const id = document.getElementById('sm-id').value;
  const name = document.getElementById('sm-name').value.trim();
  const vendor = document.getElementById('sm-vendor').value.trim();
  const version = document.getElementById('sm-version').value.trim();
  const category = document.getElementById('sm-category').value;
  const licenseKey = document.getElementById('sm-key').value.trim();
  const quantity = parseInt(document.getElementById('sm-quantity').value);
  const cost = parseFloat(document.getElementById('sm-cost').value);
  const purchaseDate = document.getElementById('sm-purchase-date').value;

  const amcEnabled = document.getElementById('sm-amc-enabled').checked;
  const amcVendor = document.getElementById('sm-amc-vendor').value.trim();
  const amcContract = document.getElementById('sm-amc-contract').value.trim();
  const amcStart = document.getElementById('sm-amc-start').value;
  const amcEnd = document.getElementById('sm-amc-end').value;
  const amcCost = parseFloat(document.getElementById('sm-amc-cost').value) || 0;
  const renewalCost = parseFloat(document.getElementById('sm-renewal-cost').value) || 0;
  const amcDetails = document.getElementById('sm-amc-details').value.trim();

  // Validations
  if (!name || !vendor || isNaN(quantity) || quantity < 1 || isNaN(cost) || cost < 0) {
    showToast('❌ Please fill in all required fields marked with * with valid positive numbers.', 'error');
    return;
  }

  const sList = loadSoftware();
  let updatedSoft = null;

  if (id) {
    // Update existing record
    const idx = sList.findIndex(x => x.id === id);
    if (idx !== -1) {
      sList[idx] = {
        ...sList[idx],
        name, vendor, version, category, licenseKey, quantity, cost, purchaseDate,
        amcEnabled, amcVendor, amcContract, amcStart, amcEnd, amcCost, renewalCost, amcDetails
      };
      updatedSoft = sList[idx];
    }
  } else {
    // Generate new unique ID SFT-XXXX
    let nextNum = 1;
    if (sList.length > 0) {
      const ids = sList.map(s => {
        const match = s.id.match(/^SFT-(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      });
      nextNum = Math.max(...ids) + 1;
    }
    const newId = `SFT-${String(nextNum).padStart(4, '0')}`;
    
    updatedSoft = {
      id: newId,
      name, vendor, version, category, licenseKey, quantity, cost, purchaseDate,
      amcEnabled, amcVendor, amcContract, amcStart, amcEnd, amcCost, renewalCost, amcDetails
    };
    sList.push(updatedSoft);
  }

  saveSoftware(sList);
  
  // Log to Audit Trail
  const actor = typeof getCurrentActorName === 'function' ? getCurrentActorName() : 'System';
  const actionMsg = id 
    ? `📝 Updated software application ${updatedSoft.id}: ${name} (${vendor})`
    : `💾 Created software application ${updatedSoft.id}: ${name} (${vendor}) with ${quantity} licenses`;
  addAuditLog(actionMsg, actor, updatedSoft.id, 'software');

  showToast(id ? 'Software updated successfully!' : 'Software application added successfully!', 'success');
  document.getElementById('software-modal-overlay').classList.remove('open');
  renderSoftwareView();
}

// Delete Software
function deleteSoftware(id) {
  if (!confirm(`Are you sure you want to permanently delete software application "${id}"? This will also revoke all license assignments.`)) return;

  let sList = loadSoftware();
  const soft = sList.find(x => x.id === id);
  if (!soft) return;

  sList = sList.filter(x => x.id !== id);
  saveSoftware(sList);

  // Remove related assignments
  let aList = loadSoftwareAssignments();
  const priorCount = aList.length;
  aList = aList.filter(x => x.softwareId !== id);
  saveSoftwareAssignments(aList);

  // Log to Audit Trail
  const actor = typeof getCurrentActorName === 'function' ? getCurrentActorName() : 'System';
  addAuditLog(`🗑️ Deleted software application ${id} (${soft.name}), revoking ${priorCount - aList.length} license seats`, actor, id, 'software');

  showToast(`Successfully deleted software application ${id}.`, 'success');
  renderSoftwareView();
}

// Open Manage Allocations modal
function openAllocationsModal(softwareId) {
  const modal = document.getElementById('software-alloc-modal-overlay');
  if (!modal) return;

  const sList = loadSoftware();
  const s = sList.find(x => x.id === softwareId);
  if (!s) return;

  document.getElementById('alloc-software-id').value = softwareId;
  document.getElementById('alloc-software-name').textContent = s.name;
  document.getElementById('alloc-software-vendor').textContent = `Vendor: ${s.vendor} | Version: ${s.version || 'N/A'}`;

  // Populate Users Dropdown
  const userSelect = document.getElementById('alloc-user-select');
  if (userSelect) {
    userSelect.innerHTML = '<option value="">Select a user...</option>';
    
    // Load dynamic users from system
    const uList = typeof loadUsers === 'function' ? loadUsers() : [];
    
    // Sort alphabetically by name
    const sorted = [...uList].sort((a, b) => {
      const nameA = `${a.fname || ''} ${a.lname || ''}`.trim().toLowerCase();
      const nameB = `${b.fname || ''} ${b.lname || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });

    sorted.forEach(u => {
      const option = document.createElement('option');
      option.value = u.id;
      option.textContent = `${u.fname || ''} ${u.lname || ''} (${u.email || u.id})`.trim();
      userSelect.appendChild(option);
    });
  }

  // Refresh Assignments list inside modal
  refreshAllocationsList(softwareId);

  modal.classList.add('open');
}

// Refresh allocations assignments details in modal
function refreshAllocationsList(softwareId) {
  const sList = loadSoftware();
  const s = sList.find(x => x.id === softwareId);
  if (!s) return;

  const aList = loadSoftwareAssignments();
  const assignments = aList.filter(x => x.softwareId === softwareId);
  const seatsLimit = parseInt(s.quantity) || 0;

  document.getElementById('alloc-seats-badge').textContent = `${assignments.length} / ${seatsLimit} Seats`;

  const tbody = document.getElementById('software-alloc-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (assignments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 20px; color: var(--text-secondary); font-style: italic;">
          No users assigned to this software.
        </td>
      </tr>
    `;
    return;
  }

  const uList = typeof loadUsers === 'function' ? loadUsers() : [];

  assignments.forEach(a => {
    const user = uList.find(x => x.id === a.userId);
    const userName = user ? `${user.fname || ''} ${user.lname || ''}`.trim() : `User (${a.userId})`;
    const userEmail = user ? (user.email || 'N/A') : 'N/A';

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    tr.innerHTML = `
      <td style="padding: 8px 10px; font-weight: 600; color: var(--text-primary);">${escapeHTML(userName)}</td>
      <td style="padding: 8px 10px; color: var(--text-secondary);">${escapeHTML(userEmail)}</td>
      <td style="padding: 8px 10px; color: var(--text-secondary);">${a.assignedDate || 'N/A'}</td>
      <td style="padding: 8px 10px; text-align: right;">
        <button class="btn btn-ghost btn-sm btn-revoke-license" onclick="unassignSeat('${softwareId}', '${a.userId}')" title="Revoke seat license" style="padding: 2px 6px; font-size: 0.75rem; color: var(--accent-red);">Revoke</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Assign license seat to a user
function assignSeat(softwareId, userId) {
  const sList = loadSoftware();
  const s = sList.find(x => x.id === softwareId);
  if (!s) return;

  const aList = loadSoftwareAssignments();
  
  // 1. Check if user is already assigned
  const alreadyAssigned = aList.some(x => x.softwareId === softwareId && x.userId === userId);
  if (alreadyAssigned) {
    showToast('❌ This user is already assigned a license seat for this software.', 'error');
    return;
  }

  // 2. Check seat limits
  const currentAssigned = aList.filter(x => x.softwareId === softwareId).length;
  const seatsLimit = parseInt(s.quantity) || 0;
  if (currentAssigned >= seatsLimit) {
    showToast(`❌ License Limit Reached: All ${seatsLimit} seats are currently allocated. Please increase the seat quantity or revoke an existing user license.`, 'error');
    return;
  }

  // 3. Save assignment
  const todayStr = new Date().toISOString().split('T')[0];
  aList.push({
    softwareId,
    userId,
    assignedDate: todayStr
  });
  saveSoftwareAssignments(aList);

  // 4. Log to Audit
  const uList = typeof loadUsers === 'function' ? loadUsers() : [];
  const user = uList.find(x => x.id === userId);
  const userName = user ? `${user.fname || ''} ${user.lname || ''}`.trim() : userId;

  const actor = typeof getCurrentActorName === 'function' ? getCurrentActorName() : 'System';
  addAuditLog(`👥 Allocated seat for software ${softwareId} (${s.name}) to user: ${userName}`, actor, softwareId, 'software');

  showToast(`Successfully assigned license to ${userName}!`, 'success');
  
  // Reset select input
  const userSelect = document.getElementById('alloc-user-select');
  if (userSelect) userSelect.value = '';

  refreshAllocationsList(softwareId);
  renderSoftwareView();
}

// Revoke license seat from a user
function unassignSeat(softwareId, userId) {
  const sList = loadSoftware();
  const s = sList.find(x => x.id === softwareId);
  if (!s) return;

  let aList = loadSoftwareAssignments();
  aList = aList.filter(x => !(x.softwareId === softwareId && x.userId === userId));
  saveSoftwareAssignments(aList);

  // Log to Audit
  const uList = typeof loadUsers === 'function' ? loadUsers() : [];
  const user = uList.find(x => x.id === userId);
  const userName = user ? `${user.fname || ''} ${user.lname || ''}`.trim() : userId;

  const actor = typeof getCurrentActorName === 'function' ? getCurrentActorName() : 'System';
  addAuditLog(`↩️ Revoked seat for software ${softwareId} (${s.name}) from user: ${userName}`, actor, softwareId, 'software');

  showToast(`Revoked license seat from ${userName}.`, 'info');
  refreshAllocationsList(softwareId);
  renderSoftwareView();
}

// Proactively check software AMC Alert notifications on application load
function checkSoftwareAMCAlerts() {
  const sList = loadSoftware();
  if (sList.length === 0) return;

  sList.forEach(s => {
    if (!s.amcEnabled || !s.amcEnd) return;

    const status = getSoftwareAMCStatus(s);
    if (status.label === 'Expired') {
      const sessionKey = `hd_software_notified_expired_${s.id}_${s.amcEnd}`;
      if (!sessionStorage.getItem(sessionKey)) {
        setTimeout(() => {
          showToast(`⚠️ AMC Contract Expired: "${s.name}" (${s.id}) expired on ${s.amcEnd}.`, 'warning');
        }, 1500);
        sessionStorage.setItem(sessionKey, 'true');
      }
    } else if (status.label === 'Expiring Soon') {
      const sessionKey = `hd_software_notified_expiring_${s.id}_${s.amcEnd}`;
      if (!sessionStorage.getItem(sessionKey)) {
        setTimeout(() => {
          showToast(`⏳ AMC Contract Renewal Approaching: "${s.name}" (${s.id}) expires in ${status.days} days on ${s.amcEnd}.`, 'info');
        }, 2000);
        sessionStorage.setItem(sessionKey, 'true');
      }
    }
  });
}

// Bind to window
window.initSoftware = initSoftware;
window.renderSoftwareView = renderSoftwareView;
window.getSoftwareAMCStatus = getSoftwareAMCStatus;
window.openSoftwareModal = openSoftwareModal;
window.saveSoftwareForm = saveSoftwareForm;
window.deleteSoftware = deleteSoftware;
window.openAllocationsModal = openAllocationsModal;
window.assignSeat = assignSeat;
window.unassignSeat = unassignSeat;
window.checkSoftwareAMCAlerts = checkSoftwareAMCAlerts;
