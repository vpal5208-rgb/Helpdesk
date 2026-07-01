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
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Auto accept confirms and alerts
        page.on('dialog', async dialog => {
            console.log('DIALOG:', dialog.message());
            await dialog.accept();
        });

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

        console.log('Loading IT Helpdesk admin dashboard...');
        await page.goto('http://localhost:3000/index.html');
        await delay(1500);

        // Sign in
        console.log('Signing in as Admin...');
        await page.evaluate(() => {
            document.getElementById('al-email').value = 'admin@helpdesk.com';
            document.getElementById('al-password').value = 'Admin@123';
            document.getElementById('al-submit').click();
        });
        await delay(1500);

        // ============================================
        // 1. Navigate to Software View
        // ============================================
        console.log('\n--- Test 1: Navigate to Software tab ---');
        await page.evaluate(() => {
            const btn = document.querySelector('.nav-item[data-view="software"]');
            if (btn) btn.click();
        });
        await delay(1500);

        let activeViewId = await page.evaluate(() => {
            const activeSec = document.querySelector('.view.active');
            return activeSec ? activeSec.id : '';
        });
        console.log('Active View:', activeViewId);
        if (activeViewId !== 'view-software') {
            console.error('FAIL: Did not navigate to Software Management view.');
            hasError = true;
        }

        // Verify initial counts (Microsoft 365, Adobe CC, Slack seed software)
        let totalSoftwareCount = await page.evaluate(() => {
            return document.getElementById('kpi-software-total').textContent.trim();
        });
        console.log('Total Software KPI count:', totalSoftwareCount);
        if (totalSoftwareCount !== '3') {
            console.error('FAIL: Initial software count does not match seed data (expected 3).');
            hasError = true;
        }

        // ============================================
        // 2. Add a new Software Application
        // ============================================
        console.log('\n--- Test 2: Add Software Application ---');
        await page.evaluate(() => {
            document.getElementById('btn-add-software').click();
        });
        await delay(500);

        // Fill modal fields
        await page.evaluate(() => {
            document.getElementById('sm-name').value = 'Adobe Photoshop CC';
            document.getElementById('sm-vendor').value = 'Adobe';
            document.getElementById('sm-version').value = 'v2026';
            document.getElementById('sm-category').value = 'Design';
            document.getElementById('sm-key').value = 'PHOTO-9923-KEY';
            document.getElementById('sm-quantity').value = '5';
            document.getElementById('sm-cost').value = '99.99';
            document.getElementById('sm-purchase-date').value = '2026-06-01';
            document.getElementById('software-modal-save').click();
        });
        await delay(1500);

        // Verify count is 4 now
        totalSoftwareCount = await page.evaluate(() => {
            return document.getElementById('kpi-software-total').textContent.trim();
        });
        console.log('Total Software count after addition:', totalSoftwareCount);
        if (totalSoftwareCount !== '4') {
            console.error('FAIL: Software application was not added (expected count 4).');
            hasError = true;
        }

        // ============================================
        // 3. Edit Software details and Enable AMC
        // ============================================
        console.log('\n--- Test 3: Edit Software & Enable AMC ---');
        
        // Find Edit button for the added software
        await page.evaluate(() => {
            // Find Photoshop row, then click Edit
            const rows = document.querySelectorAll('#software-tbody tr');
            for (let tr of rows) {
                if (tr.textContent.includes('Adobe Photoshop CC')) {
                    const editBtn = tr.querySelector('.btn-edit-software');
                    if (editBtn) editBtn.click();
                    break;
                }
            }
        });
        await delay(800);

        // Switch to AMC tab, enable AMC, fill in charges and start/end dates
        await page.evaluate(() => {
            // Click AMC tab
            const tabBtn = document.querySelector('#software-modal-tabs button[data-tab="smodal-amc"]');
            if (tabBtn) tabBtn.click();
        });
        await delay(300);

        await page.evaluate(() => {
            // Check checkbox
            const chk = document.getElementById('sm-amc-enabled');
            chk.checked = true;
            // trigger change event manually so UI listener fires
            chk.dispatchEvent(new Event('change'));

            document.getElementById('sm-amc-vendor').value = 'Adobe Reseller Ltd';
            document.getElementById('sm-amc-contract').value = 'AD-AMC-009';
            document.getElementById('sm-amc-start').value = '2026-06-01';
            document.getElementById('sm-amc-end').value = '2027-05-31'; // Future date => Active AMC
            document.getElementById('sm-amc-cost').value = '150';
            document.getElementById('sm-renewal-cost').value = '900';
            document.getElementById('software-modal-save').click();
        });
        await delay(1500);

        // Verify AMC status badge in table
        let amcStatusText = await page.evaluate(() => {
            const rows = document.querySelectorAll('#software-tbody tr');
            for (let tr of rows) {
                if (tr.textContent.includes('Adobe Photoshop CC')) {
                    return tr.querySelector('span.role-pill').textContent.trim();
                }
            }
            return '';
        });
        console.log('Software AMC Status Badge:', amcStatusText);
        if (amcStatusText !== 'Active') {
            console.error('FAIL: Software AMC status is not "Active".');
            hasError = true;
        }

        // ============================================
        // 4. Allocate Seat to User
        // ============================================
        console.log('\n--- Test 4: Allocate License Seat ---');
        await page.evaluate(() => {
            const rows = document.querySelectorAll('#software-tbody tr');
            for (let tr of rows) {
                if (tr.textContent.includes('Adobe Photoshop CC')) {
                    const btn = tr.querySelector('.btn-manage-allocs');
                    if (btn) btn.click();
                    break;
                }
            }
        });
        await delay(800);

        // Select user Emily Davis (should be in select) and Assign
        await page.evaluate(() => {
            const select = document.getElementById('alloc-user-select');
            // find option containing Emily Davis
            for (let opt of select.options) {
                if (opt.textContent.includes('Emily Davis')) {
                    select.value = opt.value;
                    break;
                }
            }
            document.getElementById('btn-alloc-save').click();
        });
        await delay(1500);

        // Verify seats allocation count in modal badge
        let seatsBadgeText = await page.evaluate(() => {
            return document.getElementById('alloc-seats-badge').textContent.trim();
        });
        console.log('Seats badge allocation:', seatsBadgeText);
        if (seatsBadgeText !== '1 / 5 Seats') {
            console.error('FAIL: Allocation count did not update to "1 / 5".');
            hasError = true;
        }

        // Verify allocated user row is rendered
        let hasAllocatedUser = await page.evaluate(() => {
            const tbody = document.getElementById('software-alloc-tbody');
            return tbody.textContent.includes('Emily Davis');
        });
        console.log('Is Emily Davis allocated in table?', hasAllocatedUser);
        if (!hasAllocatedUser) {
            console.error('FAIL: Allocated user Emily Davis not found in assignments table.');
            hasError = true;
        }

        // ============================================
        // 5. Revoke License Seat
        // ============================================
        console.log('\n--- Test 5: Revoke License Seat ---');
        await page.evaluate(() => {
            const rows = document.querySelectorAll('#software-alloc-tbody tr');
            for (let tr of rows) {
                if (tr.textContent.includes('Emily Davis')) {
                    const btn = tr.querySelector('.btn-revoke-license');
                    if (btn) btn.click();
                    break;
                }
            }
        });
        await delay(1500);

        // Verify allocation resets to 0 / 5
        seatsBadgeText = await page.evaluate(() => {
            return document.getElementById('alloc-seats-badge').textContent.trim();
        });
        console.log('Seats badge allocation after revoke:', seatsBadgeText);
        if (seatsBadgeText !== '0 / 5 Seats') {
            console.error('FAIL: Allocation count did not reset to "0 / 5".');
            hasError = true;
        }

        // Close allocations modal
        await page.evaluate(() => {
            document.getElementById('software-alloc-modal-close').click();
        });
        await delay(500);

        // ============================================
        // 6. Delete Software Application
        // ============================================
        console.log('\n--- Test 6: Delete Software Application ---');
        await page.evaluate(() => {
            const rows = document.querySelectorAll('#software-tbody tr');
            for (let tr of rows) {
                if (tr.textContent.includes('Adobe Photoshop CC')) {
                    const btn = tr.querySelector('.btn-delete-software');
                    if (btn) btn.click();
                    break;
                }
            }
        });
        await delay(1500);

        // Verify count goes back to 3
        totalSoftwareCount = await page.evaluate(() => {
            return document.getElementById('kpi-software-total').textContent.trim();
        });
        console.log('Total Software count after deletion:', totalSoftwareCount);
        if (totalSoftwareCount !== '3') {
            console.error('FAIL: Software application was not deleted (expected count 3).');
            hasError = true;
        }

        await browser.close();
        server.close();

        if (hasError) {
            console.error('\nSOFTWARE MANAGEMENT TESTS FAILED');
            process.exit(1);
        } else {
            console.log('\nSOFTWARE MANAGEMENT TESTS SUCCESSFUL!');
            process.exit(0);
        }
    } catch (e) {
        console.error('Script Error:', e);
        server.close();
        process.exit(1);
    }
});
