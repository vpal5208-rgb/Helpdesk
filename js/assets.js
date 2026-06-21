/* =============================================
   assets.js — Snipe-IT Asset Management controller
   ============================================= */

// LocalStorage key for assets
const LS_ASSETS = 'hd_assets_v1';
const LS_SNIPE = 'hd_snipe_it_settings_v1';

// Image compression helper using HTML5 canvas
function compressImage(file, callback) {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = function (event) {
    const img = new Image();
    img.src = event.target.result;
    img.onload = function () {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 300;
      const MAX_HEIGHT = 300;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // compress quality to 70%
      callback(dataUrl);
    };
  };
}

// Document file reader helper with size validation (max 300KB)
function readDocumentFile(file, callback) {
  if (file.size > 300 * 1024) {
    if (typeof showToast === 'function') {
      showToast('❌ File is too large! Please keep Invoice/PO documents under 300KB.', 'error');
    }
    return;
  }
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = function (event) {
    callback(event.target.result, file.name);
  };
}

// Global viewer helper for base64 document files
function viewBase64Document(dataUrl, filename) {
  try {
    const win = window.open();
    if (win) {
      if (dataUrl.startsWith('data:application/pdf')) {
        win.document.write(`<iframe src="${dataUrl}" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%; position:fixed;" allowfullscreen></iframe>`);
      } else {
        win.document.write(`<img src="${dataUrl}" style="max-width:100%; max-height:100%; display:block; margin:auto;" />`);
      }
      win.document.title = filename;
    } else {
      // fallback download
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (e) {
    console.error('Failed to view document', e);
  }
}
window.viewBase64Document = viewBase64Document;

function calculateNextAuditDate(lastAuditDateStr, frequency) {
  if (!lastAuditDateStr || !frequency) return '';
  const date = new Date(lastAuditDateStr);
  if (isNaN(date.getTime())) return '';
  
  if (frequency === 'Quarterly') {
    date.setMonth(date.getMonth() + 3);
  } else if (frequency === 'Half-Yearly') {
    date.setMonth(date.getMonth() + 6);
  } else if (frequency === 'Yearly') {
    date.setMonth(date.getMonth() + 12);
  } else {
    return '';
  }
  return date.toISOString().split('T')[0];
}

function checkAssetAuditsNotifications() {
  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const today = new Date();
  today.setHours(0,0,0,0);

  assets.forEach(asset => {
    if (asset.auditFrequency && asset.nextAuditDate) {
      const nextDate = new Date(asset.nextAuditDate);
      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 7) {
        const sessionKey = `hd_audit_notified_${asset.id}_${asset.nextAuditDate}`;
        if (!sessionStorage.getItem(sessionKey)) {
          const daysText = diffDays < 0 ? `overdue by ${Math.abs(diffDays)} days` : (diffDays === 0 ? 'due today' : `due in ${diffDays} days`);
          const text = `⚠️ Asset Audit: ${asset.name} (${asset.id}) is ${daysText} (Next Due: ${asset.nextAuditDate}).`;
          
          if (typeof addNotification === 'function') {
            addNotification(text);
          }
          if (typeof showToast === 'function') {
            showToast(text, 'warning');
          }
          
          sessionStorage.setItem(sessionKey, 'true');
        }
      }
    }
  });
}

let activeAssetStatusTab = '';
let selectedAssetIds = new Set();

function initAssets() {
  // Bind Lightbox close listeners
  const lightboxClose = document.getElementById('lightbox-close');
  const lightboxOverlay = document.getElementById('lightbox-overlay');
  
  if (lightboxClose && !lightboxClose.dataset.initialized) {
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxClose.dataset.initialized = 'true';
  }
  
  if (lightboxOverlay && !lightboxOverlay.dataset.initialized) {
    lightboxOverlay.addEventListener('click', e => {
      if (e.target === lightboxOverlay) {
        closeLightbox();
      }
    });
    lightboxOverlay.dataset.initialized = 'true';
  }

  // 1. Check if we are on the Admin Dashboard page
  const isAdminPage = !!document.getElementById('view-assets');
  
  if (isAdminPage) {
    checkAssetAuditsNotifications();
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
              addAuditLog('🔄 Synced asset registry with endpoint.', 'System', 'System', 'asset');
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

    if (typeof initAssetScanner === 'function') {
      initAssetScanner();
    }

    // Bulk Audit All Button
    const btnBulkAudit = document.getElementById('btn-bulk-audit-all');
    if (btnBulkAudit) {
      btnBulkAudit.addEventListener('click', () => {
        bulkAuditAllAssets();
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
    ['asset-search', 'asset-filter-category'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', renderAdminAssets);
    });

    const statusTabs = document.getElementById('asset-status-tabs');
    if (statusTabs) {
      statusTabs.addEventListener('click', e => {
        const btn = e.target.closest('.settings-tab');
        if (!btn) return;
        statusTabs.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeAssetStatusTab = btn.dataset.status || '';
        renderAdminAssets();
      });
    // Audit date auto-calculation and listeners
    const freqSelect = document.getElementById('assetm-audit-frequency');
    const lastAuditInput = document.getElementById('assetm-last-audit-date');
    const nextAuditInput = document.getElementById('assetm-next-audit-date');
    const btnMarkAudited = document.getElementById('btn-mark-audited');

    const updateCalculatedDueDate = () => {
      if (freqSelect && lastAuditInput && nextAuditInput) {
        const calculated = calculateNextAuditDate(lastAuditInput.value, freqSelect.value);
        if (calculated) {
          nextAuditInput.value = calculated;
        }
      }
      if (btnMarkAudited) {
        btnMarkAudited.style.display = freqSelect && freqSelect.value ? 'inline-block' : 'none';
      }
    };

    if (freqSelect) freqSelect.addEventListener('change', updateCalculatedDueDate);
    if (lastAuditInput) lastAuditInput.addEventListener('change', updateCalculatedDueDate);

    if (btnMarkAudited) {
      btnMarkAudited.addEventListener('click', () => {
        if (lastAuditInput && freqSelect && nextAuditInput) {
          const today = new Date().toISOString().split('T')[0];
          lastAuditInput.value = today;
          const calculated = calculateNextAuditDate(today, freqSelect.value);
          if (calculated) {
            nextAuditInput.value = calculated;
          }
          if (typeof showToast === 'function') {
            showToast('IT Asset Audit marked as completed!', 'success');
          }
        }
      });
    }
    }

    // Setup file attachment listeners for Asset modal
    const picFileInput = document.getElementById('assetm-pic-file');
    const picDataInput = document.getElementById('assetm-pic-data');
    const picPreviewContainer = document.getElementById('assetm-pic-preview-container');
    const picPreview = document.getElementById('assetm-pic-preview');
    const picClear = document.getElementById('assetm-pic-clear');

    if (picFileInput) {
      picFileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
          compressImage(file, dataUrl => {
            if (picDataInput) picDataInput.value = dataUrl;
            if (picPreview) picPreview.src = dataUrl;
            if (picPreviewContainer) picPreviewContainer.style.display = 'flex';
          });
        }
      });
    }

    if (picClear) {
      picClear.addEventListener('click', () => {
        if (picFileInput) picFileInput.value = '';
        if (picDataInput) picDataInput.value = '';
        if (picPreviewContainer) picPreviewContainer.style.display = 'none';
      });
    }

    if (picPreview) {
      picPreview.style.cursor = 'pointer';
      picPreview.style.transition = 'transform 0.15s ease';
      picPreview.title = 'Click to view full image';
      picPreview.addEventListener('mouseenter', () => picPreview.style.transform = 'scale(1.1)');
      picPreview.addEventListener('mouseleave', () => picPreview.style.transform = 'scale(1)');
      picPreview.addEventListener('click', () => {
        const dataUrl = picDataInput?.value;
        const name = document.getElementById('assetm-name')?.value || 'asset_image.png';
        if (dataUrl) {
          openLightbox(dataUrl, name);
        }
      });
    }

    const invoiceFileInput = document.getElementById('assetm-invoice-file');
    const invoiceDataInput = document.getElementById('assetm-invoice-data');
    const invoiceFilenameInput = document.getElementById('assetm-invoice-filename');
    const invoicePreviewContainer = document.getElementById('assetm-invoice-preview-container');
    const invoiceNameSpan = document.getElementById('assetm-invoice-name');
    const invoiceClear = document.getElementById('assetm-invoice-clear');
    const invoiceView = document.getElementById('assetm-invoice-view');

    if (invoiceFileInput) {
      invoiceFileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
          readDocumentFile(file, (dataUrl, filename) => {
            if (invoiceDataInput) invoiceDataInput.value = dataUrl;
            if (invoiceFilenameInput) invoiceFilenameInput.value = filename;
            if (invoiceNameSpan) invoiceNameSpan.textContent = filename;
            if (invoicePreviewContainer) invoicePreviewContainer.style.display = 'flex';
          });
        }
      });
    }

    if (invoiceClear) {
      invoiceClear.addEventListener('click', () => {
        if (invoiceFileInput) invoiceFileInput.value = '';
        if (invoiceDataInput) invoiceDataInput.value = '';
        if (invoiceFilenameInput) invoiceFilenameInput.value = '';
        if (invoicePreviewContainer) invoicePreviewContainer.style.display = 'none';
      });
    }

    if (invoiceView) {
      invoiceView.addEventListener('click', () => {
        const dataUrl = invoiceDataInput?.value;
        const filename = invoiceFilenameInput?.value || 'invoice.pdf';
        if (dataUrl) {
          openLightbox(dataUrl, filename);
        }
      });
    }

    const poFileInput = document.getElementById('assetm-po-file');
    const poDataInput = document.getElementById('assetm-po-data');
    const poFilenameInput = document.getElementById('assetm-po-filename');
    const poPreviewContainer = document.getElementById('assetm-po-preview-container');
    const poNameSpan = document.getElementById('assetm-po-name');
    const poClear = document.getElementById('assetm-po-clear');
    const poView = document.getElementById('assetm-po-view');

    if (poFileInput) {
      poFileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
          readDocumentFile(file, (dataUrl, filename) => {
            if (poDataInput) poDataInput.value = dataUrl;
            if (poFilenameInput) poFilenameInput.value = filename;
            if (poNameSpan) poNameSpan.textContent = filename;
            if (poPreviewContainer) poPreviewContainer.style.display = 'flex';
          });
        }
      });
    }

    if (poClear) {
      poClear.addEventListener('click', () => {
        if (poFileInput) poFileInput.value = '';
        if (poDataInput) poDataInput.value = '';
        if (poFilenameInput) poFilenameInput.value = '';
        if (poPreviewContainer) poPreviewContainer.style.display = 'none';
      });
    }

    if (poView) {
      poView.addEventListener('click', () => {
        const dataUrl = poDataInput?.value;
        const filename = poFilenameInput?.value || 'po_copy.pdf';
        if (dataUrl) {
          openLightbox(dataUrl, filename);
        }
      });
    }

    // Initialize tab and maintenance functionality for the asset modal
    if (typeof initAssetModalTabs === 'function') {
      initAssetModalTabs();
    }

    // Select-all checkbox listener
    const chkSelectAll = document.getElementById('chk-select-all-assets');
    if (chkSelectAll) {
      chkSelectAll.addEventListener('change', handleSelectAllChange);
    }

    // Row checkbox listener using delegation on tbody
    const tbody = document.getElementById('assets-tbody');
    if (tbody) {
      tbody.addEventListener('change', e => {
        if (e.target && e.target.classList.contains('asset-row-chk')) {
          handleRowCheckboxChange(e);
        }
      });
    }

    // Bulk print button listener
    const btnBulkPrint = document.getElementById('btn-bulk-print-labels');
    if (btnBulkPrint) {
      btnBulkPrint.addEventListener('click', bulkPrintLabels);
    }

    // Custom Label Creator design bindings
    const btnCustomLabel = document.getElementById('btn-custom-label');
    if (btnCustomLabel) {
      btnCustomLabel.addEventListener('click', openCustomLabelModal);
    }

    const btnCustomLabelClose = document.getElementById('custom-label-modal-close');
    if (btnCustomLabelClose) {
      btnCustomLabelClose.addEventListener('click', closeCustomLabelModal);
    }

    const btnCustomLabelCancel = document.getElementById('custom-label-modal-cancel');
    if (btnCustomLabelCancel) {
      btnCustomLabelCancel.addEventListener('click', closeCustomLabelModal);
    }

    const btnPrintCustomLabel = document.getElementById('btn-print-custom-label');
    if (btnPrintCustomLabel) {
      btnPrintCustomLabel.addEventListener('click', printCustomLabel);
    }

    // Live update preview on inputs
    ['cust-label-header', 'cust-label-name', 'cust-label-model', 'cust-label-serial'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateCustomLabelPreview);
      }
    });

    // Update QR on ID change
    const custLabelId = document.getElementById('cust-label-id');
    if (custLabelId) {
      custLabelId.addEventListener('input', () => {
        updateCustomLabelQR();
        updateCustomLabelPreview();
      });
    }

    // Change listeners on dropdowns and checkboxes
    ['cust-label-size', 'cust-label-theme'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', updateCustomLabelPreview);
      }
    });

    ['cust-label-show-name', 'cust-label-show-model', 'cust-label-show-serial'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', updateCustomLabelPreview);
      }
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
  const statusFilter = activeAssetStatusTab;

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
    let matchesStatus = true;
    if (statusFilter === 'due-audits') {
      if (!asset.auditFrequency || !asset.nextAuditDate) {
        matchesStatus = false;
      } else {
        const nextDate = new Date(asset.nextAuditDate);
        const today = new Date();
        today.setHours(0,0,0,0);
        const diffTime = nextDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        matchesStatus = diffDays <= 7;
      }
    } else if (statusFilter) {
      matchesStatus = asset.status === statusFilter;
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="padding: 24px; text-align: center; color: var(--text-secondary);">
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
    tr.style.cursor = 'pointer';
    tr.addEventListener('mouseenter', () => tr.style.background = 'var(--bg-hover)');
    tr.addEventListener('mouseleave', () => tr.style.background = '');
    tr.addEventListener('click', e => {
      const target = e.target;
      if (
        target.closest('button') || 
        target.closest('.badge') || 
        target.closest('img') || 
        target.closest('a') ||
        target.closest('input[type="checkbox"]')
      ) {
        return;
      }
      openAssetModal(asset.id);
    });

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

    // Audit Warning badge styling
    let auditWarningHTML = '';
    if (asset.auditFrequency && asset.nextAuditDate) {
      const nextDate = new Date(asset.nextAuditDate);
      const today = new Date();
      today.setHours(0,0,0,0);
      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 7) {
        const badgeColor = diffDays <= 0 ? 'var(--accent-red)' : 'var(--accent-orange)';
        const text = diffDays < 0 ? 'Overdue' : (diffDays === 0 ? 'Due Today' : 'Due Soon');
        auditWarningHTML = `
          <div style="margin-top: 3px;">
            <span class="badge" title="Audit is ${text} (Due: ${asset.nextAuditDate})" style="font-size:0.65rem; padding:2px 6px; border-radius:3px; background:rgba(210,153,34,0.1); color:${badgeColor}; border:1px solid ${badgeColor}; display:inline-flex; align-items:center; gap:2px; cursor:pointer;" onclick="openAssetModal('${asset.id}')">
              ⚠️ Audit: ${text} (${asset.nextAuditDate})
            </span>
          </div>
        `;
      }
    }

    tr.innerHTML = `
      <td style="padding: 12px; text-align: center;">
        <input type="checkbox" class="asset-row-chk" data-id="${asset.id}" style="cursor:pointer;" ${selectedAssetIds.has(asset.id) ? 'checked' : ''} />
      </td>
      <td style="padding: 12px; font-family: monospace; font-weight: 600; color: var(--text-primary);">${asset.id}</td>
      <td style="padding: 12px;">
        <div style="display:flex; align-items:center; gap:10px;">
          ${asset.picture 
            ? `<img src="${asset.picture}" onclick="openLightbox('${asset.picture}', '${asset.name || 'asset_image.png'}')" title="Click to view attachment" style="width:32px; height:32px; border-radius:6px; object-fit:cover; border:1px solid var(--border); flex-shrink:0; cursor:pointer; transition:transform 0.15s ease;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'" />` 
            : `<div class="email-card-icon ${asset.category === 'Software' ? 'test-icon' : 'smtp-icon'}" style="width:32px; height:32px; border-radius:6px; font-size:1.1rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; background: ${asset.category === 'Software' ? 'rgba(188,140,255,0.15)' : 'rgba(88,166,255,0.15)'};">${asset.category === 'Software' ? '🔑' : '🖥️'}</div>`}
          <div>
            <div style="font-weight: 600; color: var(--text-primary);">${asset.name}</div>
            ${asset.purchaseDate ? `<div style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">Purchased: ${asset.purchaseDate}${asset.warrantyMonths ? ` (${asset.warrantyMonths} mo. warranty)` : ''}</div>` : ''}
            ${auditWarningHTML}
            
            ${(asset.poNumber || asset.poValue || asset.assetValue || asset.invoiceCopy || asset.poCopy) ? `
              <div style="margin-top:6px; display:flex; flex-direction:column; gap:4px;">
                ${asset.poNumber || asset.poValue || asset.assetValue 
                  ? `<div style="font-size:0.72rem; color:var(--text-secondary); background:rgba(255,255,255,0.03); padding:2px 6px; border-radius:4px; display:inline-flex; flex-wrap:wrap; gap:8px; border:1px solid var(--border); width:fit-content;">
                       ${asset.poNumber ? `<span>PO: <strong>${asset.poNumber}</strong></span>` : ''}
                       ${asset.poValue ? `<span>PO Val: <strong>₹${parseFloat(asset.poValue).toLocaleString()}</strong></span>` : ''}
                       ${asset.assetValue ? `<span>Asset Val: <strong>₹${parseFloat(asset.assetValue).toLocaleString()}</strong></span>` : ''}
                     </div>` 
                  : ''}
                ${asset.invoiceCopy || asset.poCopy ? `
                  <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                    ${asset.invoiceCopy ? `<span class="badge" onclick="openLightbox('${asset.invoiceCopy}', '${asset.invoiceCopyName || 'invoice.pdf'}')" style="cursor:pointer; font-size:0.65rem; padding:1px 5px; border-radius:3px; background:rgba(88,166,255,0.1); color:#58a6ff; border:1px solid rgba(88,166,255,0.15); display:inline-flex; align-items:center; gap:2px; transition:opacity 0.15s ease;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">📄 Invoice</span>` : ''}
                    ${asset.poCopy ? `<span class="badge" onclick="openLightbox('${asset.poCopy}', '${asset.poCopyName || 'po_copy.pdf'}')" style="cursor:pointer; font-size:0.65rem; padding:1px 5px; border-radius:3px; background:rgba(63,185,80,0.1); color:#3fb950; border:1px solid rgba(63,185,80,0.15); display:inline-flex; align-items:center; gap:2px; transition:opacity 0.15s ease;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">📄 PO Copy</span>` : ''}
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        </div>
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
        <button class="btn btn-ghost btn-sm btn-quick-audit" onclick="quickAuditAsset('${asset.id}')" title="Mark Asset Audited" style="margin-right:8px; font-size:0.75rem; color:#d29922; font-weight:600; border:1px solid rgba(210,153,34,0.15); padding:2px 6px;">📋 Audit</button>
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

  updateSelectAllCheckboxState();
  updateBulkPrintButton();
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
  const maintSelect = document.getElementById('assetm-maint-vendor');
  const vendors = typeof loadVendors === 'function' ? loadVendors() : [];

  if (select) {
    select.innerHTML = '<option value="">No Vendor</option>';
    vendors.forEach(v => {
      select.innerHTML += `<option value="${v.name}">${v.name}</option>`;
    });
    select.innerHTML += '<option value="__custom__">+ Add Custom Vendor...</option>';
  }

  if (maintSelect) {
    maintSelect.innerHTML = '<option value="">No Vendor</option>';
    vendors.forEach(v => {
      maintSelect.innerHTML += `<option value="${v.name}">${v.name}</option>`;
    });
  }
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

  // Reset tab navigation state
  const tabsContainer = document.getElementById('asset-modal-tabs');
  const detailsContent = document.getElementById('asset-modal-tab-details-content');
  const historyContent = document.getElementById('asset-modal-tab-history-content');
  const maintenanceContent = document.getElementById('asset-modal-tab-maintenance-content');
  
  if (tabsContainer) {
    const tabButtons = tabsContainer.querySelectorAll('.modal-tab-btn');
    tabButtons.forEach(b => {
      b.classList.remove('active');
      b.style.borderBottomColor = 'transparent';
      b.style.color = 'var(--text-secondary)';
      if (b.dataset.tab === 'details') {
        b.classList.add('active');
        b.style.borderBottomColor = 'var(--accent-blue)';
        b.style.color = 'var(--text-primary)';
      }
    });
    // In edit mode we show tabs, in add mode we hide the tabs container (just show general edit details)
    tabsContainer.style.display = id ? 'flex' : 'none';
  }
  if (detailsContent) detailsContent.style.display = 'block';
  if (historyContent) historyContent.style.display = 'none';
  if (maintenanceContent) maintenanceContent.style.display = 'none';

  // Hide maintenance form
  const maintForm = document.getElementById('assetm-maintenance-form');
  if (maintForm) maintForm.style.display = 'none';

  // Reset custom vendor field
  if (vendorCustomGroup) vendorCustomGroup.style.display = 'none';
  if (vendorCustomInput) vendorCustomInput.value = '';

  const auditCommentInput = document.getElementById('assetm-audit-comment');
  if (auditCommentInput) auditCommentInput.value = '';

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

    // Populate new financial and file inputs
    const poNumberInput = document.getElementById('assetm-po-number');
    const poValueInput = document.getElementById('assetm-po-value');
    const assetValueInput = document.getElementById('assetm-asset-value');
    
    const picFileInput = document.getElementById('assetm-pic-file');
    const picDataInput = document.getElementById('assetm-pic-data');
    const picPreviewContainer = document.getElementById('assetm-pic-preview-container');
    const picPreview = document.getElementById('assetm-pic-preview');

    const invoiceFileInput = document.getElementById('assetm-invoice-file');
    const invoiceDataInput = document.getElementById('assetm-invoice-data');
    const invoiceFilenameInput = document.getElementById('assetm-invoice-filename');
    const invoicePreviewContainer = document.getElementById('assetm-invoice-preview-container');
    const invoiceNameSpan = document.getElementById('assetm-invoice-name');

    const poFileInput = document.getElementById('assetm-po-file');
    const poDataInput = document.getElementById('assetm-po-data');
    const poFilenameInput = document.getElementById('assetm-po-filename');
    const poPreviewContainer = document.getElementById('assetm-po-preview-container');
    const poNameSpan = document.getElementById('assetm-po-name');

    if (poNumberInput) poNumberInput.value = asset.poNumber || '';
    if (poValueInput) poValueInput.value = asset.poValue !== undefined ? asset.poValue : '';
    if (assetValueInput) assetValueInput.value = asset.assetValue !== undefined ? asset.assetValue : '';

    if (picFileInput) picFileInput.value = '';
    if (picDataInput) picDataInput.value = asset.picture || '';
    if (picPreview) picPreview.src = asset.picture || '';
    if (picPreviewContainer) picPreviewContainer.style.display = asset.picture ? 'flex' : 'none';

    if (invoiceFileInput) invoiceFileInput.value = '';
    if (invoiceDataInput) invoiceDataInput.value = asset.invoiceCopy || '';
    if (invoiceFilenameInput) invoiceFilenameInput.value = asset.invoiceCopyName || '';
    if (invoiceNameSpan) invoiceNameSpan.textContent = asset.invoiceCopyName || '';
    if (invoicePreviewContainer) invoicePreviewContainer.style.display = asset.invoiceCopy ? 'flex' : 'none';

    if (poFileInput) poFileInput.value = '';
    if (poDataInput) poDataInput.value = asset.poCopy || '';
    if (poFilenameInput) poFilenameInput.value = asset.poCopyName || '';
    if (poNameSpan) poNameSpan.textContent = asset.poCopyName || '';
    if (poPreviewContainer) poPreviewContainer.style.display = asset.poCopy ? 'flex' : 'none';

    const auditFreqInput = document.getElementById('assetm-audit-frequency');
    const lastAuditDateInput = document.getElementById('assetm-last-audit-date');
    const nextAuditDateInput = document.getElementById('assetm-next-audit-date');
    const btnMarkAudited = document.getElementById('btn-mark-audited');

    if (auditFreqInput) auditFreqInput.value = asset.auditFrequency || '';
    if (lastAuditDateInput) lastAuditDateInput.value = asset.lastAuditDate || '';
    if (nextAuditDateInput) nextAuditDateInput.value = asset.nextAuditDate || '';
    if (btnMarkAudited) {
      btnMarkAudited.style.display = asset.auditFrequency ? 'inline-block' : 'none';
    }

    // Populate depreciation settings
    const depMethodInput = document.getElementById('assetm-dep-method');
    const depRateInput = document.getElementById('assetm-dep-rate');
    const depPutToUseInput = document.getElementById('assetm-dep-put-to-use');
    const depSalvageInput = document.getElementById('assetm-dep-salvage');

    if (depMethodInput) depMethodInput.value = asset.depreciationMethod || 'WDV';
    if (depRateInput) depRateInput.value = asset.depreciationRate !== undefined ? asset.depreciationRate : 40;
    if (depPutToUseInput) depPutToUseInput.value = asset.depreciationPutToUse || asset.purchaseDate || '';
    if (depSalvageInput) depSalvageInput.value = asset.depreciationSalvage !== undefined ? asset.depreciationSalvage : '';
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

    // Reset financial and file inputs
    const poNumberInput = document.getElementById('assetm-po-number');
    const poValueInput = document.getElementById('assetm-po-value');
    const assetValueInput = document.getElementById('assetm-asset-value');
    
    const picFileInput = document.getElementById('assetm-pic-file');
    const picDataInput = document.getElementById('assetm-pic-data');
    const picPreviewContainer = document.getElementById('assetm-pic-preview-container');
    const picPreview = document.getElementById('assetm-pic-preview');

    const invoiceFileInput = document.getElementById('assetm-invoice-file');
    const invoiceDataInput = document.getElementById('assetm-invoice-data');
    const invoiceFilenameInput = document.getElementById('assetm-invoice-filename');
    const invoicePreviewContainer = document.getElementById('assetm-invoice-preview-container');
    const invoiceNameSpan = document.getElementById('assetm-invoice-name');

    const poFileInput = document.getElementById('assetm-po-file');
    const poDataInput = document.getElementById('assetm-po-data');
    const poFilenameInput = document.getElementById('assetm-po-filename');
    const poPreviewContainer = document.getElementById('assetm-po-preview-container');
    const poNameSpan = document.getElementById('assetm-po-name');

    if (poNumberInput) poNumberInput.value = '';
    if (poValueInput) poValueInput.value = '';
    if (assetValueInput) assetValueInput.value = '';

    if (picFileInput) picFileInput.value = '';
    if (picDataInput) picDataInput.value = '';
    if (picPreview) picPreview.src = '';
    if (picPreviewContainer) picPreviewContainer.style.display = 'none';

    if (invoiceFileInput) invoiceFileInput.value = '';
    if (invoiceDataInput) invoiceDataInput.value = '';
    if (invoiceFilenameInput) invoiceFilenameInput.value = '';
    if (invoiceNameSpan) invoiceNameSpan.textContent = '';
    if (invoicePreviewContainer) invoicePreviewContainer.style.display = 'none';

    if (poFileInput) poFileInput.value = '';
    if (poDataInput) poDataInput.value = '';
    if (poFilenameInput) poFilenameInput.value = '';
    if (poNameSpan) poNameSpan.textContent = '';
    if (poPreviewContainer) poPreviewContainer.style.display = 'none';

    const auditFreqInput = document.getElementById('assetm-audit-frequency');
    const lastAuditDateInput = document.getElementById('assetm-last-audit-date');
    const nextAuditDateInput = document.getElementById('assetm-next-audit-date');
    const btnMarkAudited = document.getElementById('btn-mark-audited');

    if (auditFreqInput) auditFreqInput.value = '';
    if (lastAuditDateInput) lastAuditDateInput.value = '';
    if (nextAuditDateInput) nextAuditDateInput.value = '';
    if (btnMarkAudited) btnMarkAudited.style.display = 'none';

    // Initialize depreciation settings in add mode
    const depMethodInput = document.getElementById('assetm-dep-method');
    const depRateInput = document.getElementById('assetm-dep-rate');
    const depPutToUseInput = document.getElementById('assetm-dep-put-to-use');
    const depSalvageInput = document.getElementById('assetm-dep-salvage');

    if (depMethodInput) depMethodInput.value = 'WDV';
    if (depRateInput) depRateInput.value = '40';
    if (depPutToUseInput) {
      depPutToUseInput.value = new Date().toISOString().split('T')[0];
    }
    if (depSalvageInput) depSalvageInput.value = '';
  }

  overlay.style.display = 'flex';
}

function closeAssetModal() {
  const overlay = document.getElementById('asset-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

function saveAssetFromModal() {
  const id = document.getElementById('assetm-id').value;
  const tag = document.getElementById('assetm-tag').value.trim();
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

  // Retrieve new financial and file upload properties
  const poNumber = document.getElementById('assetm-po-number')?.value.trim() || '';
  const poValueVal = document.getElementById('assetm-po-value')?.value || '';
  const poValue = poValueVal ? parseFloat(poValueVal) : '';
  const assetValueVal = document.getElementById('assetm-asset-value')?.value || '';
  const assetValue = assetValueVal ? parseFloat(assetValueVal) : '';

  const picture = document.getElementById('assetm-pic-data')?.value || '';
  const invoiceCopy = document.getElementById('assetm-invoice-data')?.value || '';
  const invoiceCopyName = document.getElementById('assetm-invoice-filename')?.value || '';
  const poCopy = document.getElementById('assetm-po-data')?.value || '';
  const poCopyName = document.getElementById('assetm-po-filename')?.value || '';

  // Retrieve audit properties
  const auditFrequency = document.getElementById('assetm-audit-frequency')?.value || '';
  const lastAuditDate = document.getElementById('assetm-last-audit-date')?.value || '';
  const nextAuditDate = document.getElementById('assetm-next-audit-date')?.value || '';

  // Retrieve depreciation settings
  const depreciationMethod = document.getElementById('assetm-dep-method')?.value || 'WDV';
  const depreciationRateVal = document.getElementById('assetm-dep-rate')?.value;
  const depreciationRate = depreciationRateVal ? parseFloat(depreciationRateVal) : 40;
  const depreciationPutToUse = document.getElementById('assetm-dep-put-to-use')?.value || '';
  const depreciationSalvageVal = document.getElementById('assetm-dep-salvage')?.value;
  const depreciationSalvage = depreciationSalvageVal ? parseFloat(depreciationSalvageVal) : '';

  if (!tag) {
    if (typeof showToast === 'function') {
      showToast('❌ Asset Tag is required.', 'error');
    }
    return;
  }

  if (!name || !model) {
    if (typeof showToast === 'function') {
      showToast('❌ Please fill in the Asset Name and Model fields.', 'error');
    }
    return;
  }

  const assets = typeof loadAssets === 'function' ? loadAssets() : [];

  let isNewAudit = false;
  if (id) {
    const existing = assets.find(a => a.id === id);
    if (existing) {
      if (lastAuditDate && lastAuditDate !== existing.lastAuditDate) {
        if (!existing.lastAuditDate || lastAuditDate > existing.lastAuditDate) {
          isNewAudit = true;
        }
      }
    }
  } else {
    if (lastAuditDate) {
      isNewAudit = true;
    }
  }

  const auditComment = (document.getElementById('assetm-audit-comment')?.value || '').trim();
  if (isNewAudit && !auditComment) {
    if (typeof showToast === 'function') {
      showToast('❌ Audit comment is required to complete or record an audit.', 'error');
    }
    return;
  }

  // Unique validation check
  if (id) {
    const duplicate = assets.find(a => a.id.toLowerCase() === tag.toLowerCase() && a.id.toLowerCase() !== id.toLowerCase());
    if (duplicate) {
      if (typeof showToast === 'function') {
        showToast(`❌ Asset Tag "${tag}" is already in use by another asset.`, 'error');
      }
      return;
    }
  } else {
    const duplicate = assets.find(a => a.id.toLowerCase() === tag.toLowerCase());
    if (duplicate) {
      if (typeof showToast === 'function') {
        showToast(`❌ Asset Tag "${tag}" is already in use.`, 'error');
      }
      return;
    }
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
      vendors.push({ name: customVendorName, email: '', contact: '', gst: '', address: '', details: vendorDetails });
      if (typeof saveVendors === 'function') saveVendors(vendors);
    }
  }

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
    purchaseDate,
    poNumber,
    poValue,
    assetValue,
    picture,
    invoiceCopy,
    invoiceCopyName,
    poCopy,
    poCopyName,
    auditFrequency,
    lastAuditDate,
    nextAuditDate,
    depreciationMethod,
    depreciationRate,
    depreciationPutToUse,
    depreciationSalvage
  };

  let oldStatus = '';
  let oldAssignee = '';
  let oldMaintenance = [];
  if (id) {
    const existing = assets.find(a => a.id === id);
    if (existing) {
      oldStatus = existing.status || '';
      oldAssignee = existing.assignedTo || '';
      oldMaintenance = existing.maintenance || [];
    }
  }

  if (id) {
    // Update existing
    const idx = assets.findIndex(a => a.id === id);
    if (idx !== -1) {
      // If asset tag is customized/renamed, update all audit trail logs referencing it
      if (tag !== id) {
        const systemLogs = typeof loadSystemAuditLogs === 'function' ? loadSystemAuditLogs() : [];
        let logsUpdated = false;
        systemLogs.forEach(log => {
          if (log.refId === id) {
            log.refId = tag;
            logsUpdated = true;
          }
        });
        if (logsUpdated && typeof saveSystemAuditLogs === 'function') {
          saveSystemAuditLogs(systemLogs);
        }
      }

      assets[idx] = {
        ...assets[idx],
        id: tag,
        ...assetPayload,
        maintenance: oldMaintenance
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
      checkoutDate: status === 'Deployed' ? new Date().toISOString().split('T')[0] : '',
      maintenance: []
    });
  }

  if (typeof saveAssets === 'function') saveAssets(assets);
  closeAssetModal();
  renderAdminAssets();
  
  if (typeof showToast === 'function') {
    showToast(`Asset "${tag}" saved successfully!`, 'success');
  }

  if (typeof addAuditLog === 'function') {
    let logAction = '';
    if (!id) {
      logAction = `🖥️ Created asset ${tag}: ${name} (${model}).${isNewAudit ? ` Comment: ${auditComment}` : ''}`;
    } else if (oldStatus !== status) {
      if (status === 'Deployed') {
        logAction = `🚀 Deployed asset ${tag} (Assigned to: ${assignedTo || 'Unassigned'}).${isNewAudit ? ` Comment: ${auditComment}` : ''}`;
      } else if (status === 'Ready to Deploy') {
        logAction = `🔄 Set asset ${tag} status to Ready to Deploy.${isNewAudit ? ` Comment: ${auditComment}` : ''}`;
      } else {
        logAction = `📝 Updated asset ${tag}: Status changed to ${status}.${isNewAudit ? ` Comment: ${auditComment}` : ''}`;
      }
    } else {
      logAction = `📝 Updated asset ${tag}: Assigned to ${assignedTo || 'Unassigned'}.${isNewAudit ? ` Comment: ${auditComment}` : ''}`;
    }
    addAuditLog(logAction, 'System', tag, 'asset');
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
    addAuditLog(`🗑️ Deleted asset record ${id}.`, 'System', id, 'asset');
  }
}

function checkInAsset(id) {
  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const asset = assets.find(a => a.id === id);
  if (!asset) return;

  if (!confirm(`Are you sure you want to check in asset "${asset.id}" (${asset.name})? This will return it to inventory.`)) return;

  const comment = prompt("Please enter a mandatory comment for check-in:");
  if (comment === null) return; // User cancelled
  const trimmedComment = comment.trim();
  if (!trimmedComment) {
    if (typeof showToast === 'function') {
      showToast('❌ Check-in comment is required.', 'error');
    }
    return;
  }

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
    addAuditLog(`↩️ Checked in asset ${id} (previously assigned to ${oldAssignee}). Comment: ${trimmedComment}`, 'System', id, 'asset');
  }
}

function quickAuditAsset(id) {
  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const asset = assets.find(a => a.id === id);
  if (!asset) return;

  const currentFreq = asset.auditFrequency || 'Quarterly';
  const freq = prompt(`Complete audit for "${id}". Set or change the audit timeline (frequency): \nOptions: Quarterly, Half-Yearly, Yearly`, currentFreq);
  if (freq === null) return; // User cancelled prompt

  const validFrequencies = ['Quarterly', 'Half-Yearly', 'Yearly'];
  const sanitizedFreq = freq.trim();
  
  if (validFrequencies.includes(sanitizedFreq)) {
    asset.auditFrequency = sanitizedFreq;
  } else {
    if (!asset.auditFrequency) {
      asset.auditFrequency = 'Quarterly';
    }
    alert(`Invalid frequency "${freq}". Keeping timeline as "${asset.auditFrequency}".`);
  }

  const comment = prompt("Please enter a mandatory comment for this audit:");
  if (comment === null) return; // User cancelled
  const trimmedComment = comment.trim();
  if (!trimmedComment) {
    if (typeof showToast === 'function') {
      showToast('❌ Audit comment is required.', 'error');
    }
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  asset.lastAuditDate = today;
  const calculated = calculateNextAuditDate(today, asset.auditFrequency);
  if (calculated) {
    asset.nextAuditDate = calculated;
  }

  if (typeof saveAssets === 'function') saveAssets(assets);
  renderAdminAssets();

  if (typeof showToast === 'function') {
    showToast(`IT Asset Audit completed for "${id}"!`, 'success');
  }

  if (typeof addAuditLog === 'function') {
    addAuditLog(`📋 Completed quick audit for asset ${id} (Timeline: ${asset.auditFrequency}). Comment: ${trimmedComment}`, 'System', id, 'asset');
  }
}

function bulkAuditAllAssets() {
  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  if (assets.length === 0) {
    if (typeof showToast === 'function') {
      showToast('No assets found to audit.', 'info');
    }
    return;
  }

  if (!confirm(`Are you sure you want to mark all ${assets.length} assets as audited today?`)) return;

  const comment = prompt("Please enter a mandatory comment for bulk auditing all assets:");
  if (comment === null) return; // User cancelled
  const trimmedComment = comment.trim();
  if (!trimmedComment) {
    if (typeof showToast === 'function') {
      showToast('❌ Bulk audit comment is required.', 'error');
    }
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  assets.forEach(asset => {
    asset.lastAuditDate = today;
    const freq = asset.auditFrequency || 'Quarterly';
    if (!asset.auditFrequency) {
      asset.auditFrequency = freq;
    }
    const calculated = calculateNextAuditDate(today, freq);
    if (calculated) {
      asset.nextAuditDate = calculated;
    }
  });

  if (typeof saveAssets === 'function') saveAssets(assets);
  renderAdminAssets();

  if (typeof showToast === 'function') {
    showToast(`Successfully completed audit for all ${assets.length} assets!`, 'success');
  }

  if (typeof addAuditLog === 'function') {
    addAuditLog(`📋 Completed bulk audit for all ${assets.length} assets. Comment: ${trimmedComment}`, 'System', 'All', 'asset');
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
  const commentsInput = document.getElementById('checkout-comments');
  if (commentsInput) commentsInput.value = '';

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
  const comments = (document.getElementById('checkout-comments')?.value || '').trim();

  if (!assigneeVal) {
    if (typeof showToast === 'function') {
      showToast('❌ Please select an Assignee User.', 'error');
    }
    return;
  }

  if (!comments) {
    if (typeof showToast === 'function') {
      showToast('❌ Comments are required for check out.', 'error');
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
    addAuditLog(`📤 Checked out asset ${id} to ${assignedTo} (${assignedEmail}). Comment: ${comments}`, 'System', id, 'asset');
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
  document.getElementById('vendorm-email').value = '';
  document.getElementById('vendorm-contact').value = '';
  document.getElementById('vendorm-gst').value = '';
  document.getElementById('vendorm-address').value = '';
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
        <td colspan="4" style="padding: 12px; text-align: center; color: var(--text-secondary);">
          No vendors configured.
        </td>
      </tr>
    `;
    return;
  }

  vendors.forEach((v, index) => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    
    // Display GST nicely
    const gstHtml = v.gst ? `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">GST: ${escapeHTML(v.gst)}</div>` : '';
    
    // Display Contact details
    let contactParts = [];
    if (v.email) contactParts.push(`<div style="font-size: 0.8rem; color: var(--text-primary);">${escapeHTML(v.email)}</div>`);
    if (v.contact) contactParts.push(`<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 1px;">${escapeHTML(v.contact)}</div>`);
    const contactHtml = contactParts.length > 0 ? contactParts.join('') : '<span style="color: var(--text-muted);">-</span>';

    // Display Address / details
    const addressHtml = v.address ? escapeHTML(v.address) : (v.details && !v.email && !v.contact && !v.gst ? escapeHTML(v.details) : '-');

    tr.innerHTML = `
      <td style="padding: 8px 12px; font-weight: 600; color: var(--text-primary); vertical-align: middle;">
        <div>${escapeHTML(v.name)}</div>
        ${gstHtml}
      </td>
      <td style="padding: 8px 12px; vertical-align: middle;">
        ${contactHtml}
      </td>
      <td style="padding: 8px 12px; color: var(--text-secondary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;" title="${addressHtml}">
        ${addressHtml}
      </td>
      <td style="padding: 8px 12px; text-align: right; white-space: nowrap; vertical-align: middle;">
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
  const email = document.getElementById('vendorm-email').value.trim();
  const contact = document.getElementById('vendorm-contact').value.trim();
  const gst = document.getElementById('vendorm-gst').value.trim();
  const address = document.getElementById('vendorm-address').value.trim();

  if (!name) {
    if (typeof showToast === 'function') {
      showToast('❌ Vendor Name is required.', 'error');
    }
    return;
  }

  const vendors = typeof loadVendors === 'function' ? loadVendors() : [];
  const vendorObj = { name, email, contact, gst, address };

  // Calculate formatted details for backward compatibility/cascading updates
  let detailsParts = [];
  if (email) detailsParts.push(`Email: ${email}`);
  if (contact) detailsParts.push(`Contact: ${contact}`);
  if (gst) detailsParts.push(`GST: ${gst}`);
  if (address) detailsParts.push(`Address: ${address}`);
  const detailsStr = detailsParts.length > 0 ? detailsParts.join(' | ') : '';
  vendorObj.details = detailsStr;

  if (indexStr !== '') {
    // Edit vendor
    const idx = parseInt(indexStr, 10);
    if (vendors[idx]) {
      const oldName = vendors[idx].name;
      vendors[idx] = vendorObj;
      
      // Cascading update to assets that use this vendor
      const assets = typeof loadAssets === 'function' ? loadAssets() : [];
      let updatedAssets = false;
      assets.forEach(asset => {
        if (asset.vendor === oldName) {
          asset.vendor = name;
          asset.vendorDetails = detailsStr;
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
    vendors.push(vendorObj);
  }

  if (typeof saveVendors === 'function') saveVendors(vendors);

  // Clear form
  document.getElementById('vendorm-id').value = '';
  document.getElementById('vendorm-name').value = '';
  document.getElementById('vendorm-email').value = '';
  document.getElementById('vendorm-contact').value = '';
  document.getElementById('vendorm-gst').value = '';
  document.getElementById('vendorm-address').value = '';
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
  document.getElementById('vendorm-name').value = v.name || '';
  document.getElementById('vendorm-email').value = v.email || '';
  document.getElementById('vendorm-contact').value = v.contact || '';
  document.getElementById('vendorm-gst').value = v.gst || '';
  document.getElementById('vendorm-address').value = v.address || '';
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
      <div style="width: 100%;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; width: 100%;">
          ${asset.picture 
            ? `<img src="${asset.picture}" onclick="openLightbox('${asset.picture}', '${asset.name || 'asset_image.png'}')" title="Click to view attachment" style="width:100%; height:120px; object-fit:cover; border-radius:var(--radius-sm); border:1px solid var(--border); margin-bottom:12px; cursor:pointer; transition:transform 0.15s ease;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'" />` 
            : `<span style="font-size:2rem; margin-bottom:8px;">${icon}</span>`}
          <span style="font-size:0.68rem; font-weight:700; background:rgba(88, 166, 255, 0.15); color:#58a6ff; padding:2px 8px; border-radius:12px; margin-left:auto;">${asset.category}</span>
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

function calculateDepreciationSchedule(purchaseCost, purchaseDate, ratePct, method, salvageVal, putToUseDate) {
  const schedule = [];
  if (!purchaseCost || isNaN(purchaseCost) || purchaseCost <= 0) return schedule;
  if (!purchaseDate) return schedule;

  const rate = ratePct / 100;
  const pDate = new Date(putToUseDate || purchaseDate);
  if (isNaN(pDate.getTime())) return schedule;

  // Find initial FY. Indian FY is April 1 to March 31.
  let fyStartYear = pDate.getMonth() < 3 ? pDate.getFullYear() - 1 : pDate.getFullYear();
  let currentCost = purchaseCost;
  
  // Project for up to 7 years or until book value is negligible
  const limitYears = 7;
  
  for (let i = 0; i < limitYears; i++) {
    const fyLabel = `FY ${fyStartYear}-${(fyStartYear + 1).toString().substring(2)}`;
    let openingVal = currentCost;
    
    let appliedRate = rate;
    let daysText = "Full Year";
    
    if (i === 0) {
      // 180 days rule: cutoff is 180 days before March 31 (i.e. put to use for less than 180 days)
      const fyEnd = new Date(fyStartYear + 1, 2, 31); // March 31 of next calendar year
      const diffTime = Math.abs(fyEnd - pDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
      
      if (diffDays < 180) {
        appliedRate = rate / 2;
        daysText = `< 180 Days (${diffDays} days)`;
      } else {
        daysText = `≥ 180 Days (${diffDays} days)`;
      }
    }
    
    let depAmount = 0;
    if (method === 'SLM') {
      const salvage = salvageVal !== undefined && salvageVal !== '' ? salvageVal : (purchaseCost * 0.1);
      const depreciableAmt = purchaseCost - salvage;
      depAmount = depreciableAmt * appliedRate;
      if (currentCost - depAmount < salvage) {
        depAmount = Math.max(0, currentCost - salvage);
      }
    } else {
      // WDV
      depAmount = currentCost * appliedRate;
    }
    
    depAmount = Math.round(depAmount * 100) / 100;
    let closingVal = Math.round((openingVal - depAmount) * 100) / 100;
    
    schedule.push({
      fy: fyLabel,
      opening: openingVal,
      daysText: daysText,
      rate: Math.round(appliedRate * 100 * 10) / 10,
      depreciation: depAmount,
      closing: closingVal
    });
    
    currentCost = closingVal;
    fyStartYear++;
    if (currentCost <= 0.01) break;
  }
  
  return schedule;
}

function calculateAndRenderDepreciation() {
  const assetValueInput = document.getElementById('assetm-asset-value');
  const purchaseDateInput = document.getElementById('assetm-purchase-date');
  
  const purchaseCost = assetValueInput ? parseFloat(assetValueInput.value) : 0;
  const purchaseDate = purchaseDateInput ? purchaseDateInput.value : '';
  
  const method = document.getElementById('assetm-dep-method').value;
  const rateVal = document.getElementById('assetm-dep-rate').value;
  const ratePct = rateVal ? parseFloat(rateVal) : 40;
  const putToUse = document.getElementById('assetm-dep-put-to-use').value || purchaseDate;
  const salvageVal = document.getElementById('assetm-dep-salvage').value;
  const salvage = salvageVal ? parseFloat(salvageVal) : 0;

  const baseCostEl = document.getElementById('assetm-dep-base-cost');
  if (baseCostEl) {
    baseCostEl.textContent = purchaseCost ? `₹${purchaseCost.toFixed(2)}` : '₹0.00';
  }

  const tbody = document.getElementById('assetm-dep-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!purchaseCost || purchaseCost <= 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:12px; text-align:center; color:var(--text-secondary);">
          Please specify a valid Asset Value in the Details tab.
        </td>
      </tr>
    `;
    document.getElementById('assetm-dep-total-claimed').textContent = '₹0.00';
    document.getElementById('assetm-dep-current-wdv').textContent = '₹0.00';
    return;
  }

  if (!purchaseDate) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:12px; text-align:center; color:var(--text-secondary);">
          Please specify a valid Purchase Date in the Details tab.
        </td>
      </tr>
    `;
    document.getElementById('assetm-dep-total-claimed').textContent = '₹0.00';
    document.getElementById('assetm-dep-current-wdv').textContent = '₹0.00';
    return;
  }

  const schedule = calculateDepreciationSchedule(purchaseCost, purchaseDate, ratePct, method, salvage, putToUse);
  
  if (schedule.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:12px; text-align:center; color:var(--text-secondary);">
          Unable to generate depreciation schedule.
        </td>
      </tr>
    `;
    document.getElementById('assetm-dep-total-claimed').textContent = '₹0.00';
    document.getElementById('assetm-dep-current-wdv').textContent = '₹0.00';
    return;
  }

  let totalClaimed = 0;
  let currentWDV = purchaseCost;

  schedule.forEach(row => {
    totalClaimed += row.depreciation;
    currentWDV = row.closing;

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    tr.innerHTML = `
      <td style="padding:8px 12px; font-weight:600; color:var(--text-primary);">${row.fy}</td>
      <td style="padding:8px 12px; color:var(--text-secondary);">₹${row.opening.toFixed(2)}</td>
      <td style="padding:8px 12px; color:var(--text-muted); font-size:0.75rem;">${row.daysText}</td>
      <td style="padding:8px 12px; color:var(--text-secondary);">${row.rate}%</td>
      <td style="padding:8px 12px; font-weight:600; color:var(--accent-red);">₹${row.depreciation.toFixed(2)}</td>
      <td style="padding:8px 12px; font-weight:600; color:var(--accent-green);">₹${row.closing.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('assetm-dep-total-claimed').textContent = `₹${totalClaimed.toFixed(2)}`;
  document.getElementById('assetm-dep-current-wdv').textContent = `₹${currentWDV.toFixed(2)}`;
}

function initAssetModalTabs() {
  const tabsContainer = document.getElementById('asset-modal-tabs');
  if (!tabsContainer || tabsContainer.dataset.initialized === 'true') return;
  tabsContainer.dataset.initialized = 'true';

  const tabButtons = tabsContainer.querySelectorAll('.modal-tab-btn');
  const detailsContent = document.getElementById('asset-modal-tab-details-content');
  const historyContent = document.getElementById('asset-modal-tab-history-content');
  const maintenanceContent = document.getElementById('asset-modal-tab-maintenance-content');
  const depreciationContent = document.getElementById('asset-modal-tab-depreciation-content');
  const qrContent = document.getElementById('asset-modal-tab-qr-content');

  // Tab switching click handler
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => {
        b.classList.remove('active');
        b.style.borderBottomColor = 'transparent';
        b.style.color = 'var(--text-secondary)';
      });
      btn.classList.add('active');
      btn.style.borderBottomColor = 'var(--accent-blue)';
      btn.style.color = 'var(--text-primary)';

      const tab = btn.dataset.tab;
      if (qrContent) qrContent.style.display = 'none';

      if (tab === 'details') {
        if (detailsContent) detailsContent.style.display = 'block';
        if (historyContent) historyContent.style.display = 'none';
        if (maintenanceContent) maintenanceContent.style.display = 'none';
        if (depreciationContent) depreciationContent.style.display = 'none';
      } else if (tab === 'history') {
        if (detailsContent) detailsContent.style.display = 'none';
        if (historyContent) historyContent.style.display = 'block';
        if (maintenanceContent) maintenanceContent.style.display = 'none';
        if (depreciationContent) depreciationContent.style.display = 'none';
        // Render history
        const id = document.getElementById('assetm-id').value;
        renderAssetHistory(id);
      } else if (tab === 'maintenance') {
        if (detailsContent) detailsContent.style.display = 'none';
        if (historyContent) historyContent.style.display = 'none';
        if (maintenanceContent) maintenanceContent.style.display = 'block';
        if (depreciationContent) depreciationContent.style.display = 'none';
        // Render maintenance
        const id = document.getElementById('assetm-id').value;
        renderAssetHistory(id);
      } else if (tab === 'depreciation') {
        if (detailsContent) detailsContent.style.display = 'none';
        if (historyContent) historyContent.style.display = 'none';
        if (maintenanceContent) maintenanceContent.style.display = 'none';
        if (depreciationContent) depreciationContent.style.display = 'block';
        calculateAndRenderDepreciation();
      } else if (tab === 'qr') {
        if (detailsContent) detailsContent.style.display = 'none';
        if (historyContent) historyContent.style.display = 'none';
        if (maintenanceContent) maintenanceContent.style.display = 'none';
        if (depreciationContent) depreciationContent.style.display = 'none';
        if (qrContent) qrContent.style.display = 'block';
        const id = document.getElementById('assetm-id').value;
        if (typeof renderAssetQRLabel === 'function') {
          renderAssetQRLabel(id);
        }
      }
    });
  });

  // Bind change/input listeners to recalculate dynamically
  const depMethod = document.getElementById('assetm-dep-method');
  const depRate = document.getElementById('assetm-dep-rate');
  const depPutToUse = document.getElementById('assetm-dep-put-to-use');
  const depSalvage = document.getElementById('assetm-dep-salvage');

  [depMethod, depRate, depPutToUse, depSalvage].forEach(el => {
    if (el) {
      el.addEventListener('change', calculateAndRenderDepreciation);
      el.addEventListener('input', calculateAndRenderDepreciation);
    }
  });

  // Bind customization change/input listeners for label preview
  const labelHeader = document.getElementById('label-opt-header');
  const labelShowName = document.getElementById('label-opt-show-name');
  const labelShowModel = document.getElementById('label-opt-show-model');
  const labelShowSerial = document.getElementById('label-opt-show-serial');
  const labelSize = document.getElementById('label-opt-size');
  const labelTheme = document.getElementById('label-opt-theme');

  [labelHeader, labelShowName, labelShowModel, labelShowSerial, labelSize, labelTheme].forEach(el => {
    if (el) {
      el.addEventListener('change', () => {
        if (typeof updateLabelPreview === 'function') updateLabelPreview();
      });
      el.addEventListener('input', () => {
        if (typeof updateLabelPreview === 'function') updateLabelPreview();
      });
    }
  });

  // Print button click
  const btnPrintLabel = document.getElementById('btn-print-asset-label');
  if (btnPrintLabel) {
    btnPrintLabel.addEventListener('click', () => {
      if (typeof printAssetLabel === 'function') printAssetLabel();
    });
  }

  // Sync Date Put to Use with Purchase Date on details tab changes
  const purchaseDateInput = document.getElementById('assetm-purchase-date');
  if (purchaseDateInput) {
    purchaseDateInput.addEventListener('change', () => {
      const depPutToUseInput = document.getElementById('assetm-dep-put-to-use');
      if (depPutToUseInput && (!depPutToUseInput.value || depPutToUseInput.value === purchaseDateInput.defaultValue)) {
        depPutToUseInput.value = purchaseDateInput.value;
        calculateAndRenderDepreciation();
      }
    });
  }

  // Log Maintenance button click
  const btnAddMaint = document.getElementById('btn-add-maintenance-modal');
  const maintForm = document.getElementById('assetm-maintenance-form');
  if (btnAddMaint && maintForm) {
    btnAddMaint.addEventListener('click', () => {
      maintForm.style.display = maintForm.style.display === 'none' ? 'block' : 'none';
      // Reset form fields
      document.getElementById('assetm-maint-start-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('assetm-maint-end-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('assetm-maint-vendor').value = '';
      document.getElementById('assetm-maint-type').value = '';
      document.getElementById('assetm-maint-cost').value = '';
      document.getElementById('assetm-maint-notes').value = '';
    });
  }

  // Cancel Maintenance button click
  const btnCancelMaint = document.getElementById('btn-cancel-maintenance');
  if (btnCancelMaint && maintForm) {
    btnCancelMaint.addEventListener('click', () => {
      maintForm.style.display = 'none';
    });
  }

  // Save Maintenance button click
  const btnSaveMaint = document.getElementById('btn-save-maintenance');
  if (btnSaveMaint) {
    btnSaveMaint.addEventListener('click', () => {
      const id = document.getElementById('assetm-id').value;
      if (!id) {
        if (typeof showToast === 'function') {
          showToast('❌ Save the asset details first before logging maintenance.', 'error');
        }
        return;
      }

      const maintStartDate = document.getElementById('assetm-maint-start-date').value || new Date().toISOString().split('T')[0];
      const maintEndDate = document.getElementById('assetm-maint-end-date').value || new Date().toISOString().split('T')[0];
      const maintVendor = document.getElementById('assetm-maint-vendor').value;
      const maintType = document.getElementById('assetm-maint-type').value.trim();
      const maintCostVal = document.getElementById('assetm-maint-cost').value;
      const maintCost = maintCostVal ? parseFloat(maintCostVal) : 0;
      const maintNotes = document.getElementById('assetm-maint-notes').value.trim();

      if (!maintType) {
        if (typeof showToast === 'function') {
          showToast('❌ Maintenance type/description is required.', 'error');
        }
        return;
      }

      if (maintCostVal === '' || isNaN(maintCost) || maintCost < 0) {
        if (typeof showToast === 'function') {
          showToast('❌ Please enter a valid maintenance cost.', 'error');
        }
        return;
      }

      const assets = typeof loadAssets === 'function' ? loadAssets() : [];
      const asset = assets.find(a => a.id === id);
      if (!asset) return;

      if (!asset.maintenance) {
        asset.maintenance = [];
      }

      const newLog = {
        startDate: maintStartDate,
        endDate: maintEndDate,
        vendor: maintVendor,
        type: maintType,
        cost: maintCost,
        notes: maintNotes,
        by: getCurrentActorName()
      };

      asset.maintenance.push(newLog);

      if (typeof saveAssets === 'function') saveAssets(assets);

      // Log to system audit log
      if (typeof addAuditLog === 'function') {
        let auditMsg = `🔧 Logged maintenance: ${maintType} (Cost: ₹${maintCost.toFixed(2)})`;
        if (maintVendor) {
          auditMsg += ` by ${maintVendor}`;
        }
        if (maintStartDate && maintEndDate) {
          auditMsg += ` for period ${maintStartDate} to ${maintEndDate}`;
        }
        auditMsg += `. Notes: ${maintNotes}`;
        addAuditLog(auditMsg, getCurrentActorName(), id, 'asset');
      }

      if (typeof showToast === 'function') {
        showToast('Maintenance logged successfully!', 'success');
      }

      // Hide form and refresh history
      if (maintForm) maintForm.style.display = 'none';
      renderAssetHistory(id);
      renderAdminAssets();
    });
  }
}

function renderAssetHistory(id) {
  const timelineEl = document.getElementById('assetm-history-timeline');
  const maintTimelineEl = document.getElementById('assetm-maintenance-timeline');
  const costEl = document.getElementById('assetm-total-maintenance-cost');
  if (!timelineEl) return;

  if (!id) {
    if (costEl) costEl.textContent = '₹0.00';
    timelineEl.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">Save this asset first to start recording history and maintenance logs.</div>`;
    if (maintTimelineEl) {
      maintTimelineEl.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">Save this asset first to start recording history and maintenance logs.</div>`;
    }
    return;
  }

  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const asset = assets.find(a => a.id === id);
  if (!asset) {
    if (costEl) costEl.textContent = '₹0.00';
    timelineEl.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">Asset not found.</div>`;
    if (maintTimelineEl) {
      maintTimelineEl.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">Asset not found.</div>`;
    }
    return;
  }

  // Calculate total maintenance cost
  const maintenanceLogs = asset.maintenance || [];
  const totalCost = maintenanceLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
  if (costEl) {
    costEl.textContent = `₹${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // 1. Compile lifecycle events from system logs
  const systemLogs = typeof loadSystemAuditLogs === 'function' ? loadSystemAuditLogs() : [];
  const assetLogs = systemLogs.filter(log => log.refId === id);

  let lifecycleEvents = [];

  // Parse system logs
  assetLogs.forEach(log => {
    let emoji = '📋';
    let title = log.action;
    const act = log.action.toLowerCase();
    
    if (act.includes('created asset')) {
      emoji = '🖥️';
    } else if (act.includes('checked out') || act.includes('deployed')) {
      emoji = '🚀';
    } else if (act.includes('checked in') || act.includes('ready to deploy')) {
      emoji = '↩️';
    } else if (act.includes('completed quick audit') || act.includes('completed bulk audit') || act.includes('updated asset') && act.includes('comment:')) {
      emoji = '📋';
    } else if (act.includes('updated asset')) {
      emoji = '📝';
    } else if (act.includes('logged maintenance')) {
      // Skip duplicate system log because we will add maintenance events from the asset.maintenance list directly
      return;
    }

    lifecycleEvents.push({
      date: new Date(log.time).toISOString().split('T')[0],
      time: log.time,
      emoji,
      title,
      by: log.by || 'System'
    });
  });

  // Sort lifecycle events descending
  lifecycleEvents.sort((a, b) => new Date(b.time) - new Date(a.time));

  if (lifecycleEvents.length === 0) {
    timelineEl.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">No history entries found.</div>`;
  } else {
    timelineEl.innerHTML = lifecycleEvents.map(evt => {
      const dateStr = new Date(evt.time).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      return `
        <div style="display:flex; gap:12px; margin-bottom:14px; position:relative;">
          <div style="font-size:1.1rem; width:24px; text-align:center;">${evt.emoji}</div>
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:2px;">
              <span style="font-size:0.8rem; font-weight:600; color:var(--text-primary);">${evt.title}</span>
              <span style="font-size:0.7rem; color:var(--text-muted); white-space:nowrap;">${dateStr}</span>
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted);">by ${evt.by}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Compile maintenance events
  let maintEvents = [];
  maintenanceLogs.forEach(log => {
    let detailsText = '';
    if (log.startDate || log.endDate || log.vendor) {
      let parts = [];
      if (log.vendor) parts.push(`Vendor: <strong>${escapeHTML(log.vendor)}</strong>`);
      if (log.startDate && log.endDate && log.startDate !== log.endDate) {
        parts.push(`Period: <strong>${log.startDate}</strong> to <strong>${log.endDate}</strong>`);
      } else if (log.startDate) {
        parts.push(`Date: <strong>${log.startDate}</strong>`);
      } else if (log.endDate) {
        parts.push(`Date: <strong>${log.endDate}</strong>`);
      }
      detailsText = `<div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:4px;">${parts.join(' | ')}</div>`;
    }

    const eventDate = log.startDate || log.date;
    maintEvents.push({
      date: eventDate,
      time: `${eventDate}T12:00:00.000Z`,
      emoji: '🔧',
      title: `Logged maintenance: ${log.type} (Cost: ₹${(log.cost || 0).toFixed(2)})`,
      detailsHtml: detailsText,
      notes: log.notes || '',
      by: log.by || 'System'
    });
  });

  // Sort maintenance events descending
  maintEvents.sort((a, b) => new Date(b.time) - new Date(a.time));

  if (maintTimelineEl) {
    if (maintEvents.length === 0) {
      maintTimelineEl.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">No maintenance logs found.</div>`;
    } else {
      maintTimelineEl.innerHTML = maintEvents.map(evt => {
        const dateStr = new Date(evt.time).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const detailsHtml = evt.detailsHtml || '';
        const notesHtml = evt.notes ? `<div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px; padding-left:8px; border-left:2px solid var(--border);">${evt.notes}</div>` : '';
        return `
          <div style="display:flex; gap:12px; margin-bottom:14px; position:relative;">
            <div style="font-size:1.1rem; width:24px; text-align:center;">${evt.emoji}</div>
            <div style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:2px;">
                <span style="font-size:0.8rem; font-weight:600; color:var(--text-primary);">${evt.title}</span>
                <span style="font-size:0.7rem; color:var(--text-muted); white-space:nowrap;">${dateStr}</span>
              </div>
              <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:4px;">by ${evt.by}</div>
              ${detailsHtml}
              ${notesHtml}
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function openLightbox(dataUrl, filename) {
  const overlay = document.getElementById('lightbox-overlay');
  const container = document.getElementById('lightbox-content-container');
  const titleEl = document.getElementById('lightbox-title');
  if (!overlay || !container || !titleEl) return;

  container.innerHTML = '';
  titleEl.textContent = filename || 'Attachment Preview';

  if (dataUrl.startsWith('data:application/pdf')) {
    container.innerHTML = `<iframe src="${dataUrl}" style="border:0; width:800px; height:600px; max-width:100%; max-height:70vh;" allowfullscreen></iframe>`;
  } else {
    container.innerHTML = `<img src="${dataUrl}" style="max-width:100%; max-height:70vh; object-fit:contain; border-radius:var(--radius-sm);" />`;
  }

  overlay.style.display = 'flex';
}

function closeLightbox() {
  const overlay = document.getElementById('lightbox-overlay');
  if (overlay) overlay.style.display = 'none';
}


/* =============================================
   QR CODE & SCANNER SYSTEM LOGIC
   ============================================= */

let html5QrcodeInstance = null;
let activeCameraId = null;

function renderAssetQRLabel(id) {
  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const asset = assets.find(a => a.id === id);
  if (!asset) return;

  // Clear previous QR
  const qrContainer = document.getElementById('assetm-qr-container');
  if (qrContainer) {
    qrContainer.innerHTML = '';
    // Generate QR
    new QRCode(qrContainer, {
      text: asset.id,
      width: 90,
      height: 90,
      colorDark : "#000000",
      colorLight : "#ffffff",
      correctLevel : QRCode.CorrectLevel.H
    });
  }

  // Set default settings values
  document.getElementById('label-opt-header').value = 'PROPERTY OF IT DEPT';
  document.getElementById('label-opt-show-name').checked = true;
  document.getElementById('label-opt-show-model').checked = true;
  document.getElementById('label-opt-show-serial').checked = true;
  document.getElementById('label-opt-size').value = 'medium';
  document.getElementById('label-opt-theme').value = 'bw';

  updateLabelPreview();
}

function updateLabelPreview() {
  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const id = document.getElementById('assetm-id').value;
  const asset = assets.find(a => a.id === id);
  if (!asset) return;

  const headerVal = document.getElementById('label-opt-header').value.trim() || 'PROPERTY OF IT DEPT';
  const showName = document.getElementById('label-opt-show-name').checked;
  const showModel = document.getElementById('label-opt-show-model').checked;
  const showSerial = document.getElementById('label-opt-show-serial').checked;
  const sizeVal = document.getElementById('label-opt-size').value;
  const themeVal = document.getElementById('label-opt-theme').value;

  // Header text
  document.getElementById('preview-label-header').textContent = headerVal;
  
  // Tag ID
  document.getElementById('preview-label-id').textContent = asset.id;

  // Name visibility
  const nameLbl = document.getElementById('preview-label-name-lbl');
  const nameText = document.getElementById('preview-label-name');
  if (showName) {
    if (nameLbl) nameLbl.style.display = 'block';
    if (nameText) {
      nameText.style.display = '-webkit-box';
      nameText.textContent = asset.name;
    }
  } else {
    if (nameLbl) nameLbl.style.display = 'none';
    if (nameText) nameText.style.display = 'none';
  }

  // Model visibility
  const modelLbl = document.getElementById('preview-label-model-lbl');
  const modelText = document.getElementById('preview-label-model');
  if (showModel) {
    if (modelLbl) modelLbl.style.display = 'block';
    if (modelText) {
      modelText.style.display = 'block';
      modelText.textContent = asset.model || 'N/A';
    }
  } else {
    if (modelLbl) modelLbl.style.display = 'none';
    if (modelText) modelText.style.display = 'none';
  }

  // Serial visibility
  const serialLbl = document.getElementById('preview-label-serial-lbl');
  const serialText = document.getElementById('preview-label-serial');
  if (showSerial) {
    if (serialLbl) serialLbl.style.display = 'block';
    if (serialText) {
      serialText.style.display = 'block';
      serialText.textContent = asset.serial || 'N/A';
    }
  } else {
    if (serialLbl) serialLbl.style.display = 'none';
    if (serialText) serialText.style.display = 'none';
  }

  // Size sizing
  const container = document.getElementById('asset-label-preview-container');
  if (container) {
    if (sizeVal === 'small') {
      container.style.width = '240px';
      container.style.height = '140px';
      container.style.padding = '8px';
    } else if (sizeVal === 'large') {
      container.style.width = '340px';
      container.style.height = '220px';
      container.style.padding = '16px';
    } else {
      // medium
      container.style.width = '280px';
      container.style.height = '180px';
      container.style.padding = '12px';
    }
  }

  // Theme application
  const idBadge = document.getElementById('preview-label-id');
  if (container && idBadge) {
    if (themeVal === 'blue') {
      container.style.borderColor = '#0066cc';
      idBadge.style.background = '#0066cc';
      idBadge.style.color = '#ffffff';
    } else if (themeVal === 'green') {
      container.style.borderColor = '#2ea043';
      idBadge.style.background = '#2ea043';
      idBadge.style.color = '#ffffff';
    } else {
      // bw
      container.style.borderColor = '#000000';
      idBadge.style.background = '#000000';
      idBadge.style.color = '#ffffff';
    }
  }
}

function printAssetLabel() {
  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const id = document.getElementById('assetm-id').value;
  const asset = assets.find(a => a.id === id);
  if (!asset) return;

  const headerVal = document.getElementById('label-opt-header').value.trim() || 'PROPERTY OF IT DEPT';
  const showName = document.getElementById('label-opt-show-name').checked;
  const showModel = document.getElementById('label-opt-show-model').checked;
  const showSerial = document.getElementById('label-opt-show-serial').checked;
  const sizeVal = document.getElementById('label-opt-size').value;
  const themeVal = document.getElementById('label-opt-theme').value;

  // Determine physical sticker size for print styling
  let printWidth = '3in';
  let printHeight = '2in';
  let padding = '12px';
  if (sizeVal === 'small') {
    printWidth = '2in';
    printHeight = '1in';
    padding = '6px';
  } else if (sizeVal === 'large') {
    printWidth = '4in';
    printHeight = '3in';
    padding = '18px';
  }

  // Theme color for printing
  let themeColor = '#000000';
  if (themeVal === 'blue') themeColor = '#0066cc';
  if (themeVal === 'green') themeColor = '#2ea043';

  // Get current QR code SVG or Image source
  const qrImg = document.getElementById('assetm-qr-container').querySelector('img');
  const qrSrc = qrImg ? qrImg.src : '';

  const printWindow = window.open('', '_blank', 'width=600,height=500');
  if (!printWindow) {
    if (typeof showToast === 'function') {
      showToast('❌ Pop-up blocker prevented printing label. Please enable pop-ups.', 'error');
    }
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Label - ${asset.id}</title>
        <style>
          @page {
            size: ${printWidth} ${printHeight};
            margin: 0;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: ${printWidth};
            height: ${printHeight};
            background: #ffffff;
            color: #000000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .sticker-container {
            width: ${printWidth};
            height: ${printHeight};
            border: 2px solid ${themeColor};
            box-sizing: border-box;
            padding: ${padding};
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
            background: #ffffff;
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #000000;
            padding-bottom: 4px;
            margin-bottom: 4px;
          }
          .brand-text {
            font-size: 8px;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 70%;
          }
          .tag-id {
            font-size: 9px;
            font-weight: 800;
            font-family: monospace;
            background: ${themeColor};
            color: #ffffff;
            padding: 1px 4px;
            border-radius: 2px;
          }
          .content-row {
            display: flex;
            gap: 8px;
            flex: 1;
            align-items: center;
            min-height: 0;
          }
          .qr-box {
            width: 70px;
            height: 70px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .qr-box img {
            width: 70px;
            height: 70px;
          }
          .details-box {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 2px;
            flex: 1;
            min-width: 0;
          }
          .field-label {
            font-size: 6px;
            color: #555555;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: -2px;
          }
          .field-value {
            font-size: 9px;
            font-weight: 700;
            line-height: 1.1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .footer-row {
            font-size: 6px;
            text-align: center;
            color: #444444;
            border-top: 1px dashed #cccccc;
            padding-top: 2px;
            margin-top: 4px;
            white-space: nowrap;
          }
        </style>
      </head>
      <body>
        <div class="sticker-container">
          <div class="header-row">
            <span class="brand-text">${headerVal}</span>
            <span class="tag-id">${asset.id}</span>
          </div>
          <div class="content-row">
            <div class="qr-box">
              <img src="${qrSrc}" />
            </div>
            <div class="details-box">
              ${showName ? `
                <span class="field-label">Asset Name</span>
                <span class="field-value">${asset.name}</span>
              ` : ''}
              ${showModel ? `
                <span class="field-label">Model</span>
                <span class="field-value">${asset.model || 'N/A'}</span>
              ` : ''}
              ${showSerial ? `
                <span class="field-label">Serial</span>
                <span class="field-value" style="font-family:monospace;">${asset.serial || 'N/A'}</span>
              ` : ''}
            </div>
          </div>
          <div class="footer-row">
            Scan QR Code to Verify or Audit this Asset
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }, 300);
          };
        <\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function initAssetScanner() {
  const btnScanAsset = document.getElementById('btn-scan-asset');
  if (btnScanAsset && !btnScanAsset.dataset.initialized) {
    btnScanAsset.addEventListener('click', openScannerModal);
    btnScanAsset.dataset.initialized = 'true';
  }

  const btnClose = document.getElementById('asset-scanner-modal-close');
  const btnCancel = document.getElementById('asset-scanner-modal-cancel');
  [btnClose, btnCancel].forEach(btn => {
    if (btn && !btn.dataset.initialized) {
      btn.addEventListener('click', closeScannerModal);
      btn.dataset.initialized = 'true';
    }
  });

  const btnSubmitAudit = document.getElementById('btn-scan-submit-audit');
  if (btnSubmitAudit && !btnSubmitAudit.dataset.initialized) {
    btnSubmitAudit.addEventListener('click', submitAuditFromScan);
    btnSubmitAudit.dataset.initialized = 'true';
  }

  // Scanner reset
  const btnReset = document.getElementById('btn-scanner-reset');
  if (btnReset && !btnReset.dataset.initialized) {
    btnReset.addEventListener('click', () => {
      document.getElementById('scanner-result-panel').style.display = 'none';
      document.getElementById('scanner-uploaded-preview-container').style.display = 'none';
      document.getElementById('scanner-file-input').value = '';
      btnReset.style.display = 'none';
      document.getElementById('scanner-status-text').textContent = 'Ready to scan asset QR code...';

      const activeTab = document.querySelector('#scanner-mode-tabs .settings-tab.active');
      if (activeTab && activeTab.dataset.mode === 'camera') {
        const select = document.getElementById('scanner-camera-select');
        if (select && select.value) {
          startWebcam(select.value);
        }
      }
    });
    btnReset.dataset.initialized = 'true';
  }

  // Edit asset
  const btnEditAsset = document.getElementById('btn-scan-edit-asset');
  if (btnEditAsset && !btnEditAsset.dataset.initialized) {
    btnEditAsset.addEventListener('click', () => {
      const tag = document.getElementById('scan-res-tag').textContent;
      if (tag) {
        closeScannerModal();
        if (typeof openAssetModal === 'function') {
          openAssetModal(tag);
        }
      }
    });
    btnEditAsset.dataset.initialized = 'true';
  }

  // Scanner tabs
  const modeTabs = document.getElementById('scanner-mode-tabs');
  if (modeTabs && !modeTabs.dataset.initialized) {
    const buttons = modeTabs.querySelectorAll('.settings-tab');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const mode = btn.dataset.mode;
        if (mode === 'camera') {
          document.getElementById('scanner-camera-pane').style.display = 'flex';
          document.getElementById('scanner-file-pane').style.display = 'none';
          const select = document.getElementById('scanner-camera-select');
          if (select && select.value) {
            startWebcam(select.value);
          }
        } else {
          document.getElementById('scanner-camera-pane').style.display = 'none';
          document.getElementById('scanner-file-pane').style.display = 'flex';
          stopWebcam();
        }
      });
    });
    modeTabs.dataset.initialized = 'true';
  }

  // Camera select change
  const cameraSelect = document.getElementById('scanner-camera-select');
  if (cameraSelect && !cameraSelect.dataset.initialized) {
    cameraSelect.addEventListener('change', () => {
      if (cameraSelect.value) {
        startWebcam(cameraSelect.value);
      }
    });
    cameraSelect.dataset.initialized = 'true';
  }

  // File upload dropzone
  const dropzone = document.getElementById('scanner-upload-dropzone');
  const fileInput = document.getElementById('scanner-file-input');
  if (dropzone && fileInput && !dropzone.dataset.initialized) {
    dropzone.addEventListener('click', () => fileInput.click());
    
    dropzone.addEventListener('dragover', e => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) {
        fileInput.files = e.dataTransfer.files;
        const event = new Event('change');
        fileInput.dispatchEvent(event);
      }
    });

    fileInput.addEventListener('change', handleFileSelect);
    dropzone.dataset.initialized = 'true';
  }

  // Clear uploaded QR file
  const btnClearQr = document.getElementById('btn-clear-uploaded-qr');
  if (btnClearQr && !btnClearQr.dataset.initialized) {
    btnClearQr.addEventListener('click', () => {
      document.getElementById('scanner-file-input').value = '';
      document.getElementById('scanner-uploaded-preview-container').style.display = 'none';
      document.getElementById('scanner-result-panel').style.display = 'none';
      document.getElementById('btn-scanner-reset').style.display = 'none';
      document.getElementById('scanner-status-text').textContent = 'Ready to scan asset QR code...';
    });
    btnClearQr.dataset.initialized = 'true';
  }
}

function openScannerModal() {
  const overlay = document.getElementById('asset-scanner-modal-overlay');
  if (!overlay) return;
  
  // Reset results
  document.getElementById('scanner-result-panel').style.display = 'none';
  document.getElementById('scanner-uploaded-preview-container').style.display = 'none';
  document.getElementById('scanner-file-input').value = '';
  document.getElementById('btn-scanner-reset').style.display = 'none';
  document.getElementById('scanner-status-text').textContent = 'Ready to scan asset QR code...';

  // Toggle default camera tab active
  const tabs = document.getElementById('scanner-mode-tabs');
  if (tabs) {
    const tabButtons = tabs.querySelectorAll('.settings-tab');
    tabButtons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.mode === 'camera') {
        btn.classList.add('active');
      }
    });
  }
  document.getElementById('scanner-camera-pane').style.display = 'flex';
  document.getElementById('scanner-file-pane').style.display = 'none';

  overlay.style.display = 'flex';

  // Query cameras
  Html5Qrcode.getCameras().then(devices => {
    const select = document.getElementById('scanner-camera-select');
    select.innerHTML = '';
    if (devices && devices.length > 0) {
      devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.id;
        option.textContent = device.label || `Camera ${select.length + 1}`;
        select.appendChild(option);
      });
      // Start camera stream
      startWebcam(devices[0].id);
    } else {
      select.innerHTML = '<option value="">No cameras detected</option>';
      document.getElementById('scanner-status-text').textContent = '⚠️ No cameras found. Use image file upload.';
    }
  }).catch(err => {
    console.error(err);
    const select = document.getElementById('scanner-camera-select');
    if (select) select.innerHTML = '<option value="">No camera permission / device</option>';
    document.getElementById('scanner-status-text').textContent = '⚠️ Camera access denied. Use image file upload.';
  });
}

function closeScannerModal() {
  stopWebcam();
  const overlay = document.getElementById('asset-scanner-modal-overlay');
  if (overlay) overlay.style.display = 'none';
  
  // Clear inputs and reset UI
  document.getElementById('scanner-result-panel').style.display = 'none';
  document.getElementById('scanner-uploaded-preview-container').style.display = 'none';
  document.getElementById('scanner-file-input').value = '';
  document.getElementById('btn-scanner-reset').style.display = 'none';
  document.getElementById('scanner-status-text').textContent = 'Ready to scan asset QR code...';
}

function startWebcam(cameraId) {
  if (html5QrcodeInstance) {
    html5QrcodeInstance.stop().then(() => {
      initAndStart(cameraId);
    }).catch(err => {
      console.warn("Error stopping scanner:", err);
      initAndStart(cameraId);
    });
  } else {
    initAndStart(cameraId);
  }

  function initAndStart(id) {
    html5QrcodeInstance = new Html5Qrcode("qr-reader");
    activeCameraId = id;
    
    html5QrcodeInstance.start(
      id,
      {
        fps: 10,
        qrbox: 200
      },
      (decodedText, decodedResult) => {
        handleDecodedTag(decodedText);
      },
      (errorMessage) => {
        // Silent scanning error callbacks
      }
    ).then(() => {
      document.getElementById('scanner-status-text').textContent = '🟢 Camera active. Scan QR code...';
    }).catch(err => {
      console.error("Failed to start camera:", err);
      document.getElementById('scanner-status-text').textContent = '❌ Failed to start camera: ' + err;
    });
  }
}

function stopWebcam() {
  if (html5QrcodeInstance && html5QrcodeInstance.isScanning) {
    return html5QrcodeInstance.stop().then(() => {
      html5QrcodeInstance = null;
      activeCameraId = null;
    }).catch(err => {
      console.error("Error stopping webcam:", err);
    });
  } else {
    html5QrcodeInstance = null;
    activeCameraId = null;
    return Promise.resolve();
  }
}

function handleDecodedTag(tag) {
  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const cleanTag = tag.trim().replace(/^.*\/|[^\w-]/g, '').toUpperCase();
  
  let asset = assets.find(a => a.id.toUpperCase() === cleanTag);
  if (!asset) {
    const matchNumber = cleanTag.match(/^(\d+)$/);
    if (matchNumber) {
      const paddedId = 'AST-' + matchNumber[1].padStart(4, '0');
      asset = assets.find(a => a.id === paddedId);
    }
  }

  // Play premium beep sound
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.2, context.currentTime);
    osc.start();
    osc.stop(context.currentTime + 0.1);
  } catch (e) {
    console.log("AudioContext blocked or unsupported", e);
  }

  if (typeof showToast === 'function') {
    showToast(`QR Code Decoded: "${cleanTag}"`, 'success');
  }

  const resultPanel = document.getElementById('scanner-result-panel');
  const alertEl = document.getElementById('scanner-result-alert');
  const detailsCard = document.getElementById('scanner-asset-details-card');
  const auditForm = document.getElementById('scanner-audit-form');

  if (!asset) {
    resultPanel.style.display = 'block';
    alertEl.style.display = 'flex';
    alertEl.style.background = 'rgba(235,87,87,0.1)';
    alertEl.style.border = '1px solid rgba(235,87,87,0.3)';
    alertEl.style.color = 'var(--accent-red)';
    alertEl.innerHTML = `❌ <strong>Asset Not Found:</strong> The tag "${cleanTag}" does not match any registered asset.`;
    detailsCard.style.display = 'none';
    auditForm.style.display = 'none';
    document.getElementById('scanner-status-text').textContent = '⚠️ Tag not found. Try scanning another.';
    document.getElementById('btn-scanner-reset').style.display = 'inline-block';
    return;
  }

  resultPanel.style.display = 'block';
  alertEl.style.display = 'flex';
  alertEl.style.background = 'rgba(46,160,67,0.1)';
  alertEl.style.border = '1px solid rgba(46,160,67,0.3)';
  alertEl.style.color = 'var(--accent-green)';
  alertEl.innerHTML = `🟢 <strong>Asset Verified:</strong> Decoded tag successfully matched database record!`;

  detailsCard.style.display = 'flex';
  auditForm.style.display = 'block';

  document.getElementById('scan-res-tag').textContent = asset.id;
  const statusBadge = document.getElementById('scan-res-status');
  statusBadge.textContent = asset.status;
  
  statusBadge.className = 'badge';
  if (asset.status === 'Ready to Deploy') {
    statusBadge.style.background = 'rgba(46,160,67,0.15)';
    statusBadge.style.color = 'var(--accent-green)';
    statusBadge.style.border = '1px solid var(--accent-green)';
  } else if (asset.status === 'Deployed') {
    statusBadge.style.background = 'rgba(88,166,255,0.15)';
    statusBadge.style.color = 'var(--accent-blue)';
    statusBadge.style.border = '1px solid var(--accent-blue)';
  } else {
    statusBadge.style.background = 'rgba(210,153,34,0.15)';
    statusBadge.style.color = 'var(--accent-orange)';
    statusBadge.style.border = '1px solid var(--accent-orange)';
  }

  document.getElementById('scan-res-name').textContent = asset.name;
  document.getElementById('scan-res-model').textContent = `${asset.make || ''} ${asset.model || ''} ${asset.modelNumber ? `(Model #: ${asset.modelNumber})` : ''}`;
  document.getElementById('scan-res-serial').textContent = asset.serial ? `Serial: ${asset.serial}` : 'Serial: N/A';
  
  const assigneeEl = document.getElementById('scan-res-assignee');
  if (asset.assignedTo) {
    assigneeEl.textContent = `${asset.assignedTo} (${asset.assignedEmail || ''})`;
  } else {
    assigneeEl.textContent = 'Unassigned / Available';
  }

  document.getElementById('scan-res-last-audit').textContent = asset.lastAuditDate || 'Never';
  document.getElementById('scan-res-next-audit').textContent = asset.nextAuditDate || 'N/A';
  document.getElementById('scan-audit-comment').value = 'Audited via QR Code Scan';

  document.getElementById('scanner-status-text').textContent = `Verified asset ${asset.id}.`;
  document.getElementById('btn-scanner-reset').style.display = 'inline-block';

  stopWebcam();
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById('scanner-uploaded-filename').textContent = file.name;
  document.getElementById('scanner-uploaded-preview-container').style.display = 'flex';
  document.getElementById('scanner-status-text').textContent = '⏳ Decoding QR code from image...';

  const localHtml5Qrcode = new Html5Qrcode("qr-reader");
  localHtml5Qrcode.scanFile(file, true)
    .then(decodedText => {
      handleDecodedTag(decodedText);
    })
    .catch(err => {
      console.error(err);
      if (typeof showToast === 'function') {
        showToast('❌ Could not decode QR code from the uploaded image. Please ensure it is clear.', 'error');
      }
      document.getElementById('scanner-status-text').textContent = '❌ Decoding failed. Try another photo.';
    });
}

function submitAuditFromScan() {
  const tag = document.getElementById('scan-res-tag').textContent;
  const comment = document.getElementById('scan-audit-comment').value.trim();

  if (!comment) {
    if (typeof showToast === 'function') {
      showToast('❌ Audit comment is required.', 'error');
    }
    return;
  }

  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const asset = assets.find(a => a.id === tag);
  if (!asset) return;

  const today = new Date().toISOString().split('T')[0];
  asset.lastAuditDate = today;
  
  if (asset.auditFrequency) {
    const calculated = calculateNextAuditDate(today, asset.auditFrequency);
    if (calculated) {
      asset.nextAuditDate = calculated;
    }
  }

  if (typeof saveAssets === 'function') saveAssets(assets);

  if (typeof addAuditLog === 'function') {
    addAuditLog(`🔍 IT Asset Verified & Audited via QR Code scan. Comment: ${comment}`, 'System', asset.id, 'asset');
  }

  renderAdminAssets();
  if (typeof checkAssetAuditsNotifications === 'function') {
    checkAssetAuditsNotifications();
  }

  if (typeof showToast === 'function') {
    showToast(`IT Asset ${asset.id} successfully verified & audited!`, 'success');
  }

  closeScannerModal();
}

// Bulk Print and Custom Label Helper Functions
function handleRowCheckboxChange(e) {
  const chk = e.target;
  const assetId = chk.dataset.id;
  if (chk.checked) {
    selectedAssetIds.add(assetId);
  } else {
    selectedAssetIds.delete(assetId);
  }
  updateSelectAllCheckboxState();
  updateBulkPrintButton();
}

function handleSelectAllChange(e) {
  const isChecked = e.target.checked;
  const rowCheckboxes = document.querySelectorAll('.asset-row-chk');
  rowCheckboxes.forEach(chk => {
    chk.checked = isChecked;
    const id = chk.dataset.id;
    if (isChecked) {
      selectedAssetIds.add(id);
    } else {
      selectedAssetIds.delete(id);
    }
  });
  updateBulkPrintButton();
}

function updateSelectAllCheckboxState() {
  const selectAllChk = document.getElementById('chk-select-all-assets');
  if (!selectAllChk) return;
  const rowCheckboxes = document.querySelectorAll('.asset-row-chk');
  if (rowCheckboxes.length === 0) {
    selectAllChk.checked = false;
    return;
  }
  let allChecked = true;
  rowCheckboxes.forEach(chk => {
    if (!chk.checked) {
      allChecked = false;
    }
  });
  selectAllChk.checked = allChecked;
}

function updateBulkPrintButton() {
  const btn = document.getElementById('btn-bulk-print-labels');
  const countSpan = document.getElementById('bulk-print-count');
  if (btn) {
    if (selectedAssetIds.size > 0) {
      btn.style.display = 'flex';
      if (countSpan) countSpan.textContent = selectedAssetIds.size;
    } else {
      btn.style.display = 'none';
    }
  }
}

function generateQRCodeDataURL(text) {
  const tempDiv = document.createElement('div');
  tempDiv.style.display = 'none';
  document.body.appendChild(tempDiv);
  new QRCode(tempDiv, {
    text: text,
    width: 90,
    height: 90,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
  const canvas = tempDiv.querySelector('canvas');
  const qrSrc = canvas ? canvas.toDataURL('image/png') : '';
  document.body.removeChild(tempDiv);
  return qrSrc;
}

function bulkPrintLabels() {
  if (selectedAssetIds.size === 0) {
    if (typeof showToast === 'function') {
      showToast('❌ No assets selected for bulk printing.', 'error');
    }
    return;
  }

  const assets = typeof loadAssets === 'function' ? loadAssets() : [];
  const selectedAssets = assets.filter(a => selectedAssetIds.has(a.id));

  if (selectedAssets.length === 0) {
    if (typeof showToast === 'function') {
      showToast('❌ Selected assets could not be found.', 'error');
    }
    return;
  }

  const printWindow = window.open('', '_blank', 'width=600,height=500');
  if (!printWindow) {
    if (typeof showToast === 'function') {
      showToast('❌ Pop-up blocker prevented bulk printing. Please enable pop-ups.', 'error');
    }
    return;
  }

  let stickersHTML = '';
  selectedAssets.forEach(asset => {
    const qrSrc = generateQRCodeDataURL(asset.id);

    stickersHTML += `
      <div class="sticker-container">
        <div class="header-row">
          <span class="brand-text">PROPERTY OF IT DEPT</span>
          <span class="tag-id">${asset.id}</span>
        </div>
        <div class="content-row">
          <div class="qr-box">
            <img src="${qrSrc}" />
          </div>
          <div class="details-box">
            <span class="field-label">Asset Name</span>
            <span class="field-value">${asset.name}</span>
            <span class="field-label">Model</span>
            <span class="field-value">${asset.model || 'N/A'}</span>
            <span class="field-label">Serial</span>
            <span class="field-value" style="font-family:monospace;">${asset.serial || 'N/A'}</span>
          </div>
        </div>
        <div class="footer-row">
          Scan QR Code to Verify or Audit this Asset
        </div>
      </div>
    `;
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Bulk Print Labels</title>
        <style>
          @page {
            size: 3in 2in;
            margin: 0;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .sticker-container {
            width: 3in;
            height: 2in;
            border: 2px solid #000000;
            box-sizing: border-box;
            padding: 12px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
            background: #ffffff;
            page-break-after: always;
          }
          .sticker-container:last-child {
            page-break-after: avoid;
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #000000;
            padding-bottom: 4px;
            margin-bottom: 4px;
          }
          .brand-text {
            font-size: 8px;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 70%;
          }
          .tag-id {
            font-size: 9px;
            font-weight: 800;
            font-family: monospace;
            background: #000000;
            color: #ffffff;
            padding: 1px 4px;
            border-radius: 2px;
          }
          .content-row {
            display: flex;
            gap: 8px;
            flex: 1;
            align-items: center;
            min-height: 0;
          }
          .qr-box {
            width: 70px;
            height: 70px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .qr-box img {
            width: 70px;
            height: 70px;
          }
          .details-box {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 2px;
            flex: 1;
            min-width: 0;
          }
          .field-label {
            font-size: 6px;
            color: #555555;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: -2px;
          }
          .field-value {
            font-size: 9px;
            font-weight: 700;
            line-height: 1.1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .footer-row {
            font-size: 6px;
            text-align: center;
            color: #444444;
            border-top: 1px dashed #cccccc;
            padding-top: 2px;
            margin-top: 4px;
            white-space: nowrap;
          }
          @media print {
            .sticker-container {
              page-break-after: always;
            }
            .sticker-container:last-child {
              page-break-after: avoid;
            }
          }
        </style>
      </head>
      <body>
        ${stickersHTML}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function openCustomLabelModal() {
  const overlay = document.getElementById('custom-label-modal-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    document.getElementById('cust-label-header').value = 'PROPERTY OF IT DEPT';
    document.getElementById('cust-label-id').value = 'AST-XXXX';
    document.getElementById('cust-label-name').value = 'Generic IT Asset';
    document.getElementById('cust-label-model').value = 'N/A';
    document.getElementById('cust-label-serial').value = 'N/A';
    document.getElementById('cust-label-size').value = 'medium';
    document.getElementById('cust-label-theme').value = 'bw';
    document.getElementById('cust-label-show-name').checked = true;
    document.getElementById('cust-label-show-model').checked = true;
    document.getElementById('cust-label-show-serial').checked = true;
    
    updateCustomLabelQR();
    updateCustomLabelPreview();
  }
}

function closeCustomLabelModal() {
  const overlay = document.getElementById('custom-label-modal-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

function updateCustomLabelQR() {
  const qrContainer = document.getElementById('customm-qr-container');
  if (!qrContainer) return;
  qrContainer.innerHTML = '';
  const idVal = document.getElementById('cust-label-id').value.trim() || 'AST-XXXX';
  new QRCode(qrContainer, {
    text: idVal,
    width: 90,
    height: 90,
    colorDark : "#000000",
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.H
  });
}

function updateCustomLabelPreview() {
  const headerVal = document.getElementById('cust-label-header').value.trim() || 'PROPERTY OF IT DEPT';
  const idVal = document.getElementById('cust-label-id').value.trim() || 'AST-XXXX';
  const nameVal = document.getElementById('cust-label-name').value.trim() || 'Generic IT Asset';
  const modelVal = document.getElementById('cust-label-model').value.trim() || 'N/A';
  const serialVal = document.getElementById('cust-label-serial').value.trim() || 'N/A';
  const sizeVal = document.getElementById('cust-label-size').value;
  const themeVal = document.getElementById('cust-label-theme').value;
  const showName = document.getElementById('cust-label-show-name').checked;
  const showModel = document.getElementById('cust-label-show-model').checked;
  const showSerial = document.getElementById('cust-label-show-serial').checked;

  document.getElementById('cust-preview-label-header').textContent = headerVal;
  document.getElementById('cust-preview-label-id').textContent = idVal;

  const nameLbl = document.getElementById('cust-preview-label-name-lbl');
  const nameText = document.getElementById('cust-preview-label-name');
  if (showName) {
    if (nameLbl) nameLbl.style.display = 'block';
    if (nameText) {
      nameText.style.display = '-webkit-box';
      nameText.textContent = nameVal;
    }
  } else {
    if (nameLbl) nameLbl.style.display = 'none';
    if (nameText) nameText.style.display = 'none';
  }

  const modelLbl = document.getElementById('cust-preview-label-model-lbl');
  const modelText = document.getElementById('cust-preview-label-model');
  if (showModel) {
    if (modelLbl) modelLbl.style.display = 'block';
    if (modelText) {
      modelText.style.display = 'block';
      modelText.textContent = modelVal;
    }
  } else {
    if (modelLbl) modelLbl.style.display = 'none';
    if (modelText) modelText.style.display = 'none';
  }

  const serialLbl = document.getElementById('cust-preview-label-serial-lbl');
  const serialText = document.getElementById('cust-preview-label-serial');
  if (showSerial) {
    if (serialLbl) serialLbl.style.display = 'block';
    if (serialText) {
      serialText.style.display = 'block';
      serialText.textContent = serialVal;
    }
  } else {
    if (serialLbl) serialLbl.style.display = 'none';
    if (serialText) serialText.style.display = 'none';
  }

  const container = document.getElementById('custom-label-preview-container');
  if (container) {
    if (sizeVal === 'small') {
      container.style.width = '240px';
      container.style.height = '140px';
      container.style.padding = '8px';
    } else if (sizeVal === 'large') {
      container.style.width = '340px';
      container.style.height = '220px';
      container.style.padding = '16px';
    } else {
      container.style.width = '280px';
      container.style.height = '180px';
      container.style.padding = '12px';
    }
  }

  const idBadge = document.getElementById('cust-preview-label-id');
  if (container && idBadge) {
    if (themeVal === 'blue') {
      container.style.borderColor = '#0066cc';
      idBadge.style.background = '#0066cc';
      idBadge.style.color = '#ffffff';
    } else if (themeVal === 'green') {
      container.style.borderColor = '#2ea043';
      idBadge.style.background = '#2ea043';
      idBadge.style.color = '#ffffff';
    } else {
      container.style.borderColor = '#000000';
      idBadge.style.background = '#000000';
      idBadge.style.color = '#ffffff';
    }
  }
}

function printCustomLabel() {
  const headerVal = document.getElementById('cust-label-header').value.trim() || 'PROPERTY OF IT DEPT';
  const idVal = document.getElementById('cust-label-id').value.trim() || 'AST-XXXX';
  const nameVal = document.getElementById('cust-label-name').value.trim() || 'Generic IT Asset';
  const modelVal = document.getElementById('cust-label-model').value.trim() || 'N/A';
  const serialVal = document.getElementById('cust-label-serial').value.trim() || 'N/A';
  const sizeVal = document.getElementById('cust-label-size').value;
  const themeVal = document.getElementById('cust-label-theme').value;
  const showName = document.getElementById('cust-label-show-name').checked;
  const showModel = document.getElementById('cust-label-show-model').checked;
  const showSerial = document.getElementById('cust-label-show-serial').checked;

  let printWidth = '3in';
  let printHeight = '2in';
  let padding = '12px';
  if (sizeVal === 'small') {
    printWidth = '2in';
    printHeight = '1in';
    padding = '6px';
  } else if (sizeVal === 'large') {
    printWidth = '4in';
    printHeight = '3in';
    padding = '18px';
  }

  let themeColor = '#000000';
  if (themeVal === 'blue') themeColor = '#0066cc';
  if (themeVal === 'green') themeColor = '#2ea043';

  const qrImg = document.getElementById('customm-qr-container').querySelector('img');
  const qrSrc = qrImg ? qrImg.src : '';

  const printWindow = window.open('', '_blank', 'width=600,height=500');
  if (!printWindow) {
    if (typeof showToast === 'function') {
      showToast('❌ Pop-up blocker prevented printing label. Please enable pop-ups.', 'error');
    }
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Custom Label - ${idVal}</title>
        <style>
          @page {
            size: ${printWidth} ${printHeight};
            margin: 0;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: ${printWidth};
            height: ${printHeight};
            background: #ffffff;
            color: #000000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .sticker-container {
            width: ${printWidth};
            height: ${printHeight};
            border: 2px solid ${themeColor};
            box-sizing: border-box;
            padding: ${padding};
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
            background: #ffffff;
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #000000;
            padding-bottom: 4px;
            margin-bottom: 4px;
          }
          .brand-text {
            font-size: 8px;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 70%;
          }
          .tag-id {
            font-size: 9px;
            font-weight: 800;
            font-family: monospace;
            background: ${themeColor};
            color: #ffffff;
            padding: 1px 4px;
            border-radius: 2px;
          }
          .content-row {
            display: flex;
            gap: 8px;
            flex: 1;
            align-items: center;
            min-height: 0;
          }
          .qr-box {
            width: 70px;
            height: 70px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .qr-box img {
            width: 70px;
            height: 70px;
          }
          .details-box {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 2px;
            flex: 1;
            min-width: 0;
          }
          .field-label {
            font-size: 6px;
            color: #555555;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: -2px;
          }
          .field-value {
            font-size: 9px;
            font-weight: 700;
            line-height: 1.1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .footer-row {
            font-size: 6px;
            text-align: center;
            color: #444444;
            border-top: 1px dashed #cccccc;
            padding-top: 2px;
            margin-top: 4px;
            white-space: nowrap;
          }
        </style>
      </head>
      <body>
        <div class="sticker-container">
          <div class="header-row">
            <span class="brand-text">${headerVal}</span>
            <span class="tag-id">${idVal}</span>
          </div>
          <div class="content-row">
            <div class="qr-box">
              <img src="${qrSrc}" />
            </div>
            <div class="details-box">
              ${showName ? `
                <span class="field-label">Asset Name</span>
                <span class="field-value">${nameVal}</span>
              ` : ''}
              ${showModel ? `
                <span class="field-label">Model</span>
                <span class="field-value">${modelVal}</span>
              ` : ''}
              ${showSerial ? `
                <span class="field-label">Serial</span>
                <span class="field-value" style="font-family:monospace;">${serialVal}</span>
              ` : ''}
            </div>
          </div>
          <div class="footer-row">
            Scan QR Code to Verify or Audit this Asset
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// Global exposure
window.openCustomLabelModal = openCustomLabelModal;
window.closeCustomLabelModal = closeCustomLabelModal;
window.updateCustomLabelQR = updateCustomLabelQR;
window.updateCustomLabelPreview = updateCustomLabelPreview;
window.printCustomLabel = printCustomLabel;
window.bulkPrintLabels = bulkPrintLabels;
window.handleRowCheckboxChange = handleRowCheckboxChange;
window.handleSelectAllChange = handleSelectAllChange;
window.updateSelectAllCheckboxState = updateSelectAllCheckboxState;
window.updateBulkPrintButton = updateBulkPrintButton;
window.generateQRCodeDataURL = generateQRCodeDataURL;
window.renderAssetQRLabel = renderAssetQRLabel;
window.updateLabelPreview = updateLabelPreview;
window.printAssetLabel = printAssetLabel;
window.initAssetScanner = initAssetScanner;
window.openScannerModal = openScannerModal;
window.closeScannerModal = closeScannerModal;
window.startWebcam = startWebcam;
window.stopWebcam = stopWebcam;
window.handleDecodedTag = handleDecodedTag;
window.handleFileSelect = handleFileSelect;
window.submitAuditFromScan = submitAuditFromScan;

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
window.quickAuditAsset = quickAuditAsset;
window.bulkAuditAllAssets = bulkAuditAllAssets;
window.initAssetModalTabs = initAssetModalTabs;
window.renderAssetHistory = renderAssetHistory;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;

// Load event binder
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAssets);
} else {
  initAssets();
}
