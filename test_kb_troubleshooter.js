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
        // PART 1: User Portal self-service wizard tests
        // =============================================
        console.log('\n--- PART 1: User Portal troubleshooter wizard E2E tests ---');
        await page.goto('http://localhost:3000/portal.html');
        await delay(1000);

        // Reset localStorage for clean state
        await page.evaluate(() => {
            localStorage.removeItem('hd_kb_articles_v1');
            sessionStorage.clear();
        });
        await page.reload();
        await delay(1000);

        console.log('Logging in as James Wilson...');
        await page.type('#login-email', 'j.wilson@company.com');
        await page.type('#login-password', 'User@123');
        await page.click('#login-btn');
        await delay(1500);

        console.log('Navigating to Troubleshooting tab...');
        await page.click('button[data-tab="kb"]');
        await delay(1000);

        // Click first article
        console.log('Selecting "Monitor Not Turning On or Flickering" article...');
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('.kb-art-btn'));
            const monitorBtn = btns.find(b => b.innerText.includes('Monitor'));
            if (monitorBtn) monitorBtn.click();
        });
        await delay(1000);

        // Verify wizard renders step 1
        const wizardStep1 = await page.evaluate(() => {
            const progress = document.querySelector('.wizard-progress')?.innerText || '';
            const stepText = document.querySelector('.wizard-step-text')?.innerText || '';
            return { progress, stepText };
        });
        console.log('Wizard renders step 1 progress:', wizardStep1.progress);
        console.log('Wizard step 1 text:', wizardStep1.stepText);
        if (!wizardStep1.progress.includes('Step 1') || !wizardStep1.stepText.includes('lit')) {
            console.error('FAIL: Wizard step 1 was not rendered correctly');
            hasError = true;
        }

        // Navigate forward
        console.log('Advancing to next step...');
        await page.evaluate(() => {
            const nextBtn = Array.from(document.querySelectorAll('.kb-wizard .portal-btn')).find(b => b.innerText.includes('Next'));
            if (nextBtn) nextBtn.click();
        });
        await delay(500);

        const wizardStep2 = await page.evaluate(() => {
            return document.querySelector('.wizard-progress')?.innerText || '';
        });
        console.log('Wizard renders step 2 progress:', wizardStep2);
        if (!wizardStep2.includes('Step 2')) {
            console.error('FAIL: Wizard did not advance to step 2');
            hasError = true;
        }

        // Run until last step (step 5)
        console.log('Advancing to the final step...');
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => {
                const nextBtn = Array.from(document.querySelectorAll('.kb-wizard .portal-btn')).find(b => b.innerText.includes('Next'));
                if (nextBtn) nextBtn.click();
            });
            await delay(500);
        }

        const wizardStepFinal = await page.evaluate(() => {
            const progress = document.querySelector('.wizard-progress')?.innerText || '';
            const unresolvedVisible = !!Array.from(document.querySelectorAll('.kb-wizard .portal-btn')).find(b => b.innerText.includes('Still not working'));
            return { progress, unresolvedVisible };
        });
        console.log('Wizard final step progress:', wizardStepFinal.progress);
        console.log('Wizard shows "Still not working" button:', wizardStepFinal.unresolvedVisible);
        if (!wizardStepFinal.progress.includes('Step 5') || !wizardStepFinal.unresolvedVisible) {
            console.error('FAIL: Final step did not show correctly');
            hasError = true;
        }

        // Click "Still not working"
        console.log('Clicking "Still not working" to trigger unresolved ticket prefill...');
        await page.evaluate(() => {
            const failBtn = Array.from(document.querySelectorAll('.kb-wizard .portal-btn')).find(b => b.innerText.includes('Still not working'));
            if (failBtn) failBtn.click();
        });
        await delay(500);

        // Click "Create Support Ticket"
        console.log('Clicking "Create Support Ticket"...');
        await page.evaluate(() => {
            const createBtn = Array.from(document.querySelectorAll('.kb-wizard .portal-btn')).find(b => b.innerText.includes('Create Support Ticket'));
            if (createBtn) createBtn.click();
        });
        await delay(1000);

        // Verify "New Ticket" tab is pre-filled
        const ticketPrefill = await page.evaluate(() => {
            const activeTab = document.getElementById('ptab-new-ticket').classList.contains('active');
            const subjectVal = document.getElementById('nt-subject').value;
            const categoryVal = document.getElementById('nt-category').value;
            const descVal = document.getElementById('nt-desc').value;
            return { activeTab, subjectVal, categoryVal, descVal };
        });
        console.log('Switched to New Ticket form:', ticketPrefill.activeTab);
        console.log('Pre-filled Subject:', ticketPrefill.subjectVal);
        console.log('Pre-filled Category:', ticketPrefill.categoryVal);
        console.log('Pre-filled Description length:', ticketPrefill.descVal.length);

        if (!ticketPrefill.activeTab || !ticketPrefill.subjectVal.includes('Monitor') || ticketPrefill.categoryVal !== 'Hardware' || !ticketPrefill.descVal.includes('TRIED & FAILED')) {
            console.error('FAIL: Ticket pre-fill from troubleshooting wizard was incorrect:', ticketPrefill);
            hasError = true;
        } else {
            console.log('SUCCESS: Interactive Troubleshooter Ticket Prefill E2E passed!');
        }

        // Sign out user
        await page.click('#portal-logout');
        await delay(1000);


        // =============================================
        // PART 2: Admin Dashboard KB management tests
        // =============================================
        console.log('\n--- PART 2: Admin Dashboard KB Management E2E tests ---');
        await page.goto('http://localhost:3000/index.html');
        await delay(1000);

        console.log('Signing in as Admin...');
        await page.evaluate(() => {
            document.getElementById('al-email').value = 'admin@helpdesk.com';
            document.getElementById('al-password').value = 'Admin@123';
            document.getElementById('al-submit').click();
        });
        await delay(1500);

        console.log('Navigating to Knowledge Base tab...');
        await page.click('button[data-view="kb"]');
        await delay(1000);

        // Add KB Article
        console.log('Clicking "+ Add KB Article"...');
        await page.click('#btn-add-kb');
        await delay(1000);

        console.log('Filling in new KB Article details...');
        await page.type('#kbm-title', 'E2E Testing Wireless Signal Outage');
        await page.select('#kbm-category', 'Network');
        await page.type('#kbm-desc', 'Diagnose weak wireless signals or connectivity drops.');
        await page.type('#kbm-steps', 'Step 1: Check access point lights.\nStep 2: Restart wireless adapter on laptop.\nStep 3: Move closer to the wireless router.');
        await page.click('#kb-modal-save');
        await delay(1000);

        // Verify added article
        const newKBRowText = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#kb-tbody tr'));
            const matched = rows.find(r => r.innerText.includes('E2E Testing'));
            return matched ? matched.innerText : '';
        });
        console.log('Added row text:', newKBRowText);
        if (!newKBRowText.includes('E2E Testing') || !newKBRowText.includes('Network') || !newKBRowText.includes('3 steps')) {
            console.error('FAIL: New article was not successfully created/saved or rendered');
            hasError = true;
        } else {
            console.log('SUCCESS: Admin Knowledge Base Article creation E2E passed!');
        }

        await browser.close();
        server.close();
        if (hasError) {
            console.error('\nKB & TROUBLESHOOTER E2E TESTS FAILED');
            process.exit(1);
        } else {
            console.log('\nKB & TROUBLESHOOTER E2E TESTS SUCCESSFUL!');
            process.exit(0);
        }
    } catch (e) {
        console.error('Script Error:', e);
        server.close();
        process.exit(1);
    }
});
