const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname)));

const delay = ms => new Promise(res => setTimeout(res, ms));

const server = app.listen(3000, async () => {
    console.log('Server running on port 3000');
    let hasError = false;
    let browser;
    let page;
    try {
        browser = await puppeteer.launch();
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        page.on('console', msg => {
            const text = msg.text();
            if (msg.type() === 'error') {
                console.error('PAGE CONSOLE ERROR:', text);
                if (!text.includes('favicon.ico') && !text.includes('Failed to load resource')) {
                    hasError = true;
                }
            } else {
                console.log('PAGE LOG:', text);
            }
        });
        page.on('pageerror', err => {
            console.error('PAGE ERROR EXCEPTION:', err.toString());
            hasError = true;
        });

        // =============================================
        // PART 1: User Portal "My Assets" & Ticket pre-fill
        // =============================================
        console.log('\n--- PART 1: User Portal My Assets E2E tests ---');
        await page.goto('http://localhost:3000/portal.html');
        await delay(1000);

        // Reset localStorage for clean state
        await page.evaluate(() => {
            localStorage.removeItem('hd_assets_v1');
            localStorage.removeItem('hd_snipe_it_settings_v1');
            sessionStorage.clear();
        });
        await page.reload();
        await delay(1000);

        console.log('Logging in as James Wilson...');
        await page.type('#login-email', 'j.wilson@company.com');
        await page.type('#login-password', 'User@123');
        await page.click('#login-btn');
        await delay(1500);

        console.log('Navigating to My Assets tab...');
        await page.click('button[data-tab="assets"]');
        await delay(1000);

        // Verify my assets render
        const assetCardsCount = await page.evaluate(() => {
            return document.querySelectorAll('#assets-grid-container .kb-sidebar-card').length;
        });
        console.log('Number of assets rendered:', assetCardsCount);
        if (assetCardsCount < 2) {
            console.error('FAIL: User assigned assets did not render correctly. Expected at least 2.');
            hasError = true;
        }

        // Verify specific asset names are visible
        const assetText = await page.evaluate(() => {
            return document.getElementById('assets-grid-container').innerText;
        });
        console.log('Assets list text content:');
        console.log(assetText);
        if (!assetText.includes('Latitude 5520') || !assetText.includes('UltraSharp 27')) {
            console.error('FAIL: Expected assets (Latitude laptop / UltraSharp monitor) were not found.');
            hasError = true;
        }

        // Click "Report Issue" on Latitude Laptop
        console.log('Clicking "Report Issue" on Laptop...');
        await page.evaluate(() => {
            const reportButtons = Array.from(document.querySelectorAll('#assets-grid-container button'));
            const laptopBtn = reportButtons.find(b => b.parentNode.innerText.includes('Latitude'));
            if (laptopBtn) laptopBtn.click();
        });
        await delay(1000);

        // Verify ticket form switches and pre-fills
        const ticketPrefill = await page.evaluate(() => {
            const activeTab = document.getElementById('ptab-new-ticket').classList.contains('active');
            const subjectVal = document.getElementById('nt-subject').value;
            const categoryVal = document.getElementById('nt-category').value;
            const deviceSelectVal = document.getElementById('nt-device-select').value;
            return { activeTab, subjectVal, categoryVal, deviceSelectVal };
        });
        console.log('Switched to New Ticket tab:', ticketPrefill.activeTab);
        console.log('Pre-filled Ticket Subject:', ticketPrefill.subjectVal);
        console.log('Pre-filled Ticket Category:', ticketPrefill.categoryVal);
        console.log('Pre-filled Selected Device:', ticketPrefill.deviceSelectVal);

        if (!ticketPrefill.activeTab || !ticketPrefill.subjectVal.includes('Latitude') || ticketPrefill.categoryVal !== 'Hardware' || !ticketPrefill.deviceSelectVal.includes('AST-0021')) {
            console.error('FAIL: Ticket fields pre-fill from asset list was incorrect:', ticketPrefill);
            hasError = true;
        } else {
            console.log('SUCCESS: Portal Report Issue from Assets E2E passed!');
        }

        // Sign out user
        await page.click('#portal-logout');
        await delay(1000);


        // =============================================
        // PART 2: Admin Dashboard Snipe-IT Assets Grid & Settings
        // =============================================
        console.log('\n--- PART 2: Admin Dashboard Snipe-IT Assets Management E2E tests ---');
        await page.goto('http://localhost:3000/index.html');
        await delay(1000);

        console.log('Signing in as Admin...');
        await page.evaluate(() => {
            document.getElementById('al-email').value = 'admin@helpdesk.com';
            document.getElementById('al-password').value = 'Admin@123';
            document.getElementById('al-submit').click();
        });
        await delay(1500);

        console.log('Navigating to Assets tab...');
        await page.click('button[data-view="assets"]');
        await delay(1000);

        // Verify assets data table loads
        const assetRowsCount = await page.evaluate(() => {
            return document.querySelectorAll('#assets-tbody tr').length;
        });
        console.log('Number of assets rows in admin grid:', assetRowsCount);
        if (assetRowsCount < 8) {
            console.error('FAIL: Admin asset table rows were less than expected seed size (9).');
            hasError = true;
        }

        // Check out AST-0025 (iPad Pro) to Emily Davis using the new dedicated Check Out modal
        console.log('Checking out iPad Pro (AST-0025) to Emily Davis...');
        await page.evaluate(() => {
            // Find row for AST-0025
            const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
            const ipadRow = rows.find(r => r.innerText.includes('AST-0025'));
            if (ipadRow) {
                const checkoutBtn = ipadRow.querySelector('button[title="Check Out Asset"]');
                if (checkoutBtn) checkoutBtn.click();
            }
        });
        await delay(1000);

        // Fill checkout modal and submit
        await page.evaluate(() => {
            document.getElementById('checkout-assignee').value = 'Emily Davis|e.davis@company.com';
            document.getElementById('checkout-comments').value = 'Assigned for testing';
            document.getElementById('checkout-modal-submit').click();
        });
        await delay(1000);

        // Verify status is "Deployed" and Assignee is Emily Davis
        const ipadState = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
            const ipadRow = rows.find(r => r.innerText.includes('AST-0025'));
            return ipadRow ? ipadRow.innerText : '';
        });
        console.log('Updated iPad Pro Row text:', ipadState);
        if (!ipadState.includes('Deployed') || !ipadState.includes('Emily Davis')) {
            console.error('FAIL: Checkout check failed. iPad Pro was not successfully assigned to Emily.');
            hasError = true;
        } else {
            console.log('SUCCESS: Admin Asset Assignment checkout passed!');
        }

        // Test Adding a new Asset with new fields
        console.log('Adding a new asset with model number, make, vendor, warranty, and purchase date...');
        await page.click('#btn-add-asset');
        await delay(1000);

        await page.evaluate(() => {
            document.getElementById('assetm-name').value = 'Test E2E Laptop';
            document.getElementById('assetm-model').value = 'ThinkPad T14';
            document.getElementById('assetm-model-number').value = 'TP-T14-GEN4';
            document.getElementById('assetm-category').value = 'Hardware';
            document.getElementById('assetm-make').value = 'Lenovo';
            document.getElementById('assetm-serial').value = 'S/N T14-TEST-99';
            document.getElementById('assetm-status').value = 'Ready to Deploy';
            
            const vendorSelect = document.getElementById('assetm-vendor');
            vendorSelect.value = '__custom__';
            vendorSelect.dispatchEvent(new Event('change'));
            
            document.getElementById('assetm-vendor-custom').value = 'CDW Govt';
            document.getElementById('assetm-vendor-details').value = 'govt-sales@cdw.com';
            document.getElementById('assetm-purchase-date').value = '2026-05-01';
            document.getElementById('assetm-warranty').value = '24';
            
            document.getElementById('asset-modal-save').click();
        });
        await delay(1500);

        // Verify the new row is rendered and contains all the details
        const newAssetRowText = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
            const testRow = rows.find(r => r.innerText.includes('Test E2E Laptop'));
            return testRow ? testRow.innerText : '';
        });
        console.log('New Asset Row Text:', newAssetRowText);
        if (!newAssetRowText.includes('Lenovo ThinkPad T14') ||
            !newAssetRowText.includes('Model #: TP-T14-GEN4') ||
            !newAssetRowText.includes('CDW Govt') ||
            !newAssetRowText.includes('Purchased: 2026-05-01') ||
            !newAssetRowText.includes('24 mo. warranty')) {
            console.error('FAIL: Adding asset with detailed make, model number, vendor, warranty, and purchase date failed.');
            hasError = true;
        } else {
            console.log('SUCCESS: Add Asset E2E with detailed properties passed!');
        }

        // =============================================
        // PART 2.5: Custom Asset Tag validation tests
        // =============================================
        console.log('\n--- PART 2.5: Custom Asset Tag validation tests ---');
        console.log('Adding a new asset with a custom asset tag...');
        await page.click('#btn-add-asset');
        await delay(1000);

        await page.evaluate(() => {
            document.getElementById('assetm-tag').value = 'MY-CUSTOM-TAG-99';
            document.getElementById('assetm-name').value = 'Custom Tag Laptop';
            document.getElementById('assetm-model').value = 'ThinkPad X1';
            document.getElementById('assetm-category').value = 'Hardware';
            document.getElementById('assetm-status').value = 'Ready to Deploy';
            document.getElementById('asset-modal-save').click();
        });
        await delay(1500);

        // Verify the row with custom tag is rendered
        let customAssetRowText = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
            const row = rows.find(r => r.innerText.includes('MY-CUSTOM-TAG-99'));
            return row ? row.innerText : '';
        });
        console.log('Custom Asset Row (MY-CUSTOM-TAG-99):', customAssetRowText);
        if (!customAssetRowText.includes('Custom Tag Laptop')) {
            console.error('FAIL: Custom asset tag creation failed.');
            hasError = true;
        } else {
            console.log('SUCCESS: Custom asset tag creation passed!');
        }

        // Test editing the custom tag
        console.log('Editing asset to change custom tag from MY-CUSTOM-TAG-99 to MY-CUSTOM-TAG-88...');
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
            const row = rows.find(r => r.innerText.includes('MY-CUSTOM-TAG-99'));
            if (row) {
                const editBtn = row.querySelector('button[onclick^="openAssetModal"]');
                if (editBtn) editBtn.click();
            }
        });
        await delay(1000);

        // Modify the tag
        await page.evaluate(() => {
            document.getElementById('assetm-tag').value = 'MY-CUSTOM-TAG-88';
            document.getElementById('asset-modal-save').click();
        });
        await delay(1500);

        // Verify that tag updated in the grid
        let updatedRowText88 = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
            const row = rows.find(r => r.innerText.includes('MY-CUSTOM-TAG-88'));
            return row ? row.innerText : '';
        });
        let oldRowExists = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
            return rows.some(r => r.innerText.includes('MY-CUSTOM-TAG-99'));
        });
        console.log('Updated Custom Asset Row (MY-CUSTOM-TAG-88):', updatedRowText88);
        console.log('Old Tag MY-CUSTOM-TAG-99 exists:', oldRowExists);

        if (!updatedRowText88.includes('Custom Tag Laptop') || oldRowExists) {
            console.error('FAIL: Custom asset tag edit/renaming failed.');
            hasError = true;
        } else {
            console.log('SUCCESS: Custom asset tag edit/renaming passed!');
        }

        // Test duplicate tag validation
        console.log('Testing duplicate tag validation (trying to create asset with MY-CUSTOM-TAG-88)...');
        await page.click('#btn-add-asset');
        await delay(1000);

        await page.evaluate(() => {
            document.getElementById('assetm-tag').value = 'MY-CUSTOM-TAG-88';
            document.getElementById('assetm-name').value = 'Another Duplicate Laptop';
            document.getElementById('assetm-model').value = 'ThinkPad X1';
            document.getElementById('asset-modal-save').click();
        });
        await delay(1000);

        // The modal should remain visible because validation failed
        const isModalOpenAfterDuplicate = await page.evaluate(() => {
            const overlay = document.getElementById('asset-modal-overlay');
            return overlay.style.display === 'flex' || window.getComputedStyle(overlay).display === 'flex';
        });
        console.log('Is modal open after duplicate save attempt:', isModalOpenAfterDuplicate);

        if (!isModalOpenAfterDuplicate) {
            console.error('FAIL: Duplicate tag was saved when it should have failed validation.');
            hasError = true;
        } else {
            console.log('SUCCESS: Duplicate asset tag validation successfully blocked save!');
            // Close the modal to cleanup
            await page.evaluate(() => {
                document.getElementById('asset-modal-close').click();
            });
            await delay(500);
        }

        // =============================================
        // PART 2.7: Asset Financial Details & File Uploads E2E tests
        // =============================================
        console.log('\n--- PART 2.7: Asset Financial Details & File Uploads E2E tests ---');
        console.log('Opening edit modal for MY-CUSTOM-TAG-88 to add financial details and mock uploads...');
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
            const row = rows.find(r => r.innerText.includes('MY-CUSTOM-TAG-88'));
            if (row) {
                const editBtn = row.querySelector('button[onclick^="openAssetModal"]');
                if (editBtn) editBtn.click();
            }
        });
        await delay(1000);

        console.log('Filling financial fields and injecting mock file base64 data...');
        await page.evaluate(() => {
            document.getElementById('assetm-po-number').value = 'PO-E2E-12345';
            document.getElementById('assetm-po-value').value = '4500.50';
            document.getElementById('assetm-asset-value').value = '4200.75';
            
            // Assign to James Wilson so it shows in user portal
            document.getElementById('assetm-assignee').value = 'James Wilson|j.wilson@company.com';

            // Mock uploads via base64 hidden inputs
            document.getElementById('assetm-pic-data').value = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            document.getElementById('assetm-invoice-data').value = 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDMwMDBMYQADAgZ7CQE=';
            document.getElementById('assetm-invoice-filename').value = 'e2e_invoice.pdf';
            document.getElementById('assetm-po-data').value = 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDMwMDBMYQADAgZ7CQE=';
            document.getElementById('assetm-po-filename').value = 'e2e_po_copy.pdf';

            document.getElementById('asset-modal-save').click();
        });
        await delay(1500);

        // Verify values display in admin grid row
        const financialRowHTML = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
            const testRow = rows.find(r => r.innerText.includes('MY-CUSTOM-TAG-88'));
            return testRow ? testRow.innerHTML : '';
        });

        console.log('Verifying financial fields render in admin grid...');
        const hasPOText = financialRowHTML.includes('PO: <strong>PO-E2E-12345</strong>');
        const hasPOValue = financialRowHTML.includes('PO Val: <strong>₹4,500.5</strong>');
        const hasAssetValue = financialRowHTML.includes('Asset Val: <strong>₹4,200.75</strong>');
        const hasPicThumbnail = financialRowHTML.includes('<img src="data:image/png;base64');
        const hasInvoiceBadge = financialRowHTML.includes('📄 Invoice');
        const hasPOCopyBadge = financialRowHTML.includes('📄 PO Copy');

        if (!hasPOText || !hasPOValue || !hasAssetValue || !hasPicThumbnail || !hasInvoiceBadge || !hasPOCopyBadge) {
            console.error('FAIL: Financial details or file uploads did not render correctly in admin grid.');
            console.log('Row HTML details:', financialRowHTML);
            hasError = true;
        } else {
            console.log('SUCCESS: Asset financial details and file upload badges rendered correctly in admin grid!');
        }

        // Navigate to User Portal to verify image banner displays on James Wilson's assets page
        console.log('Navigating back to User Portal...');
        await page.goto('http://localhost:3000/portal.html');
        await delay(1000);

        console.log('Logging in as James Wilson...');
        await page.type('#login-email', 'j.wilson@company.com');
        await page.type('#login-password', 'User@123');
        await page.click('#login-btn');
        await delay(1500);

        console.log('Navigating to My Assets tab...');
        await page.click('button[data-tab="assets"]');
        await delay(1000);

        const portalCardWithImageHTML = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('#assets-grid-container .kb-sidebar-card'));
            const customCard = cards.find(c => c.innerText.includes('MY-CUSTOM-TAG-88'));
            return customCard ? customCard.innerHTML : '';
        });

        console.log('Verifying picture banner renders in user portal asset card...');
        const hasPortalImageBanner = portalCardWithImageHTML.includes('<img src="data:image/png;base64');
        
        if (!hasPortalImageBanner) {
            console.error('FAIL: Picture banner did not display on portal asset card.');
            console.log('Card HTML details:', portalCardWithImageHTML);
            hasError = true;
        } else {
            console.log('SUCCESS: Picture banner rendered perfectly on user portal asset card!');
        }

        // Return to admin dashboard for the remaining part of tests
        console.log('Returning to Admin Dashboard...');
        await page.goto('http://localhost:3000/index.html');
        await delay(1000);
        await page.click('button[data-view="assets"]');
        await delay(1000);

        // =============================================
        // PART 2.9: Asset Status Tabs Navigation E2E tests
        // =============================================
        console.log('\n--- PART 2.9: Asset Status Tabs Navigation E2E tests ---');
        console.log('Clicking the "Ready to Deploy" status tab...');
        await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('#asset-status-tabs .settings-tab'));
            const readyTab = tabs.find(t => t.innerText.includes('Ready to Deploy'));
            if (readyTab) readyTab.click();
        });
        await delay(1000);

        // Assert that unassigned asset (AST-0030) is present and deployed asset (AST-0025) is NOT present
        let readyState = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
            const text = rows.map(r => r.innerText).join('\n');
            const hasReady = text.includes('AST-0030');
            const hasDeployed = text.includes('AST-0025');
            return { hasReady, hasDeployed, count: rows.length };
        });
        console.log('Ready to Deploy tab state:', readyState);
        if (!readyState.hasReady || readyState.hasDeployed) {
            console.error('FAIL: Status filtering tab "Ready to Deploy" failed.');
            hasError = true;
        } else {
            console.log('SUCCESS: Status filtering tab "Ready to Deploy" passed!');
        }

        console.log('Clicking the "Deployed" status tab...');
        await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('#asset-status-tabs .settings-tab'));
            const deployedTab = tabs.find(t => t.innerText.includes('Deployed'));
            if (deployedTab) deployedTab.click();
        });
        await delay(1000);

        // Assert that deployed asset (AST-0025) is present and unassigned (AST-0030) is NOT present
        let deployedState = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
            const text = rows.map(r => r.innerText).join('\n');
            const hasReady = text.includes('AST-0030');
            const hasDeployed = text.includes('AST-0025');
            return { hasReady, hasDeployed, count: rows.length };
        });
        console.log('Deployed tab state:', deployedState);
        if (deployedState.hasReady || !deployedState.hasDeployed) {
            console.error('FAIL: Status filtering tab "Deployed" failed.');
            hasError = true;
        } else {
            console.log('SUCCESS: Status filtering tab "Deployed" passed!');
        }

        console.log('Restoring "All Assets" status tab...');
        await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('#asset-status-tabs .settings-tab'));
            const allTab = tabs.find(t => t.innerText.includes('All Assets'));
            if (allTab) allTab.click();
        });
        await delay(1000);

        // =============================================
        // PART 3: Audit Trail Integration tests for Assets
        // =============================================
        console.log('\n--- PART 3: Central Audit Trail Integration tests for Assets ---');
        console.log('Navigating to Audit Trail tab...');
        await page.click('button[data-view="audit-trail"]');
        await delay(1000);

        // Filter by Asset Operations
        console.log('Filtering Audit Trail by Asset Operations...');
        await page.evaluate(() => {
            const filterSelect = document.getElementById('audit-filter-action');
            filterSelect.value = 'asset';
            filterSelect.dispatchEvent(new Event('change'));
        });
        await delay(1000);

        // Verify that the created asset and checked-out asset are visible in the audit trail
        const auditRowsText = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#audit-trail-table-body tr'));
            return rows.map(r => r.innerText);
        });
        console.log('Audit trail rows (Filtered by Asset Operations):', auditRowsText);

        const hasCreateLog = auditRowsText.some(text => text.includes('Created asset AST-0030') && text.includes('Test E2E Laptop'));
        const hasCheckoutLog = auditRowsText.some(text => text.includes('Checked out asset AST-0025') && text.includes('Emily Davis'));

        if (!hasCreateLog || !hasCheckoutLog) {
            console.error('FAIL: Expected asset audit log entries not found.');
            hasError = true;
        } else {
            console.log('SUCCESS: Asset operations audit log verification passed!');
        }

        // Test clicking the Asset ID (AST-0030) opens the asset modal
        console.log('Clicking on Asset ID link in Audit Trail...');
        await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('#audit-trail-table-body a'));
            const astLink = links.find(l => l.innerText.includes('AST-0030'));
            if (astLink) astLink.click();
        });
        await delay(1000);

        // Verify the asset modal overlay is open and matches AST-0030
        const modalState = await page.evaluate(() => {
            const overlay = document.getElementById('asset-modal-overlay');
            const title = document.getElementById('asset-modal-title').innerText;
            const tagInputVal = document.getElementById('assetm-tag').value;
            const isVisible = overlay.style.display === 'flex' || window.getComputedStyle(overlay).display === 'flex';
            return { isVisible, title, tagInputVal };
        });
        console.log('Asset Modal state after audit trail click:', modalState);

        if (!modalState.isVisible || !modalState.tagInputVal.includes('AST-0030')) {
            console.error('FAIL: Clicking asset ID in audit trail did not open the edit asset modal correctly.');
            hasError = true;
        } else {
            console.log('SUCCESS: Clicking Asset ID link in Audit Trail successfully opens the Asset Edit Modal!');
            
            // =============================================
            // PART 2.10: IT Asset Audits E2E tests
            // =============================================
            console.log('\n--- PART 2.10: IT Asset Audits E2E tests ---');
            console.log('Configuring Quarterly audit for AST-0030...');
            await page.evaluate(() => {
                document.getElementById('assetm-audit-frequency').value = 'Quarterly';
                document.getElementById('assetm-last-audit-date').value = '2026-03-01';
                
                // Trigger change event to auto-calculate next due date
                const freqSelect = document.getElementById('assetm-audit-frequency');
                freqSelect.dispatchEvent(new Event('change'));
            });
            await delay(500);

            const calculatedDate = await page.evaluate(() => {
                return document.getElementById('assetm-next-audit-date').value;
            });
            console.log('Auto-calculated next audit due date:', calculatedDate);
            if (calculatedDate !== '2026-06-01') {
                console.error('FAIL: Auto-calculated next audit due date is incorrect. Expected: 2026-06-01, Got:', calculatedDate);
                hasError = true;
            } else {
                console.log('SUCCESS: Next audit due date auto-calculated successfully!');
            }

            // Save the asset
            console.log('Saving asset with audit config...');
            await page.evaluate(() => {
                document.getElementById('assetm-audit-comment').value = 'Initial E2E audit schedule setup';
                document.getElementById('asset-modal-save').click();
            });
            await delay(1500);

            // Reload page to trigger the notifications scan on load
            console.log('Reloading page to trigger notifications scan...');
            await page.reload();
            await delay(1500);

            // Navigate back to Assets
            await page.click('button[data-view="assets"]');
            await delay(1000);

            // Check if in-app notification is present
            const auditNotificationExists = await page.evaluate(() => {
                const badge = document.getElementById('notif-badge');
                const badgeVisible = badge && badge.style.display !== 'none';
                
                // Trigger dropdown click to see notifications text
                document.getElementById('notif-btn').click();
                const listText = document.getElementById('notif-list').innerText;
                document.getElementById('notif-btn').click(); // close it
                
                return { badgeVisible, listText };
            });
            console.log('Notification Badge status & List Text:', auditNotificationExists);
            if (!auditNotificationExists.listText.includes('AST-0030') || !auditNotificationExists.listText.includes('overdue')) {
                console.error('FAIL: System did not generate notification for overdue asset audit.');
                hasError = true;
            } else {
                console.log('SUCCESS: System correctly notified user of overdue asset audit!');
            }

            // Click the "Due Audits" tab filter
            console.log('Clicking the "Due Audits" status tab...');
            await page.evaluate(() => {
                const tabs = Array.from(document.querySelectorAll('#asset-status-tabs .settings-tab'));
                const dueTab = tabs.find(t => t.dataset.status === 'due-audits');
                if (dueTab) dueTab.click();
            });
            await delay(1000);

            // Verify AST-0030 is displayed and the Warning Badge is visible
            const dueGridState = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
                const text = rows.map(r => r.innerText).join('\n');
                const hasAST30 = text.includes('AST-0030');
                const hasWarningBadge = text.includes('⚠️ Audit: Overdue');
                return { hasAST30, hasWarningBadge, count: rows.length };
            });
            console.log('Due Audits tab grid state:', dueGridState);
            if (!dueGridState.hasAST30 || !dueGridState.hasWarningBadge) {
                console.error('FAIL: Asset AST-0030 or its Overdue warning badge is missing from Due Audits tab.');
                hasError = true;
            } else {
                console.log('SUCCESS: Due Audits tab correctly filtered and rendered overdue warning badge!');
            }

            // Click edit on AST-0030 from the grid
            console.log('Opening edit modal for AST-0030 from Due Audits view...');
            await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
                const testRow = rows.find(r => r.innerText.includes('AST-0030'));
                if (testRow) {
                    const editBtn = testRow.querySelector('button[title="Edit Asset"]');
                    if (editBtn) editBtn.click();
                }
            });
            await delay(1000);

            // Click "Complete Current Audit" button
            console.log('Clicking "Complete Current Audit" button inside modal...');
            const auditDatesAfterComplete = await page.evaluate(() => {
                document.getElementById('btn-mark-audited').click();
                return {
                    lastAudit: document.getElementById('assetm-last-audit-date').value,
                    nextAudit: document.getElementById('assetm-next-audit-date').value
                };
            });
            console.log('Dates after completing audit:', auditDatesAfterComplete);
            const todayStr = new Date().toISOString().split('T')[0];
            if (auditDatesAfterComplete.lastAudit !== todayStr) {
                console.error('FAIL: Last audit date did not update to today.');
                hasError = true;
            } else {
                console.log('SUCCESS: Last audit date successfully updated to today!');
            }

            // Save the asset again
            console.log('Saving asset after completing audit...');
            await page.evaluate(() => {
                document.getElementById('assetm-audit-comment').value = 'Scheduled Quarterly Audit';
                document.getElementById('asset-modal-save').click();
            });
            await delay(1500);

            // Verify AST-0030 is no longer shown in the "Due Audits" tab filter
            const postAuditGridState = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
                const text = rows.map(r => r.innerText).join('\n');
                const hasAST30 = text.includes('AST-0030');
                return { hasAST30, count: rows.length };
            });
            console.log('Due Audits tab grid state post audit completion:', postAuditGridState);
            if (postAuditGridState.hasAST30) {
                console.error('FAIL: Asset AST-0030 is still displayed in Due Audits view.');
                hasError = true;
            } else {
                console.log('SUCCESS: Asset AST-0030 is no longer in the Due Audits view!');
            }

            // --- TEST INLINE ROW QUICK AUDIT BUTTON ---
            console.log('\nTesting inline Row "📋 Audit" button...');
            console.log('Restoring "All Assets" status tab to edit asset back to overdue...');
            await page.evaluate(() => {
                const tabs = Array.from(document.querySelectorAll('#asset-status-tabs .settings-tab'));
                const allTab = tabs.find(t => t.innerText.includes('All Assets'));
                if (allTab) allTab.click();
            });
            await delay(1000);

            console.log('Opening edit modal for AST-0030 to set back to overdue...');
            await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
                const testRow = rows.find(r => r.innerText.includes('AST-0030'));
                if (testRow) {
                    const editBtn = testRow.querySelector('button[title="Edit Asset"]');
                    if (editBtn) editBtn.click();
                }
            });
            await delay(1000);

            console.log('Resetting audit dates to overdue in modal...');
            await page.evaluate(() => {
                document.getElementById('assetm-last-audit-date').value = '2026-03-01';
                // Trigger change to auto-calculate next audit date
                const event = new Event('change');
                document.getElementById('assetm-last-audit-date').dispatchEvent(event);
            });
            await delay(500);

            console.log('Saving asset to persist overdue status...');
            await page.evaluate(() => {
                document.getElementById('asset-modal-save').click();
            });
            await delay(1500);

            console.log('Clicking the "Due Audits" status tab...');
            await page.evaluate(() => {
                const tabs = Array.from(document.querySelectorAll('#asset-status-tabs .settings-tab'));
                const dueTab = tabs.find(t => t.dataset.status === 'due-audits');
                if (dueTab) dueTab.click();
            });
            await delay(1000);

            // Mock window.prompt to auto-fill timeline frequency and mandatory comment
            console.log('Mocking window.prompt and clicking inline row "📋 Audit" button...');
            await page.evaluate(() => {
                let callCount = 0;
                window.prompt = () => {
                    callCount++;
                    if (callCount === 1) return 'Quarterly';
                    return 'Completed E2E row audit';
                };
                window.alert = () => {};
                const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
                const testRow = rows.find(r => r.innerText.includes('AST-0030'));
                if (testRow) {
                    const auditBtn = testRow.querySelector('button.btn-quick-audit');
                    if (auditBtn) auditBtn.click();
                }
            });
            await delay(1500);

            // Verify AST-0030 is no longer shown in the "Due Audits" tab filter
            const inlineAuditGridState = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
                const text = rows.map(r => r.innerText).join('\n');
                const hasAST30 = text.includes('AST-0030');
                return { hasAST30, count: rows.length };
            });
            console.log('Due Audits tab grid state post inline audit:', inlineAuditGridState);
            if (inlineAuditGridState.hasAST30) {
                console.error('FAIL: Asset AST-0030 is still displayed in Due Audits view after inline row audit.');
                hasError = true;
            } else {
                console.log('SUCCESS: Asset AST-0030 is no longer in the Due Audits view after inline row audit!');
            }

            // --- TEST BULK AUDIT ALL ASSETS BUTTON ---
            console.log('\nTesting Bulk Audit All Assets button...');
            console.log('Restoring "All Assets" status tab...');
            await page.evaluate(() => {
                const tabs = Array.from(document.querySelectorAll('#asset-status-tabs .settings-tab'));
                const allTab = tabs.find(t => t.innerText.includes('All Assets'));
                if (allTab) allTab.click();
            });
            await delay(1000);

            console.log('Mocking window.confirm/prompt and clicking "📋 Bulk Audit All" button...');
            await page.evaluate(() => {
                window.confirm = () => true;
                window.prompt = () => 'Bulk E2E audit comment';
                const btn = document.getElementById('btn-bulk-audit-all');
                if (btn) btn.click();
            });
            await delay(1500);

            console.log('Clicking the "Due Audits" status tab...');
            await page.evaluate(() => {
                const tabs = Array.from(document.querySelectorAll('#asset-status-tabs .settings-tab'));
                const dueTab = tabs.find(t => t.dataset.status === 'due-audits');
                if (dueTab) dueTab.click();
            });
            await delay(1000);

            const bulkPostAuditGridState = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
                const text = rows.map(r => r.innerText).join('\n');
                const hasNoAssets = text.includes('No assets found matching your criteria.');
                return { hasNoAssets, count: rows.length };
            });
            console.log('Due Audits tab grid state post bulk audit:', bulkPostAuditGridState);
            if (!bulkPostAuditGridState.hasNoAssets) {
                console.error('FAIL: Due Audits tab is not empty after bulk audit.');
                hasError = true;
            } else {
                console.log('SUCCESS: All assets successfully bulk audited and cleared from Due Audits view!');
            }

            // Restore "All Assets" tab filter
            console.log('Restoring "All Assets" status tab...');
            await page.evaluate(() => {
                const tabs = Array.from(document.querySelectorAll('#asset-status-tabs .settings-tab'));
                const allTab = tabs.find(t => t.innerText.includes('All Assets'));
                if (allTab) allTab.click();
            });
            await delay(1000);

            // --- TEST ASSET LIFECYCLE HISTORY & MAINTENANCE LOGS ---
            console.log('\nTesting Asset Lifecycle History & Maintenance Logs...');
            console.log('Opening edit modal for AST-0030...');
            await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
                const testRow = rows.find(r => r.innerText.includes('AST-0030'));
                if (testRow) {
                    const editBtn = testRow.querySelector('button[title="Edit Asset"]');
                    if (editBtn) editBtn.click();
                }
            });
            await delay(1000);

            console.log('Clicking the "History" tab...');
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('.modal-tab-btn')).find(b => b.innerText.includes('History'));
                if (btn) btn.click();
            });
            await delay(500);

            console.log('Verifying initial history timeline contains creation/audit logs...');
            const initialTimelineHTML = await page.evaluate(() => {
                return document.getElementById('assetm-history-timeline').innerHTML;
            });
            if (!initialTimelineHTML.includes('Created asset') && !initialTimelineHTML.includes('Audit')) {
                console.error('FAIL: Creation or audit logs missing in asset history timeline.');
                hasError = true;
            } else {
                console.log('SUCCESS: Asset history timeline loaded with initial logs!');
            }

            console.log('Clicking the "Maintenance" tab...');
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('.modal-tab-btn')).find(b => b.innerText.includes('Maintenance'));
                if (btn) btn.click();
            });
            await delay(500);

            console.log('Clicking "Log Maintenance" button to open form...');
            await page.evaluate(() => {
                const btn = document.getElementById('btn-add-maintenance-modal');
                if (btn) btn.click();
            });
            await delay(500);

            console.log('Filling maintenance form and saving...');
            await page.evaluate(() => {
                document.getElementById('assetm-maint-start-date').value = '2026-06-17';
                document.getElementById('assetm-maint-end-date').value = '2026-06-17';
                document.getElementById('assetm-maint-vendor').value = 'Dell Direct';
                document.getElementById('assetm-maint-type').value = 'Battery replacement';
                document.getElementById('assetm-maint-cost').value = '120.00';
                document.getElementById('assetm-maint-notes').value = 'Replaced swelling battery with OEM battery.';
                document.getElementById('btn-save-maintenance').click();
            });
            await delay(1000);

            console.log('Verifying maintenance cost and history updates...');
            const maintenanceState = await page.evaluate(() => {
                const costText = document.getElementById('assetm-total-maintenance-cost').innerText;
                const timelineText = document.getElementById('assetm-maintenance-timeline').innerText;
                return { costText, timelineText };
            });
            console.log('Maintenance state post-save:', maintenanceState);
            if (!maintenanceState.costText.includes('120.00')) {
                console.error('FAIL: Total maintenance cost not updated correctly.');
                hasError = true;
            } else if (!maintenanceState.timelineText.includes('Battery replacement') || !maintenanceState.timelineText.includes('Cost: ₹120.00')) {
                console.error('FAIL: Maintenance event not listed in maintenance timeline.');
                hasError = true;
            } else if (!maintenanceState.timelineText.includes('Vendor: Dell Direct') || !maintenanceState.timelineText.includes('Date: 2026-06-17')) {
                console.error('FAIL: Maintenance start date/end date or vendor name not displayed in timeline.');
                hasError = true;
            } else {
                console.log('SUCCESS: Maintenance logged and rendered correctly in maintenance tab!');
            }

            console.log('Closing the asset modal...');
            await page.evaluate(() => {
                const btn = document.getElementById('asset-modal-close');
                if (btn) btn.click();
            });
            await delay(1000);
        }

        // --- PART 2.11: Manage Vendors Registry E2E tests ---
        console.log('\n--- PART 2.11: Manage Vendors Registry E2E tests ---');
        console.log('Opening Manage Vendors modal...');
        await page.click('#btn-manage-vendors');
        await delay(1000);

        const isVendorsModalOpen = await page.evaluate(() => {
            const modal = document.getElementById('vendors-modal-overlay');
            return modal && modal.style.display === 'flex';
        });
        if (!isVendorsModalOpen) {
            console.error('FAIL: Manage Vendors modal did not open.');
            hasError = true;
        } else {
            console.log('SUCCESS: Manage Vendors modal opened successfully!');
        }

        console.log('Adding new vendor details...');
        await page.evaluate(() => {
            document.getElementById('vendorm-name').value = 'Tech Vijay';
            document.getElementById('vendorm-email').value = 'vijay@tech.com';
            document.getElementById('vendorm-contact').value = '+91-9876543210';
            document.getElementById('vendorm-gst').value = '22VIJAY1234A1Z5';
            document.getElementById('vendorm-address').value = 'Vijay Towers, Sector 62, Noida';
            document.getElementById('btn-save-vendor').click();
        });
        await delay(1000);

        const vendorListText = await page.evaluate(() => {
            return document.getElementById('vendors-list-tbody').innerText;
        });
        console.log('Vendor List Text:', vendorListText);
        if (!vendorListText.includes('Tech Vijay') || !vendorListText.includes('GST: 22VIJAY1234A1Z5') || !vendorListText.includes('vijay@tech.com')) {
            console.error('FAIL: New vendor with detailed fields not added/rendered in registry list.');
            hasError = true;
        } else {
            console.log('SUCCESS: New vendor added to registry successfully!');
        }

        console.log('Editing the new vendor...');
        await page.evaluate(() => {
            const tbody = document.getElementById('vendors-list-tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const row = rows.find(r => r.innerText.includes('Tech Vijay'));
            if (row) {
                const editBtn = row.querySelector('button[title="Edit"]');
                if (editBtn) editBtn.click();
            }
        });
        await delay(1000);

        const formState = await page.evaluate(() => {
            return {
                name: document.getElementById('vendorm-name').value,
                email: document.getElementById('vendorm-email').value,
                contact: document.getElementById('vendorm-contact').value,
                gst: document.getElementById('vendorm-gst').value,
                address: document.getElementById('vendorm-address').value
            };
        });
        console.log('Form State during Edit:', formState);
        if (formState.name !== 'Tech Vijay' || formState.email !== 'vijay@tech.com' || formState.address !== 'Vijay Towers, Sector 62, Noida') {
            console.error('FAIL: Edit form not populated correctly with vendor details.');
            hasError = true;
        } else {
            console.log('SUCCESS: Edit form populated correctly!');
        }

        console.log('Updating vendor details...');
        await page.evaluate(() => {
            document.getElementById('vendorm-address').value = 'Noida Phase II';
            document.getElementById('btn-save-vendor').click();
        });
        await delay(1000);

        const updatedVendorListText = await page.evaluate(() => {
            return document.getElementById('vendors-list-tbody').innerText;
        });
        if (!updatedVendorListText.includes('Noida Phase II')) {
            console.error('FAIL: Vendor address not updated in the registry list.');
            hasError = true;
        } else {
            console.log('SUCCESS: Vendor address updated successfully!');
        }

        console.log('Deleting vendor...');
        await page.evaluate(() => {
            // Override window.confirm to always return true for deletion
            window.confirm = () => true;
            const tbody = document.getElementById('vendors-list-tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const row = rows.find(r => r.innerText.includes('Tech Vijay'));
            if (row) {
                const deleteBtn = row.querySelector('button[title="Delete"]');
                if (deleteBtn) deleteBtn.click();
            }
        });
        await delay(1000);

        const finalVendorListText = await page.evaluate(() => {
            return document.getElementById('vendors-list-tbody').innerText;
        });
        if (finalVendorListText.includes('Tech Vijay')) {
            console.error('FAIL: Vendor not deleted from registry.');
            hasError = true;
        } else {
            console.log('SUCCESS: Vendor deleted from registry successfully!');
        }

        console.log('Closing Manage Vendors modal...');
        await page.evaluate(() => {
            const closeBtn = document.getElementById('vendors-modal-cancel');
            if (closeBtn) closeBtn.click();
        });
        await delay(1000);

        // Navigate to Settings
        console.log('Navigating to Settings > Snipe-IT Integration tab...');
        await page.click('button[data-view="settings"]');
        await delay(1000);
        await page.click('button[data-stab="snipe-it"]');
        await delay(1000);

        // Enter URL, click Test Connection
        console.log('Testing Snipe-IT connection settings...');
        await page.evaluate(() => {
            document.getElementById('snipe-url').value = 'https://demo.snipe-it-custom.com/api/v1';
            document.getElementById('btn-test-snipe').click();
        });
        await delay(1500);

        const connectionMsg = await page.evaluate(() => {
            return document.getElementById('snipe-connection-status').innerText;
        });
        console.log('Connection test result text:', connectionMsg);
        if (!connectionMsg.includes('Connected successfully') || !connectionMsg.includes('200 OK')) {
            console.error('FAIL: Snipe-IT connection verification test failed.');
            hasError = true;
        } else {
            console.log('SUCCESS: Snipe-IT connection configurations validation passed!');
        }

        await browser.close();
        server.close();
        if (hasError) {
            console.error('\nSNIPE-IT ASSET INTEGRATION TESTS FAILED');
            process.exit(1);
        } else {
            console.log('\nSNIPE-IT ASSET INTEGRATION TESTS SUCCESSFUL!');
            process.exit(0);
        }
    } catch (e) {
        console.error('Script Error:', e);
        try {
            await page.screenshot({ path: path.join(__dirname, 'error_screenshot.png') });
            console.log('Saved error_screenshot.png');
        } catch (se) {
            console.error('Failed to save screenshot', se);
        }
        server.close();
        process.exit(1);
    }
});
