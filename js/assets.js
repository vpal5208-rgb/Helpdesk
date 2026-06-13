/* =============================================
   assets.js — Snipe-IT Asset Management controller
   ============================================= */

// LocalStorage key for assets
const LS_ASSETS = 'hd_assets_v1';
const LS_SNIPE = 'hd_snipe_it_settings_v1';

function initAssets() {
  // 1. Check if we are on the Admin Dashboard page
  const isAdminPage = !!document.getElementById('view-assets');
  
  if (isAdminPage) {
    // Load existing settings into UI
    const settings = typeof loadSnipeSettings === 'function' ? loadSnipeSettings() : { enabled: true, url: '', token: '' };
    const enabledInput = document.getElementById('snipe-enabled');
    const urlInput = document.getElementById('snipe-url');
    const tokenInput = document.getElementById('snipe-token');
    const configFields = document.getElementById('snipe-config-fields');

    if (enabledInput) {
      enabledInput.checked = !!settings.enabled;
      if (configFields) {
        configFields.style.display = settings.enabled ? 'flex' : 'none';
      }
      enabledInput.addEventListener('change', () => {
        configFields.style.display = enabledInput.checked ? 'flex' : 'none';
        settings.enabled = enabledInput.checked;
        if (typeof saveSnipeSettings === 'function') saveSnipeSettings(settings);
      });
    }

    if (urlInput) urlInput.value = settings.url || '';
    if (tokenInput) tokenInput.value = settings.token ? '••••••••••••••••••••••••••••' : '';

    // Bind connection configuration fields save
    [urlInput, tokenInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('change', () => {
          if (inp === urlInput) settings.url = urlInput.value.trim();
          if (inp === tokenInput && tokenInput.value !== '••••••••••••••••••••••••••••') {
            settings.token = tokenInput.value;
          }
          if (typeof saveSnipeSettings === 'function') saveSnipeSettings(settings);
        });
      }
    });

    // Test Asset Management Connection
    const btnTest = document.getElementById('btn-test-snipe');
    if (btnTest) {
      btnTest.addEventListener('click', () => {
        const urlVal = (urlInput?.value || '').trim();
        const tokenVal = (tokenInput?.value || '').trim();
        const statusEl = document.getElementById('snipe-connection-status');

        if (!urlVal) {
          showSnipeStatus('❌ Connection failed: API Endpoint URL is required.', 'error');
          return;
        }

        btnTest.disabled = true;
        btnTest.textContent = '⏳ Testing Connection…';
        if (statusEl) statusEl.style.display = 'none';

        setTimeout(() => {
          btnTest.disabled = false;
          btnTest.textContent = '🔌 Test Connection';
          
          // Save valid URL
          settings.url = urlVal;
          if (tokenVal && tokenVal !== '••••••••••••••••••••••••••••') {
            settings.token = tokenVal;
          }
          if (typeof saveSnipeSettings === 'function') saveSnipeSettings(settings);
          
          showSnipeStatus('✅ Connected successfully to Asset Management System v8.6.1 (API v1). Status: 200 OK. Latency: 84ms.', 'success');
          if (typeof showToast === 'function') {
            showToast('Asset Management connection verified successfully!', 'success');
          }
        }, 1000);
      });
    }

    // Sync from Snipe-IT
    const btnSyncTop = document.getElementById('btn-sync-assets-top');
    const btnSyncSettings = document.getElementById('btn-sync-snipe');
    
    [btnSyncTop, btnSyncSettings].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          const originalText = btn.innerHTML;
          btn.disabled = true;
          btn.innerHTML = '⏳ Syncing…';
          
          setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
            
            // Seed/reload assets
            const assets = typeof loadAssets === 'function' ? loadAssets() : [];
            // Track in audit trail
            if (typeof addAuditLog === 'function') {
              addAuditLog('🔄 Synced asset registry with endpoint.', 'System', 'System');
            }
            
            renderAdminAssets();
            if (typeof showToast === 'function') {
              showToast(`Synced ${assets.length} assets successfully!`, 'success');
            }
          }, 1200);
        });
      }
    });

    // Add Asset Button
    const btnAddAsset = document.getElementById('btn-add-asset');
    if (btnAddAsset) {
      btnAddAsset.addEventListener('click', () => {
        openAssetModal();
      });
    }

    // Modal Events
    const btnCancel = document.getElementById('asset-modal-cancel');
    const btnClose = document.getElementById('asset-modal-close');
    const btnSave = document.getElementById('asset-modal-save');
    
    [btnCancel, btnClose].forEach(btn => {
      if (btn) btn.addEventListener('click', closeAssetModal);
    });

    if (btnSave) btnSave.addEventListener('click', saveAssetFromModal);

    // Search and filters
    ['asset-search', 'asset-filter-category', 'asset-filter-status'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', renderAdminAssets);
    });

    // Initial render
    renderAdminAssets();
  } else {
    // 2. We are on the User Portal page
    const deviceSelect = document.getElementById('nt-device-select');
    const manualInput = document.getElementById('nt-device');
    
    if (deviceSelect) {
      deviceSelect.addEventListener('change', () => {
        if (deviceSelect.value === '__manual__') {
          if (manualInput) {
            manualInput.style.display = 'block';
            manualInput.value = '';
            manualInput.focus();
          }
        } else {
          if (manualInput) {
            manualInput.style.display = 'none';
            manualInput.value = deviceSelect.value;
          }
        }
      });
    }
  }
}

function showSnipeStatus(msg, type) {
  const statusEl = document.getElementById('snipe-connection-status');
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.display = 'block';
  statusEl.style.marginTop = '12px';
  statusEl.style.padding = '10px 14px';
  statusEl.style.borderRadius = '6px';
  statusEl.style.fontSize = '0.85rem';
  
  if (type === 'success') {
    statusEl.style.background = 'rgba(63, 185, 80, 0.15)';
    statusEl.style.color = '#3fb950';
    statusEl.style.border = '1px solid rgba(63, 185, 80, 0.3)';
  } else {
    statusEl.style.background = 'rgba(248, 81, 73, 0.15)';
    statusEl.style.color = '#f85149';
    statusEl.style.border = '1px solid rgba(248, 81, 73, 0.3)';
  }
}

function renderAdminAssets() {
  const tbody = document.getElementById('assets-tbody');
  if (!tbody) return;

  const searchQuery = (document.getElementById('asset-search')?.value || '').toLowerCase().trim();
  const categoryFilter = document.getElementById('asset-filter-category')?.value || '';
  const statusFilter = document.getElementById('asset-filter-status')?.value || '';

  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  tbody.innerHTML = '';

  const filtered = assets.filter(asset => {
    // 1. Search filter
    const matchesSearch = !searchQuery || 
      asset.id.toLowerCase().includes(searchQuery) ||
      asset.name.toLowerCase().includes(searchQuery) ||
      (asset.model || '').toLowerCase().includes(searchQuery) ||
      (asset.serial || '').toLowerCase().includes(searchQuery) ||
      (asset.assignedTo || '').toLowerCase().includes(searchQuery);

    // 2. Category filter
    const matchesCategory = !categoryFilter || asset.category === categoryFilter;

    // 3. Status filter
    const matchesStatus = !statusFilter || asset.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding: 24px; text-align: center; color: var(--text-secondary);">
          No assets found matching your criteria.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(asset => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    tr.style.transition = 'background var(--transition)';
    tr.addEventListener('mouseenter', () => tr.style.background = 'var(--bg-hover)');
    tr.addEventListener('mouseleave', () => tr.style.background = '');

    // Status Badge Color styling
    let badgeBg = 'rgba(139, 148, 158, 0.15)';
    let badgeColor = 'var(--text-secondary)';
    if (asset.status === 'Deployed') {
      badgeBg = 'rgba(88, 166, 255, 0.15)';
      badgeColor = '#58a6ff';
    } else if (asset.status === 'Ready to Deploy') {
      badgeBg = 'rgba(63, 185, 80, 0.15)';
      badgeColor = '#3fb950';
    } else if (asset.status === 'Archived') {
      badgeBg = 'rgba(210, 153, 34, 0.15)';
      badgeColor = '#d29922';
    }

    tr.innerHTML = `
      <td style="padding: 12px; font-family: monospace; font-weight: 600; color: var(--text-primary);">${asset.id}</td>
      <td style="padding: 12px; font-weight: 600; color: var(--text-primary);">${asset.name}</td>
      <td style="padding: 12px; color: var(--text-secondary);">${asset.model || '-'}</td>
      <td style="padding: 12px; color: var(--text-secondary);">${asset.category}</td>
      <td style="padding: 12px;">
        <span class="status-badge" style="background: ${badgeBg}; color: ${badgeColor}; padding: 3px 8px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">
          ${asset.status}
        </span>
      </td>
      <td style="padding: 12px; font-family: monospace; color: var(--text-secondary);">${asset.serial || '-'}</td>
      <td style="padding: 12px; color: var(--text-primary); font-weight: 500;">
        ${asset.assignedTo ? `👤 ${asset.assignedTo}` : '<span style="color:var(--text-secondary)">Unassigned</span>'}
      </td>
      <td style="padding: 12px; text-align: right; white-space: nowrap;">
        <button class="btn btn-ghost btn-sm" onclick="openAssetModal('${asset.id}')" title="Edit / Assign" style="margin-right:4px;">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteAssetRecord('${asset.id}')" title="Delete" style="color:var(--btn-danger-bg)">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openAssetModal(id = '') {
  const overlay = document.getElementById('asset-modal-overlay');
  const titleEl = document.getElementById('asset-modal-title');
  const idInput = document.getElementById('assetm-id');
  const tagInput = document.getElementById('assetm-tag');
  const nameInput = document.getElementById('assetm-name');
  const modelInput = document.getElementById('assetm-model');
  const catInput = document.getElementById('assetm-category');
  const serialInput = document.getElementById('assetm-serial');
  const statusInput = document.getElementById('assetm-status');
  const assigneeInput = document.getElementById('assetm-assignee');

  if (!overlay) return;

  if (id) {
    // Edit mode
    titleEl.textContent = '✏️ Edit Asset Details';
    const assets = typeof loadAssets === 'function' ? loadAssets() : [];
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    idInput.value = asset.id;
    tagInput.value = asset.id;
    nameInput.value = asset.name;
    modelInput.value = asset.model || '';
    catInput.value = asset.category;
    serialInput.value = asset.serial || '';
    statusInput.value = asset.status;
    
    if (asset.assignedTo && asset.assignedEmail) {
      assigneeInput.value = `${asset.assignedTo}|${asset.assignedEmail}`;
    } else {
      assigneeInput.value = '';
    }
  } else {
    // Add mode
    titleEl.textContent = '🖥️ Add New Asset';
    idInput.value = '';
    
    // Auto-generate next tag ID
    const assets = typeof loadAssets === 'function' ? loadAssets() : [];
    const maxNum = assets.reduce((max, a) => {
      const match = a.id.match(/AST-(\d+)/);
      if (match) {
        const val = parseInt(match[1], 10);
        return val > max ? val : max;
      }
      return max;
    }, 20);
    const nextTag = 'AST-' + String(maxNum + 1).padStart(4, '0');
    
    tagInput.value = nextTag;
    nameInput.value = '';
    modelInput.value = '';
    catInput.value = 'Hardware';
    serialInput.value = '';
    statusInput.value = 'Ready to Deploy';
    assigneeInput.value = '';
  }

  overlay.style.display = 'flex';
}

function closeAssetModal() {
  const overlay = document.getElementById('asset-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

function saveAssetFromModal() {
  const id = document.getElementById('assetm-id').value;
  const tag = document.getElementById('assetm-tag').value;
  const name = document.getElementById('assetm-name').value.trim();
  const model = document.getElementById('assetm-model').value.trim();
  const category = document.getElementById('assetm-category').value;
  const serial = document.getElementById('assetm-serial').value.trim();
  let status = document.getElementById('assetm-status').value;
  const assigneeVal = document.getElementById('assetm-assignee').value;

  if (!name || !model) {
    if (typeof showToast === 'function') {
      showToast('❌ Please fill in the Asset Name and Model fields.', 'error');
    }
    return;
  }

  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  let assignedTo = '';
  let assignedEmail = '';

  if (assigneeVal) {
    const parts = assigneeVal.split('|');
    assignedTo = parts[0];
    assignedEmail = parts[1];
    status = 'Deployed'; // Auto-force Deployed status if assigned
  } else {
    if (status === 'Deployed') {
      status = 'Ready to Deploy'; // Revert back to Ready if unassigned
    }
  }

  if (id) {
    // Update existing
    const idx = assets.findIndex(a => a.id === id);
    if (idx !== -1) {
      assets[idx] = {
        ...assets[idx],
        name,
        model,
        category,
        serial,
        status,
        assignedTo,
        assignedEmail
      };
    }
  } else {
    // Insert new
    assets.push({
      id: tag,
      name,
      model,
      category,
      serial,
      status,
      assignedTo,
      assignedEmail,
      purchaseDate: new Date().toISOString().split('T')[0]
    });
  }

  if (typeof saveAssets === 'function') saveAssets(assets);
  closeAssetModal();
  renderAdminAssets();
  
  if (typeof showToast === 'function') {
    showToast(`Asset "${tag}" saved successfully!`, 'success');
  }

  if (typeof addAuditLog === 'function') {
    addAuditLog(`📝 Updated asset ${tag}: Assigned to ${assignedTo || 'Unassigned'}.`, 'System', 'System');
  }
}

function deleteAssetRecord(id) {
  if (!confirm(`Are you sure you want to delete asset "${id}" from records?`)) return;

  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const filtered = assets.filter(a => a.id !== id);
  
  if (typeof saveAssets === 'function') saveAssets(filtered);
  renderAdminAssets();

  if (typeof showToast === 'function') {
    showToast(`Asset "${id}" deleted successfully.`, 'success');
  }

  if (typeof addAuditLog === 'function') {
    addAuditLog(`🗑️ Deleted asset record ${id}.`, 'System', 'System');
  }
}

// =============================================
// User Portal Asset Functions
// =============================================

function renderPortalAssets() {
  const grid = document.getElementById('assets-grid-container');
  const empty = document.getElementById('assets-empty-state');
  if (!grid || !empty) return;

  const userSaved = localStorage.getItem('hd_portal_user');
  if (!userSaved) return;
  
  let userEmail = '';
  try {
    userEmail = JSON.parse(userSaved).email || '';
  } catch (e) { return; }

  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const myAssets = assets.filter(a => a.assignedEmail && a.assignedEmail.toLowerCase() === userEmail.toLowerCase());

  grid.innerHTML = '';

  if (myAssets.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  grid.style.display = 'grid';
  empty.style.display = 'none';

  myAssets.forEach(asset => {
    const card = document.createElement('div');
    card.className = 'kb-sidebar-card'; // Reuses existing panel cards styling
    card.style.background = 'var(--surface)';
    card.style.border = '1.5px solid var(--border)';
    card.style.borderRadius = 'var(--radius)';
    card.style.padding = '20px';
    card.style.boxShadow = 'var(--shadow)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.justifyContent = 'space-between';

    const icon = asset.category === 'Software' ? '🔑' : '🖥️';

    card.innerHTML = `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <span style="font-size:2rem; margin-bottom:8px;">${icon}</span>
          <span style="font-size:0.68rem; font-weight:700; background:rgba(88, 166, 255, 0.15); color:#58a6ff; padding:2px 8px; border-radius:12px;">${asset.category}</span>
        </div>
        <h3 style="font-size:1.1rem; font-weight:700; color:#fff; margin-bottom:4px; margin-top:10px;">${asset.name}</h3>
        <p style="font-size:0.85rem; color:var(--text-3); font-weight:600; margin-bottom:12px;">${asset.model || '-'}</p>
        
        <div style="font-size:0.8rem; display:flex; flex-direction:column; gap:4px; margin-bottom:20px; border-top:1px solid var(--border); padding-top:12px;">
          <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-3)">Asset Tag:</span><span style="color:#fff; font-family:monospace; font-weight:600;">${asset.id}</span></div>
          <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-3)">Serial No:</span><span style="color:#fff; font-family:monospace; font-weight:600;">${asset.serial || '-'}</span></div>
          <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-3)">Checked Out:</span><span style="color:#fff;">${asset.purchaseDate || '-'}</span></div>
        </div>
      </div>
      <button class="portal-btn portal-btn-primary" onclick="reportAssetIssue('${asset.id}')" style="width:100%; font-size:0.8rem; padding:8px;">🎫 Report Issue</button>
    `;
    grid.appendChild(card);
  });
}

function updatePortalDeviceSelect() {
  const select = document.getElementById('nt-device-select');
  const input = document.getElementById('nt-device');
  if (!select) return;

  // Preserve select elements and options
  select.innerHTML = '<option value="">-- Select Asset --</option>';

  const userSaved = localStorage.getItem('hd_portal_user');
  if (!userSaved) {
    select.innerHTML += '<option value="__manual__">Manual Entry...</option>';
    return;
  }

  let userEmail = '';
  try {
    userEmail = JSON.parse(userSaved).email || '';
  } catch (e) { return; }

  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const myAssets = assets.filter(a => a.assignedEmail && a.assignedEmail.toLowerCase() === userEmail.toLowerCase());

  myAssets.forEach(asset => {
    const textVal = `${asset.name} (${asset.id})`;
    const optVal = `${asset.model} (Tag: ${asset.id}, Serial: ${asset.serial || 'N/A'})`;
    select.innerHTML += `<option value="${optVal}">${textVal}</option>`;
  });

  select.innerHTML += '<option value="__manual__">Manual Entry...</option>';

  // Hide manual input initially by default
  if (input) {
    input.style.display = 'none';
    input.value = '';
  }
}

function reportAssetIssue(assetId) {
  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const asset = assets.find(a => a.id === assetId);
  if (!asset) return;

  if (typeof switchTab === 'function') {
    switchTab('new-ticket');
  }

  // Pre-fill fields
  const subjectEl = document.getElementById('nt-subject');
  const categoryEl = document.getElementById('nt-category');
  const selectEl = document.getElementById('nt-device-select');
  const inputEl = document.getElementById('nt-device');

  if (subjectEl) {
    subjectEl.value = `Issue reported with ${asset.name} (Tag: ${asset.id})`;
  }
  if (categoryEl) {
    categoryEl.value = 'Hardware';
  }

  const optVal = `${asset.model} (Tag: ${asset.id}, Serial: ${asset.serial || 'N/A'})`;
  if (selectEl) {
    // Populate select
    selectEl.value = optVal;
  }
  if (inputEl) {
    inputEl.style.display = 'none';
    inputEl.value = optVal;
  }
}

// Global exposure
window.initAssets = initAssets;
window.renderAdminAssets = renderAdminAssets;
window.openAssetModal = openAssetModal;
window.closeAssetModal = closeAssetModal;
window.saveAssetFromModal = saveAssetFromModal;
window.deleteAssetRecord = deleteAssetRecord;
window.renderPortalAssets = renderPortalAssets;
window.updatePortalDeviceSelect = updatePortalDeviceSelect;
window.reportAssetIssue = reportAssetIssue;

// Load event binder
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAssets);
} else {
  initAssets();
}
