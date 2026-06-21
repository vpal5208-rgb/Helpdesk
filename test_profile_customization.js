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

        // 1. Navigation & Admin Login
        console.log('Navigating to IT Helpdesk Admin Portal...');
        await page.goto('http://localhost:3005/index.html');
        await delay(1000);

        console.log('Signing in as Admin...');
        await page.evaluate(() => {
            document.getElementById('al-email').value = 'admin@helpdesk.com';
            document.getElementById('al-password').value = 'Admin@123';
            document.getElementById('al-submit').click();
        });
        await delay(1800);

        // 2. Go to Settings tab
        console.log('Navigating to Settings View...');
        await page.click('button[data-view="settings"]');
        await delay(1000);

        // Click Appearance tab inside Settings
        console.log('Opening Appearance settings tab...');
        await page.click('button[data-stab="appearance"]');
        await delay(800);

        // Verify Company Logo preview exists and contains default ⚡ emoji
        const initialLogoText = await page.evaluate(() => {
            return document.getElementById('company-logo-preview')?.innerText;
        });
        console.log('Initial company logo preview content:', initialLogoText);
        if (initialLogoText !== '⚡') {
            console.error('FAIL: Initial logo preview should be ⚡');
            hasError = true;
        }

        // 3. Inject a custom base64 Company Logo and apply
        console.log('Uploading/Injecting custom company logo...');
        const mockLogoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // 1x1 white pixel image
        await page.evaluate((base64) => {
            localStorage.setItem('hd_company_logo', base64);
            if (typeof applyCompanyLogo === 'function') applyCompanyLogo();
        }, mockLogoBase64);
        await delay(800);

        // Assert that the preview and sidebar icons have updated to images
        const logoElements = await page.evaluate(() => {
            const previewImg = document.querySelector('#company-logo-preview img')?.src;
            const sidebarImg = document.querySelector('#sidebar-brand-icon img')?.src;
            const loginImg = document.querySelector('#login-brand-icon img')?.src;
            return { previewImg, sidebarImg, loginImg };
        });
        console.log('Company Logo state in Admin view:', logoElements);
        if (!logoElements.previewImg || !logoElements.sidebarImg) {
            console.error('FAIL: Custom logo was not applied in the Admin portal.');
            hasError = true;
        }

        // 4. Navigate to User Portal and verify Company Logo
        console.log('Navigating to User Portal page...');
        await page.goto('http://localhost:3005/portal.html');
        await delay(1200);

        const portalInitialLogo = await page.evaluate(() => {
            const loginImg = document.querySelector('#portal-login-logo-icon img')?.src;
            return { loginImg };
        });
        console.log('Company Logo state on User Portal login:', portalInitialLogo);
        if (!portalInitialLogo.loginImg) {
            console.error('FAIL: Custom company logo did not carry over to User Portal login screen.');
            hasError = true;
        }

        // Log in to User Portal
        console.log('Logging in as James Wilson...');
        await page.evaluate(() => {
            localStorage.setItem('hd_portal_user', JSON.stringify({
                name: 'James Wilson',
                email: 'j.wilson@company.com',
                dept: 'Marketing'
            }));
        });
        await page.reload();
        await delay(1500);

        // Verify Nav Brand Logo
        const portalNavLogo = await page.evaluate(() => {
            return document.querySelector('#portal-nav-logo-icon img')?.src;
        });
        console.log('Company Logo state in User Portal Nav bar:', portalNavLogo);
        if (!portalNavLogo) {
            console.error('FAIL: Custom logo not loaded in User Portal navigation bar.');
            hasError = true;
        }

        // 5. Test Profile Modal & Profile Picture Upload
        console.log('Clicking top nav user badge to open Profile modal...');
        await page.click('#portal-user-badge');
        await delay(1000);

        const isProfileModalOpen = await page.evaluate(() => {
            return document.getElementById('profile-modal-overlay')?.style.display === 'flex';
        });
        console.log('Profile modal open:', isProfileModalOpen);
        if (!isProfileModalOpen) {
            console.error('FAIL: Profile modal overlay did not open.');
            hasError = true;
        }

        // Inject profile picture avatar base64 data
        console.log('Uploading/Injecting custom profile picture avatar...');
        const mockAvatarBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAEgQGAf6xacwAAAABJRU5ErkJggg=='; // 1x1 black pixel image
        await page.evaluate((base64) => {
            // Update session and global portalUser
            if (typeof portalUser !== 'undefined') {
                portalUser.avatar = base64;
            }
            localStorage.setItem('hd_portal_user', JSON.stringify(portalUser));

            // Update users DB
            const users = JSON.parse(localStorage.getItem('hd_users_v1') || '[]');
            const u = users.find(x => x.email.toLowerCase() === 'j.wilson@company.com');
            if (u) {
                u.avatar = base64;
                localStorage.setItem('hd_users_v1', JSON.stringify(users));
            }
            
            // Re-render UI
            if (typeof showPortal === 'function') showPortal();
            if (typeof openProfileModal === 'function') openProfileModal();
        }, mockAvatarBase64);
        await delay(1000);

        // Verify badge and modal photo renders as an image
        const avatarElements = await page.evaluate(() => {
            const badgeImg = document.querySelector('#portal-user-badge img')?.src;
            const modalImg = document.querySelector('#profile-picture-container img')?.src;
            return { badgeImg, modalImg };
        });
        console.log('Avatar image state on User Portal:', avatarElements);
        if (!avatarElements.badgeImg || !avatarElements.modalImg) {
            console.error('FAIL: Custom profile picture avatar was not applied to the UI.');
            hasError = true;
        }

        // Close modal
        console.log('Closing Profile modal...');
        await page.click('#profile-modal-cancel');
        await delay(500);

        // 6. Navigate back to Admin Dashboard Users list and verify Avatar
        console.log('Navigating back to Admin Portal...');
        await page.goto('http://localhost:3005/index.html');
        await delay(1200);

        // Re-authenticate Admin (since session storage was cleared or page was closed)
        console.log('Signing in as Admin again...');
        await page.evaluate(() => {
            document.getElementById('al-email').value = 'admin@helpdesk.com';
            document.getElementById('al-password').value = 'Admin@123';
            document.getElementById('al-submit').click();
        });
        await delay(1800);

        // Go to Users Tab
        console.log('Navigating to Users View...');
        await page.click('button[data-view="users"]');
        await delay(1000);

        // Verify avatar inside James Wilson's table row
        const tableAvatar = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#users-tbody tr'));
            const jamesRow = rows.find(r => r.innerText.includes('j.wilson@company.com'));
            if (!jamesRow) return null;
            const img = jamesRow.querySelector('.user-avatar-sm img');
            return img ? img.src : null;
        });
        console.log('James Wilson avatar src in Admin users list:', tableAvatar);
        if (!tableAvatar) {
            console.error('FAIL: Custom avatar was not rendered in the Admin user management list.');
            hasError = true;
        }

        if (!hasError) {
            console.log('SUCCESS: Company Logo and User Profile Picture customization verified successfully!');
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
