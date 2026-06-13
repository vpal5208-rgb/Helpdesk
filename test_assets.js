const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname)));

const delay = ms => new Promise(res => setTimeout(res, ms));

const server = app.listen(3000, async () => {
    console.log('Server running on port 3000');
    let hasError = false;
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
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

        // Edit AST-0025 (iPad Pro) and check out to Emily Davis
        console.log('Checking out iPad Pro (AST-0025) to Emily Davis...');
        await page.evaluate(() => {
            // Find row for AST-0025
            const rows = Array.from(document.querySelectorAll('#assets-tbody tr'));
            const ipadRow = rows.find(r => r.innerText.includes('AST-0025'));
            if (ipadRow) {
                const editBtn = ipadRow.querySelector('button[title="Edit / Assign"]');
                if (editBtn) editBtn.click();
            }
        });
        await delay(1000);

        // Fill modal and checkout
        await page.evaluate(() => {
            document.getElementById('assetm-assignee').value = 'Emily Davis|e.davis@company.com';
            document.getElementById('asset-modal-save').click();
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
        server.close();
        process.exit(1);
    }
});
