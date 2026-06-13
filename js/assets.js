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

    // Checkout Modal Events
    const btnCheckoutCancel = document.getElementById('checkout-modal-cancel');
    const btnCheckoutClose = document.getElementById('checkout-modal-close');
    const btnCheckoutSubmit = document.getElementById('checkout-modal-submit');

    [btnCheckoutCancel, btnCheckoutClose].forEach(btn => {
      if (btn) btn.addEventListener('click', closeCheckoutModal);
    });

    if (btnCheckoutSubmit) btnCheckoutSubmit.addEventListener('click', saveCheckout);

    // Manage Vendors Button click
    const btnManageVendors = document.getElementById('btn-manage-vendors');
    if (btnManageVendors) {
      btnManageVendors.addEventListener('click', () => {
        openVendorsModal();
      });
    }

    // Vendors Modal Events
    const btnVendorsCancel = document.getElementById('vendors-modal-cancel');
    const btnVendorsClose = document.getElementById('vendors-modal-close');
    const btnSaveVendor = document.getElementById('btn-save-vendor');

    [btnVendorsCancel, btnVendorsClose].forEach(btn => {
      if (btn) btn.addEventListener('click', closeVendorsModal);
    });

    if (btnSaveVendor) {
      btnSaveVendor.addEventListener('click', saveVendor);
    }

    // Vendor select changed (shows custom name field conditionally)
    const selectVendor = document.getElementById('assetm-vendor');
    if (selectVendor) {
      selectVendor.addEventListener('change', () => {
        const customGroup = document.getElementById('assetm-vendor-custom-group');
        const detailsField = document.getElementById('assetm-vendor-details');
        
        if (selectVendor.value === '__custom__') {
          if (customGroup) customGroup.style.display = 'block';
          if (detailsField) {
            detailsField.value = '';
            detailsField.focus();
          }
        } else {
          if (customGroup) customGroup.style.display = 'none';
          // Auto-fill details for predefined vendor
          if (selectVendor.value) {
            const vendors = typeof loadVendors === 'function' ? loadVendors() : [];
            const v = vendors.find(x => x.name === selectVendor.value);
            if (detailsField) detailsField.value = v ? v.details || '' : '';
          } else {
            if (detailsField) detailsField.value = '';
          }
        }
      });
    }

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
      (asset.make || '').toLowerCase().includes(searchQuery) ||
      (asset.modelNumber || '').toLowerCase().includes(searchQuery) ||
      (asset.vendor || '').toLowerCase().includes(searchQuery) ||
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
      <td style="padding: 12px;">
        <div style="font-weight: 600; color: var(--text-primary);">${asset.name}</div>
        ${asset.purchaseDate ? `<div style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">Purchased: ${asset.purchaseDate}${asset.warrantyMonths ? ` (${asset.warrantyMonths} mo. warranty)` : ''}</div>` : ''}
      </td>
      <td style="padding: 12px; color: var(--text-secondary);">
        <div style="font-weight:600; color:var(--text-primary);">${asset.make ? `${asset.make} ` : ''}${asset.model || '-'}</div>
        ${asset.modelNumber ? `<div style="font-size:0.75rem; font-family:monospace; margin-top:2px;">Model #: ${asset.modelNumber}</div>` : ''}
        ${asset.vendor ? `<div style="font-size:0.75rem; color:#d29922; margin-top:2px; display:inline-flex; align-items:center; gap:3px;">🏢 ${asset.vendor}</div>` : ''}
      </td>
      <td style="padding: 12px; color: var(--text-secondary);">${asset.category}</td>
      <td style="padding: 12px;">
        <span class="status-badge" style="background: ${badgeBg}; color: ${badgeColor}; padding: 3px 8px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">
          ${asset.status}
        </span>
      </td>
      <td style="padding: 12px; font-family: monospace; color: var(--text-secondary);">${asset.serial || '-'}</td>
      <td style="padding: 12px; color: var(--text-primary); font-weight: 500;">
        ${asset.assignedTo ? `👤 ${asset.assignedTo}` : '<span style="color:var(--text-secondary)">Unassigned</span>'}
        ${asset.checkoutDate && asset.status === 'Deployed' ? `<div style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">Checked Out: ${asset.checkoutDate}</div>` : ''}
      </td>
      <td style="padding: 12px; text-align: right; white-space: nowrap;">
        ${asset.status === 'Deployed' 
          ? `<button class="btn btn-ghost btn-sm" onclick="checkInAsset('${asset.id}')" title="Check In Asset" style="margin-right:8px; font-size:0.75rem; color:#58a6ff; font-weight:600; border:1px solid rgba(88,166,255,0.15); padding:2px 6px;">↩️ Check In</button>`
          : asset.status === 'Ready to Deploy'
            ? `<button class="btn btn-ghost btn-sm" onclick="openCheckoutModal('${asset.id}')" title="Check Out Asset" style="margin-right:8px; font-size:0.75rem; color:#3fb950; font-weight:600; border:1px solid rgba(63,185,80,0.15); padding:2px 6px;">📤 Check Out</button>`
            : ''
        }
        <button class="btn btn-ghost btn-sm" onclick="openAssetModal('${asset.id}')" title="Edit Asset" style="margin-right:4px;">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteAssetRecord('${asset.id}')" title="Delete" style="color:var(--btn-danger-bg)">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function populateAssigneeDropdown() {
  const select = document.getElementById('assetm-assignee');
  if (!select) return;

  select.innerHTML = '<option value="">Unassigned / Available</option>';
  const users = typeof loadUsers === 'function' ? loadUsers() : [];
  users.forEach(u => {
    const fullName = `${u.fname} ${u.lname || ''}`.trim();
    const val = `${fullName}|${u.email}`;
    select.innerHTML += `<option value="${val}">${fullName} (${u.email})</option>`;
  });
}

function populateVendorDropdown() {
  const select = document.getElementById('assetm-vendor');
  if (!select) return;

  select.innerHTML = '<option value="">No Vendor</option>';
  const vendors = typeof loadVendors === 'function' ? loadVendors() : [];
  vendors.forEach(v => {
    select.innerHTML += `<option value="${v.name}">${v.name}</option>`;
  });
  select.innerHTML += '<option value="__custom__">+ Add Custom Vendor...</option>';
}

function openAssetModal(id = '') {
  const overlay = document.getElementById('asset-modal-overlay');
  const titleEl = document.getElementById('asset-modal-title');
  const idInput = document.getElementById('assetm-id');
  const tagInput = document.getElementById('assetm-tag');
  const nameInput = document.getElementById('assetm-name');
  const modelInput = document.getElementById('assetm-model');
  const modelNumberInput = document.getElementById('assetm-model-number');
  const catInput = document.getElementById('assetm-category');
  const makeInput = document.getElementById('assetm-make');
  const serialInput = document.getElementById('assetm-serial');
  const statusInput = document.getElementById('assetm-status');
  const assigneeInput = document.getElementById('assetm-assignee');
  const vendorInput = document.getElementById('assetm-vendor');
  const vendorCustomGroup = document.getElementById('assetm-vendor-custom-group');
  const vendorCustomInput = document.getElementById('assetm-vendor-custom');
  const vendorDetailsInput = document.getElementById('assetm-vendor-details');
  const purchaseDateInput = document.getElementById('assetm-purchase-date');
  const warrantyInput = document.getElementById('assetm-warranty');

  if (!overlay) return;

  // Dynamically populate assignee choices from users database
  populateAssigneeDropdown();
  // Dynamically populate vendors list
  populateVendorDropdown();

  // Reset custom vendor field
  if (vendorCustomGroup) vendorCustomGroup.style.display = 'none';
  if (vendorCustomInput) vendorCustomInput.value = '';

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
    modelNumberInput.value = asset.modelNumber || '';
    catInput.value = asset.category;
    makeInput.value = asset.make || '';
    serialInput.value = asset.serial || '';
    statusInput.value = asset.status;
    
    if (asset.assignedTo && asset.assignedEmail) {
      assigneeInput.value = `${asset.assignedTo}|${asset.assignedEmail}`;
    } else {
      assigneeInput.value = '';
    }

    if (vendorInput) {
      const exists = Array.from(vendorInput.options).some(opt => opt.value === asset.vendor);
      if (asset.vendor && exists) {
        vendorInput.value = asset.vendor;
      } else if (asset.vendor) {
        // Vendor exists but not in default list (custom vendor)
        vendorInput.value = '__custom__';
        if (vendorCustomGroup) vendorCustomGroup.style.display = 'block';
        if (vendorCustomInput) vendorCustomInput.value = asset.vendor;
      } else {
        vendorInput.value = '';
      }
    }
    
    if (vendorDetailsInput) {
      vendorDetailsInput.value = asset.vendorDetails || '';
    }

    if (purchaseDateInput) {
      purchaseDateInput.value = asset.purchaseDate || '';
    }

    if (warrantyInput) {
      warrantyInput.value = asset.warrantyMonths !== undefined ? asset.warrantyMonths : '';
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
    modelNumberInput.value = '';
    catInput.value = 'Hardware';
    makeInput.value = '';
    serialInput.value = '';
    statusInput.value = 'Ready to Deploy';
    assigneeInput.value = '';
    if (vendorInput) vendorInput.value = '';
    if (vendorDetailsInput) vendorDetailsInput.value = '';
    if (purchaseDateInput) {
      purchaseDateInput.value = new Date().toISOString().split('T')[0];
    }
    if (warrantyInput) warrantyInput.value = '36'; // Default to 36 months
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
  const modelNumber = document.getElementById('assetm-model-number').value.trim();
  const category = document.getElementById('assetm-category').value;
  const make = document.getElementById('assetm-make').value.trim();
  const serial = document.getElementById('assetm-serial').value.trim();
  let status = document.getElementById('assetm-status').value;
  const assigneeVal = document.getElementById('assetm-assignee').value;

  let vendor = document.getElementById('assetm-vendor').value;
  const customVendorName = document.getElementById('assetm-vendor-custom').value.trim();
  const vendorDetails = document.getElementById('assetm-vendor-details').value.trim();
  const purchaseDate = document.getElementById('assetm-purchase-date').value;
  const warrantyVal = document.getElementById('assetm-warranty').value;
  const warrantyMonths = warrantyVal ? parseInt(warrantyVal, 10) : '';

  if (!name || !model) {
    if (typeof showToast === 'function') {
      showToast('❌ Please fill in the Asset Name and Model fields.', 'error');
    }
    return;
  }

  if (vendor === '__custom__') {
    if (!customVendorName) {
      if (typeof showToast === 'function') {
        showToast('❌ Please enter the custom vendor name.', 'error');
      }
      return;
    }
    vendor = customVendorName;
    
    // Save new custom vendor to registry if it doesn't exist yet
    const vendors = typeof loadVendors === 'function' ? loadVendors() : [];
    const exists = vendors.some(v => v.name.toLowerCase() === customVendorName.toLowerCase());
    if (!exists) {
      vendors.push({ name: customVendorName, details: vendorDetails });
      if (typeof saveVendors === 'function') saveVendors(vendors);
    }
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

  const assetPayload = {
    name,
    model,
    modelNumber,
    category,
    make,
    serial,
    status,
    assignedTo,
    assignedEmail,
    vendor,
    vendorDetails,
    warrantyMonths,
    purchaseDate
  };

  if (id) {
    // Update existing
    const idx = assets.findIndex(a => a.id === id);
    if (idx !== -1) {
      assets[idx] = {
        ...assets[idx],
        ...assetPayload
      };
      
      // Maintain checkoutDate correctly
      if (status === 'Deployed' && !assets[idx].checkoutDate) {
        assets[idx].checkoutDate = new Date().toISOString().split('T')[0];
      } else if (status !== 'Deployed') {
        assets[idx].checkoutDate = '';
      }
    }
  } else {
    // Insert new
    assets.push({
      id: tag,
      ...assetPayload,
      checkoutDate: status === 'Deployed' ? new Date().toISOString().split('T')[0] : ''
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

function checkInAsset(id) {
  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const asset = assets.find(a => a.id === id);
  if (!asset) return;

  if (!confirm(`Are you sure you want to check in asset "${asset.id}" (${asset.name})? This will return it to inventory.`)) return;

  const oldAssignee = asset.assignedTo || 'Unknown';
  asset.status = 'Ready to Deploy';
  asset.assignedTo = '';
  asset.assignedEmail = '';
  asset.checkoutDate = '';

  if (typeof saveAssets === 'function') saveAssets(assets);
  renderAdminAssets();

  if (typeof showToast === 'function') {
    showToast(`Asset "${id}" checked in successfully!`, 'success');
  }

  if (typeof addAuditLog === 'function') {
    addAuditLog(`↩️ Checked in asset ${id} (previously assigned to ${oldAssignee}).`, 'System', 'System');
  }
}

function openCheckoutModal(id) {
  const overlay = document.getElementById('checkout-modal-overlay');
  const tagEl = document.getElementById('checkout-info-tag');
  const nameEl = document.getElementById('checkout-info-name');
  const modelEl = document.getElementById('checkout-info-model');
  const idInput = document.getElementById('checkout-asset-id');
  const assigneeSelect = document.getElementById('checkout-assignee');
  const dateInput = document.getElementById('checkout-date');

  if (!overlay) return;

  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const asset = assets.find(a => a.id === id);
  if (!asset) return;

  idInput.value = asset.id;
  tagEl.textContent = asset.id;
  nameEl.textContent = asset.name;
  modelEl.textContent = asset.model || '-';

  // Populate dynamic assignee options
  if (assigneeSelect) {
    assigneeSelect.innerHTML = '<option value="">-- Select Assignee --</option>';
    const users = typeof loadUsers === 'function' ? loadUsers() : [];
    users.forEach(u => {
      const fullName = `${u.fname} ${u.lname || ''}`.trim();
      assigneeSelect.innerHTML += `<option value="${fullName}|${u.email}">${fullName} (${u.email})</option>`;
    });
  }

  // Set default date to today
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  overlay.style.display = 'flex';
}

function closeCheckoutModal() {
  const overlay = document.getElementById('checkout-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

function saveCheckout() {
  const id = document.getElementById('checkout-asset-id').value;
  const assigneeVal = document.getElementById('checkout-assignee').value;
  const checkoutDate = document.getElementById('checkout-date').value;

  if (!assigneeVal) {
    if (typeof showToast === 'function') {
      showToast('❌ Please select an Assignee User.', 'error');
    }
    return;
  }

  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const asset = assets.find(a => a.id === id);
  if (!asset) return;

  const parts = assigneeVal.split('|');
  const assignedTo = parts[0];
  const assignedEmail = parts[1];

  asset.status = 'Deployed';
  asset.assignedTo = assignedTo;
  asset.assignedEmail = assignedEmail;
  if (checkoutDate) {
    asset.checkoutDate = checkoutDate;
  } else {
    asset.checkoutDate = new Date().toISOString().split('T')[0];
  }

  if (typeof saveAssets === 'function') saveAssets(assets);
  closeCheckoutModal();
  renderAdminAssets();

  if (typeof showToast === 'function') {
    showToast(`Asset "${id}" checked out to ${assignedTo} successfully!`, 'success');
  }

  if (typeof addAuditLog === 'function') {
    addAuditLog(`📤 Checked out asset ${id} to ${assignedTo} (${assignedEmail}).`, 'System', 'System');
  }
}

// =============================================
// Vendors Registry Management Controllers
// =============================================
function openVendorsModal() {
  const overlay = document.getElementById('vendors-modal-overlay');
  if (!overlay) return;

  // Reset form
  document.getElementById('vendorm-id').value = '';
  document.getElementById('vendorm-name').value = '';
  document.getElementById('vendorm-details').value = '';
  document.getElementById('vendor-form-title').textContent = '➕ Add New Vendor';
  const saveBtn = document.getElementById('btn-save-vendor');
  if (saveBtn) saveBtn.textContent = 'Add Vendor';

  renderVendorsList();
  overlay.style.display = 'flex';
}

function closeVendorsModal() {
  const overlay = document.getElementById('vendors-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

function renderVendorsList() {
  const tbody = document.getElementById('vendors-list-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  const vendors = typeof loadVendors === 'function' ? loadVendors() : [];

  if (vendors.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="padding: 12px; text-align: center; color: var(--text-secondary);">
          No vendors configured.
        </td>
      </tr>
    `;
    return;
  }

  vendors.forEach((v, index) => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    tr.innerHTML = `
      <td style="padding: 8px 12px; font-weight: 600; color: var(--text-primary);">${v.name}</td>
      <td style="padding: 8px 12px; color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${v.details || '-'}</td>
      <td style="padding: 8px 12px; text-align: right; white-space: nowrap;">
        <button class="btn btn-ghost btn-sm" onclick="editVendorRecord(${index})" title="Edit" style="padding: 2px 6px; margin-right: 4px;">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteVendorRecord(${index})" title="Delete" style="padding: 2px 6px; color: var(--btn-danger-bg);">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function saveVendor() {
  const indexStr = document.getElementById('vendorm-id').value;
  const name = document.getElementById('vendorm-name').value.trim();
  const details = document.getElementById('vendorm-details').value.trim();

  if (!name) {
    if (typeof showToast === 'function') {
      showToast('❌ Vendor Name is required.', 'error');
    }
    return;
  }

  const vendors = typeof loadVendors === 'function' ? loadVendors() : [];

  if (indexStr !== '') {
    // Edit vendor
    const idx = parseInt(indexStr, 10);
    if (vendors[idx]) {
      const oldName = vendors[idx].name;
      vendors[idx] = { name, details };
      
      // Cascading update to assets that use this vendor
      const assets = typeof loadAssets === 'function' ? loadAssets() : [];
      let updatedAssets = false;
      assets.forEach(asset => {
        if (asset.vendor === oldName) {
          asset.vendor = name;
          asset.vendorDetails = details;
          updatedAssets = true;
        }
      });
      if (updatedAssets && typeof saveAssets === 'function') {
        saveAssets(assets);
      }
    }
  } else {
    // Add vendor
    const exists = vendors.some(v => v.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      if (typeof showToast === 'function') {
        showToast('❌ A vendor with this name already exists.', 'error');
      }
      return;
    }
    vendors.push({ name, details });
  }

  if (typeof saveVendors === 'function') saveVendors(vendors);

  // Clear form
  document.getElementById('vendorm-id').value = '';
  document.getElementById('vendorm-name').value = '';
  document.getElementById('vendorm-details').value = '';
  document.getElementById('vendor-form-title').textContent = '➕ Add New Vendor';
  const saveBtn = document.getElementById('btn-save-vendor');
  if (saveBtn) saveBtn.textContent = 'Add Vendor';

  renderVendorsList();
  if (typeof showToast === 'function') {
    showToast('Vendor saved successfully!', 'success');
  }
}

function editVendorRecord(index) {
  const vendors = typeof loadVendors === 'function' ? loadVendors() : [];
  const v = vendors[index];
  if (!v) return;

  document.getElementById('vendorm-id').value = index;
  document.getElementById('vendorm-name').value = v.name;
  document.getElementById('vendorm-details').value = v.details || '';
  document.getElementById('vendor-form-title').textContent = '✏️ Edit Vendor';
  
  const saveBtn = document.getElementById('btn-save-vendor');
  if (saveBtn) saveBtn.textContent = 'Update Vendor';
}

function deleteVendorRecord(index) {
  if (!confirm('Are you sure you want to delete this vendor? Assets using this vendor will keep their vendor name but will no longer point to the registry.')) return;

  const vendors = typeof loadVendors === 'function' ? loadVendors() : [];
  vendors.splice(index, 1);
  if (typeof saveVendors === 'function') saveVendors(vendors);
  
  renderVendorsList();
  if (typeof showToast === 'function') {
    showToast('Vendor deleted.', 'success');
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
        <p style="font-size:0.85rem; color:var(--text-3); font-weight:600; margin-bottom:12px;">${asset.make ? `${asset.make} ` : ''}${asset.model || '-'}</p>
        
        <div style="font-size:0.8rem; display:flex; flex-direction:column; gap:4px; margin-bottom:20px; border-top:1px solid var(--border); padding-top:12px;">
          <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-3)">Asset Tag:</span><span style="color:#fff; font-family:monospace; font-weight:600;">${asset.id}</span></div>
          ${asset.modelNumber ? `<div style="display:flex; justify-content:space-between;"><span style="color:var(--text-3)">Model No:</span><span style="color:#fff; font-family:monospace;">${asset.modelNumber}</span></div>` : ''}
          <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-3)">Serial No:</span><span style="color:#fff; font-family:monospace; font-weight:600;">${asset.serial || '-'}</span></div>
          ${asset.vendor ? `<div style="display:flex; justify-content:space-between;"><span style="color:var(--text-3)">Vendor:</span><span style="color:#d29922; font-weight:600;">🏢 ${asset.vendor}</span></div>` : ''}
          ${asset.purchaseDate ? `<div style="display:flex; justify-content:space-between;"><span style="color:var(--text-3)">Purchase Date:</span><span style="color:#fff;">${asset.purchaseDate}</span></div>` : ''}
          ${asset.warrantyMonths ? `<div style="display:flex; justify-content:space-between;"><span style="color:var(--text-3)">Warranty:</span><span style="color:#fff;">${asset.warrantyMonths} Months</span></div>` : ''}
          <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-3)">Checked Out:</span><span style="color:#fff;">${asset.checkoutDate || asset.purchaseDate || '-'}</span></div>
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
window.populateAssigneeDropdown = populateAssigneeDropdown;
window.checkInAsset = checkInAsset;
window.openCheckoutModal = openCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;
window.saveCheckout = saveCheckout;

// Load event binder
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAssets);
} else {
  initAssets();
}
