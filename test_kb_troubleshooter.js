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
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
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

        // 1. Navigation and session injection
        console.log('Navigating to IT Helpdesk Portal...');
        await page.goto('http://localhost:3005/portal.html');
        await delay(1000);

        console.log('Injecting session for active user James Wilson...');
        await page.evaluate(() => {
            localStorage.clear();
            localStorage.setItem('hd_portal_user', JSON.stringify({
                name: 'James Wilson',
                email: 'j.wilson@company.com',
                dept: 'Marketing'
            }));
        });

        console.log('Reloading portal page to log in...');
        await page.reload();
        await delay(1500);

        // Verify loaded portal page
        const isPortalScreenActive = await page.evaluate(() => {
            return document.getElementById('portal-screen').classList.contains('active');
        });
        console.log('User portal screen active:', isPortalScreenActive);
        if (!isPortalScreenActive) {
            console.error('FAIL: User portal screen did not activate.');
            hasError = true;
        }

        // 2. Click "Password / Account" FAQ card on Dashboard
        console.log('Clicking "Password / Account" FAQ card...');
        await page.evaluate(() => {
            // Find the FAQ card for Password / Account
            const cards = Array.from(document.querySelectorAll('.faq-card'));
            const pwdCard = cards.find(card => card.innerText.includes('Password / Account'));
            if (pwdCard) {
                pwdCard.click();
            } else {
                console.error('Password / Account FAQ card not found');
            }
        });
        await delay(1200);

        // Verify active tab and loaded KB article
        const kbState = await page.evaluate(() => {
            const isKbTabActive = document.getElementById('ptab-kb').classList.contains('active');
            const articleTitleEl = document.querySelector('#kb-article-view h2');
            const titleText = articleTitleEl ? articleTitleEl.innerText : '';
            const wizardProgressEl = document.querySelector('.wizard-progress');
            const wizardText = wizardProgressEl ? wizardProgressEl.innerText : '';
            return { isKbTabActive, titleText, wizardText };
        });
        console.log('KB Tab State after FAQ card click:', kbState);
        if (!kbState.isKbTabActive) {
            console.error('FAIL: FAQ card click did not switch to KB tab.');
            hasError = true;
        }
        if (!kbState.titleText.toLowerCase().includes('password')) {
            console.error('FAIL: KB article title does not match Password Reset guide.');
            hasError = true;
        }
        if (!kbState.wizardText.includes('Step 1')) {
            console.error('FAIL: Troubleshooter Wizard did not load on Step 1.');
            hasError = true;
        }

        // 3. Test Search Filtering in KB sidebar
        console.log('Testing KB Sidebar search for "VPN"...');
        await page.type('#kb-portal-search', 'VPN');
        await delay(800);

        const filteredList = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('#kb-article-list .kb-art-btn'));
            return buttons.map(b => b.innerText.trim());
        });
        console.log('Filtered articles list:', filteredList);
        if (filteredList.length !== 1 || !filteredList[0].toLowerCase().includes('vpn')) {
            console.error('FAIL: KB sidebar search did not filter articles correctly.');
            hasError = true;
        }

        // Clear search
        console.log('Clearing search...');
        await page.evaluate(() => {
            document.getElementById('kb-portal-search').value = '';
            // Trigger input event to re-render
            const event = new Event('input', { bubbles: true });
            document.getElementById('kb-portal-search').dispatchEvent(event);
        });
        await delay(800);

        // 4. Test Troubleshooter Wizard flow to ticket creation
        // Re-select Password guide first
        console.log('Selecting Password Reset guide...');
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('#kb-article-list .kb-art-btn'));
            const pwdBtn = buttons.find(b => b.innerText.includes('Password Reset'));
            if (pwdBtn) pwdBtn.click();
        });
        await delay(800);

        // Step through the 5 steps of Password guide (KB-0005 has 5 steps)
        console.log('Stepping through wizard...');
        for (let i = 1; i <= 4; i++) {
            console.log(`Clicking Next Step (Step ${i})...`);
            await page.evaluate(() => {
                const nextBtn = Array.from(document.querySelectorAll('.wizard-actions button')).find(b => b.innerText.includes('Next Step'));
                if (nextBtn) nextBtn.click();
            });
            await delay(500);
        }

        // Verify last step has "Still not working" button
        const lastStepState = await page.evaluate(() => {
            const actions = Array.from(document.querySelectorAll('.wizard-actions button')).map(b => b.innerText.trim());
            return actions;
        });
        console.log('Actions on last step:', lastStepState);
        if (!lastStepState.some(a => a.includes('Still not working'))) {
            console.error('FAIL: Last step should contain a "Still not working" option.');
            hasError = true;
        }

        // Click "... Still not working"
        console.log('Clicking "Still not working"...');
        await page.evaluate(() => {
            const failBtn = Array.from(document.querySelectorAll('.wizard-actions button')).find(b => b.innerText.includes('Still not working'));
            if (failBtn) failBtn.click();
        });
        await delay(800);

        // Click "Create Support Ticket" button on the unresolved screen
        console.log('Clicking "Create Support Ticket" button...');
        await page.evaluate(() => {
            const ticketBtn = Array.from(document.querySelectorAll('#kb-wizard-container button')).find(b => b.innerText.includes('Create Support Ticket'));
            if (ticketBtn) {
                ticketBtn.click();
            } else {
                console.error('Create Support Ticket button not found');
            }
        });
        await delay(1200);

        // Verify redirect to New Ticket form and pre-populated values
        const ticketState = await page.evaluate(() => {
            const isNewTicketTabActive = document.getElementById('ptab-new-ticket').classList.contains('active');
            const subject = document.getElementById('nt-subject').value;
            const category = document.getElementById('nt-category').value;
            const desc = document.getElementById('nt-desc').value;
            return { isNewTicketTabActive, subject, category, desc };
        });
        console.log('Support Ticket Tab pre-fill State:', ticketState);

        if (!ticketState.isNewTicketTabActive) {
            console.error('FAIL: Unresolved troubleshooting did not redirect to New Ticket form.');
            hasError = true;
        }
        if (!ticketState.subject.includes('[Account Troubleshooter]')) {
            console.error('FAIL: Support ticket subject prefix is not [Account Troubleshooter].');
            hasError = true;
        }
        if (ticketState.category !== 'Account') {
            console.error('FAIL: Support ticket category was not pre-populated as Account.');
            hasError = true;
        }
        if (!ticketState.desc.includes('Step 1') || !ticketState.desc.includes('[TRIED & FAILED]')) {
            console.error('FAIL: Support ticket description does not contain troubleshooting diagnostics audit trail.');
            hasError = true;
        }

        if (!hasError) {
            console.log('SUCCESS: Self-Service Troubleshooting and Search tests verified successfully!');
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
