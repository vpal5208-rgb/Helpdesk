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

        // Register dialog listener to handle prompt/confirm automatically
        page.on('dialog', async dialog => {
            const type = dialog.type();
            const message = dialog.message();
            console.log(`DIALOG OPENED: [${type}] "${message}"`);
            if (type === 'confirm') {
                await dialog.accept();
            } else if (type === 'prompt') {
                await dialog.accept('Bulk check-in verified by automated test');
            }
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

        // 3. Verify Bulk action buttons are hidden initially
        const initialVisibility = await page.evaluate(() => {
            const btnCheckin = document.getElementById('btn-bulk-checkin');
            const btnCheckout = document.getElementById('btn-bulk-checkout');
            return {
                checkin: btnCheckin ? btnCheckin.style.display !== 'none' : false,
                checkout: btnCheckout ? btnCheckout.style.display !== 'none' : false
            };
        });
        console.log('Initial Bulk buttons visibility:', initialVisibility);
        if (initialVisibility.checkin || initialVisibility.checkout) {
            console.error('FAIL: Bulk buttons should be hidden initially.');
            hasError = true;
        }

        // 4. Select all assets via check-all checkbox
        console.log('Checking select-all checkbox...');
        await page.click('#chk-select-all-assets');
        await delay(800);

        // 5. Verify both bulk action buttons are now visible because selection has both Deployed & Ready to Deploy assets
        const selectedVisibility = await page.evaluate(() => {
            const btnCheckin = document.getElementById('btn-bulk-checkin');
            const btnCheckout = document.getElementById('btn-bulk-checkout');
            const countCheckin = document.getElementById('bulk-checkin-count')?.innerText || '0';
            const countCheckout = document.getElementById('bulk-checkout-count')?.innerText || '0';
            return {
                checkin: btnCheckin ? btnCheckin.style.display !== 'none' : false,
                checkout: btnCheckout ? btnCheckout.style.display !== 'none' : false,
                countCheckin,
                countCheckout
            };
        });
        console.log('Staged selection buttons visibility:', selectedVisibility);
        if (!selectedVisibility.checkin || !selectedVisibility.checkout) {
            console.error('FAIL: Both bulk action buttons should be visible for mixed selection.');
            hasError = true;
        }

        // 6. Test Bulk Check-out Modal opening
        console.log('Opening Bulk Check-out Modal...');
        await page.click('#btn-bulk-checkout');
        await delay(800);

        const checkoutModalVisible = await page.evaluate(() => {
            const overlay = document.getElementById('bulk-checkout-modal-overlay');
            return overlay ? overlay.style.display === 'flex' : false;
        });
        console.log('Bulk Checkout Modal visible:', checkoutModalVisible);
        if (!checkoutModalVisible) {
            console.error('FAIL: Bulk checkout modal overlay did not open.');
            hasError = true;
        }

        // Fill out checkout details
        console.log('Submitting bulk checkout form...');
        await page.evaluate(() => {
            const select = document.getElementById('bulk-checkout-assignee');
            const option = Array.from(select.options).find(opt => opt.text.includes('James Wilson') || (opt.value && opt.value !== ''));
            if (option) {
                select.value = option.value;
            }
            document.getElementById('bulk-checkout-comments').value = 'Automated E2E Bulk Checkout';
            document.getElementById('bulk-checkout-modal-submit').click();
        });
        await delay(1200);

        // Verify modal closed and selection cleared
        const checkoutModalClosed = await page.evaluate(() => {
            const overlay = document.getElementById('bulk-checkout-modal-overlay');
            const checkboxes = Array.from(document.querySelectorAll('.asset-row-chk'));
            return {
                closed: overlay ? overlay.style.display === 'none' : true,
                checkedCount: checkboxes.filter(c => c.checked).length
            };
        });
        console.log('Bulk checkout closed/cleared state:', checkoutModalClosed);
        if (!checkoutModalClosed.closed || checkoutModalClosed.checkedCount > 0) {
            console.error('FAIL: Bulk checkout did not close or reset selection.');
            hasError = true;
        }

        // 7. Test Bulk Check-in of Deployed assets
        console.log('Selecting all assets again to test Bulk Check-In...');
        await page.click('#chk-select-all-assets');
        await delay(800);

        const checkinCount = await page.evaluate(() => {
            return document.getElementById('bulk-checkin-count')?.innerText || '0';
        });
        console.log('Staged bulk check-in count:', checkinCount);
        if (parseInt(checkinCount) === 0) {
            console.error('FAIL: No assets are available for bulk check-in.');
            hasError = true;
        }

        console.log('Triggering bulk check-in...');
        await page.click('#btn-bulk-checkin');
        await delay(1500);

        // Verify selection cleared and assets checked in
        const finalCheckinState = await page.evaluate(() => {
            const checkboxes = Array.from(document.querySelectorAll('.asset-row-chk'));
            const btnCheckin = document.getElementById('btn-bulk-checkin');
            return {
                checkedCount: checkboxes.filter(c => c.checked).length,
                checkinBtnVisible: btnCheckin ? btnCheckin.style.display !== 'none' : false
            };
        });
        console.log('Post check-in selection count:', finalCheckinState.checkedCount, 'Check-in button visible:', finalCheckinState.checkinBtnVisible);
        if (finalCheckinState.checkedCount > 0 || finalCheckinState.checkinBtnVisible) {
            console.error('FAIL: Bulk check-in did not clear selection or hide the button.');
            hasError = true;
        } else {
            console.log('SUCCESS: Bulk Check-In verified successfully!');
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
