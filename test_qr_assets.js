const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname)));

const delay = ms => new Promise(res => setTimeout(res, ms));

const server = app.listen(3005, async () => {
    console.log('Test Server running on port 3005');
    let hasError = false;
    let browser;
    let page;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        page.on('console', msg => {
            const text = msg.text();
            if (msg.type() === 'error') {
                console.error('PAGE CONSOLE ERROR:', text);
                if (!text.includes('favicon.ico') && !text.includes('Failed to load resource') && !text.includes('NotAllowedError') && !text.includes('Permission denied')) {
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

        // 1. Navigation & Login
        console.log('Navigating to IT Helpdesk Admin Portal...');
        await page.goto('http://localhost:3005/index.html');
        await delay(1500);

        console.log('Signing in as Admin...');
        await page.evaluate(() => {
            document.getElementById('al-email').value = 'admin@helpdesk.com';
            document.getElementById('al-password').value = 'Admin@123';
            document.getElementById('al-submit').click();
        });
        await delay(2000);

        // 2. Go to Assets Tab
        console.log('Navigating to Assets Tab...');
        await page.click('button[data-view="assets"]');
        await delay(1000);

        // Verify "Scan QR Code" button is present
        const scanBtnText = await page.evaluate(() => {
            const btn = document.getElementById('btn-scan-asset');
            return btn ? btn.innerText.trim() : null;
        });
        console.log('Scan Button visible text:', scanBtnText);
        if (!scanBtnText || !scanBtnText.includes('Scan QR Code')) {
            console.error('FAIL: "Scan QR Code" button was not found in Assets header.');
            hasError = true;
        } else {
            console.log('SUCCESS: "Scan QR Code" button verified in header!');
        }

        // 3. Edit Asset and verify QR & Label Tab
        console.log('Opening AST-0021 edit modal...');
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
            const laptopRow = rows.find(r => r.innerText.includes('AST-0021'));
            if (laptopRow) {
                const editBtn = laptopRow.querySelector('button[title="Edit Asset"]');
                if (editBtn) editBtn.click();
            }
        });
        await delay(1000);

        // Verify QR tab button is visible
        const qrTabBtnVisible = await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('#asset-modal-tabs button'));
            const qrTab = tabs.find(t => t.dataset.tab === 'qr');
            return qrTab ? qrTab.style.display !== 'none' : false;
        });
        console.log('QR Code & Label tab button visible:', qrTabBtnVisible);
        if (!qrTabBtnVisible) {
            console.error('FAIL: QR & Label tab button is missing or hidden.');
            hasError = true;
        }

        // Click QR tab
        console.log('Clicking QR & Label tab...');
        await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('#asset-modal-tabs button'));
            const qrTab = tabs.find(t => t.dataset.tab === 'qr');
            if (qrTab) qrTab.click();
        });
        await delay(800);

        // Verify QR tab content renders
        const qrContentVisible = await page.evaluate(() => {
            const pane = document.getElementById('asset-modal-tab-qr-content');
            return pane ? pane.style.display === 'block' : false;
        });
        console.log('QR Code & Label pane content visible:', qrContentVisible);
        if (!qrContentVisible) {
            console.error('FAIL: QR & Label tab content did not display.');
            hasError = true;
        }

        // Verify dynamic QR code renders
        const qrCodeGenerated = await page.evaluate(() => {
            const container = document.getElementById('assetm-qr-container');
            return container ? container.querySelectorAll('canvas, img').length > 0 : false;
        });
        console.log('QR Code generated inside container:', qrCodeGenerated);
        if (!qrCodeGenerated) {
            console.error('FAIL: QR code element was not generated inside the canvas container.');
            hasError = true;
        }

        // 4. Test label customization bindings
        console.log('Modifying label header settings...');
        await page.type('#label-opt-header', ' - TESTED CORP');
        await delay(500);

        const updatedHeaderText = await page.evaluate(() => {
            return document.getElementById('preview-label-header').innerText;
        });
        console.log('Sticker live preview header text:', updatedHeaderText);
        if (!updatedHeaderText.includes('TESTED CORP')) {
            console.error('FAIL: Dynamic header preview bindings are broken.');
            hasError = true;
        }

        // Close Asset edit modal
        await page.click('#asset-modal-close');
        await delay(500);

        // 5. Test Scan QR Scanner Modal Dialog
        console.log('Clicking Scan QR Code button...');
        await page.click('#btn-scan-asset');
        await delay(800);

        // Verify scanner overlay display
        const scannerOverlayVisible = await page.evaluate(() => {
            const overlay = document.getElementById('asset-scanner-modal-overlay');
            return overlay ? overlay.style.display === 'flex' : false;
        });
        console.log('Scanner Modal overlay visible:', scannerOverlayVisible);
        if (!scannerOverlayVisible) {
            console.error('FAIL: Scanner Modal did not open.');
            hasError = true;
        }

        // Switch to File Upload tab
        console.log('Switching to Upload Sticker tab...');
        await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('#scanner-mode-tabs button'));
            const fileTab = tabs.find(t => t.dataset.mode === 'file');
            if (fileTab) fileTab.click();
        });
        await delay(500);

        const filePaneVisible = await page.evaluate(() => {
            return document.getElementById('scanner-file-pane').style.display === 'flex' &&
                   document.getElementById('scanner-camera-pane').style.display === 'none';
        });
        console.log('File upload pane visible / camera pane hidden:', filePaneVisible);
        if (!filePaneVisible) {
            console.error('FAIL: Scanner mode tab toggle failed.');
            hasError = true;
        }

        // Close Scanner modal
        console.log('Closing Scanner Modal...');
        await page.click('#asset-scanner-modal-close');
        await delay(500);

        const scannerClosed = await page.evaluate(() => {
            return document.getElementById('asset-scanner-modal-overlay').style.display === 'none';
        });
        console.log('Scanner Modal closed successfully:', scannerClosed);
        if (!scannerClosed) {
            console.error('FAIL: Scanner Modal did not close correctly.');
            hasError = true;
        }

        // 6. Test Custom Label Designer Modal
        console.log('Testing Custom Label Designer Modal...');
        await page.click('#btn-custom-label');
        await delay(1000);

        const customModalVisible = await page.evaluate(() => {
            const overlay = document.getElementById('custom-label-modal-overlay');
            return overlay && overlay.style.display === 'flex';
        });
        console.log('Custom Label modal visible:', customModalVisible);
        if (!customModalVisible) {
            console.error('FAIL: Custom Label modal did not open.');
            hasError = true;
        }

        const customQrGenerated = await page.evaluate(() => {
            const container = document.getElementById('customm-qr-container');
            return container && container.querySelectorAll('canvas, img').length > 0;
        });
        console.log('QR code generated in Custom modal:', customQrGenerated);
        if (!customQrGenerated) {
            console.error('FAIL: QR code element not generated in custom modal.');
            hasError = true;
        }

        console.log('Modifying custom label header...');
        await page.type('#cust-label-header', ' - TEMP DESIGN');
        await delay(500);

        const customPreviewHeader = await page.evaluate(() => {
            return document.getElementById('cust-preview-label-header').innerText;
        });
        console.log('Custom Label live preview header text:', customPreviewHeader);
        if (!customPreviewHeader.includes('TEMP DESIGN')) {
            console.error('FAIL: Custom Label live preview header bindings are broken.');
            hasError = true;
        }

        console.log('Closing Custom Label modal...');
        await page.click('#custom-label-modal-close');
        await delay(500);

        const customModalClosed = await page.evaluate(() => {
            return document.getElementById('custom-label-modal-overlay').style.display === 'none';
        });
        console.log('Custom Label modal closed successfully:', customModalClosed);
        if (!customModalClosed) {
            console.error('FAIL: Custom Label modal did not close correctly.');
            hasError = true;
        }

        // 7. Test Bulk Label Printing Selection in Grid
        console.log('Testing Bulk Label Printing Grid selection...');
        const bulkBtnInitialVisible = await page.evaluate(() => {
            const btn = document.getElementById('btn-bulk-print-labels');
            return btn && btn.style.display !== 'none';
        });
        console.log('Bulk Print button initially visible:', bulkBtnInitialVisible);
        if (bulkBtnInitialVisible) {
            console.error('FAIL: Bulk Print button should be hidden initially.');
            hasError = true;
        }

        console.log('Checking "Select All" checkbox...');
        await page.click('#chk-select-all-assets');
        await delay(500);

        const allChecked = await page.evaluate(() => {
            const checkboxes = Array.from(document.querySelectorAll('.asset-row-chk'));
            return checkboxes.length > 0 && checkboxes.every(c => c.checked);
        });
        console.log('All row checkboxes checked after Select-All clicked:', allChecked);
        if (!allChecked) {
            console.error('FAIL: Select All checkbox did not check all rows.');
            hasError = true;
        }

        const bulkBtnCount = await page.evaluate(() => {
            const btn = document.getElementById('btn-bulk-print-labels');
            const countText = document.getElementById('bulk-print-count')?.innerText || '';
            const visible = btn && btn.style.display !== 'none';
            return { visible, countText };
        });
        console.log('Bulk Print button visible:', bulkBtnCount.visible, 'with count:', bulkBtnCount.countText);
        if (!bulkBtnCount.visible || parseInt(bulkBtnCount.countText) === 0) {
            console.error('FAIL: Bulk print button count is not updated correctly.');
            hasError = true;
        }

        console.log('Unchecking "Select All" checkbox...');
        await page.click('#chk-select-all-assets');
        await delay(500);

        const allUnchecked = await page.evaluate(() => {
            const checkboxes = Array.from(document.querySelectorAll('.asset-row-chk'));
            return checkboxes.length > 0 && checkboxes.every(c => !c.checked);
        });
        console.log('All row checkboxes unchecked after Select-All clicked again:', allUnchecked);
        if (!allUnchecked) {
            console.error('FAIL: Select All checkbox did not uncheck all rows.');
            hasError = true;
        }

        const bulkBtnHidden = await page.evaluate(() => {
            const btn = document.getElementById('btn-bulk-print-labels');
            return btn && btn.style.display === 'none';
        });
        console.log('Bulk Print button hidden after unchecking all:', bulkBtnHidden);
        if (!bulkBtnHidden) {
            console.error('FAIL: Bulk print button was not hidden when no rows are selected.');
            hasError = true;
        }

    } catch (e) {
        console.error('TEST ERROR EXCEPTION:', e);
        hasError = true;
    } finally {
        if (browser) await browser.close();
        server.close(() => {
            console.log('Test Server stopped.');
            process.exit(hasError ? 1 : 0);
        });
    }
});
