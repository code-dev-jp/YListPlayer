// Run against Vite: PLAYWRIGHT_MODULE=/tmp/ylist-interface-tools/node_modules/playwright/index.mjs node tests/mobile-sticky.browser.mjs
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
try {
    for (const [width, height] of [[320, 844], [390, 844], [899, 844], [900, 844], [390, 390]]) {
        const context = await browser.newContext({ viewport: { width, height } });
        const page = await context.newPage();
        await page.addInitScript(() => {
            window.YT = { PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 }, Player: class {
                constructor(el, config) { setTimeout(() => config.events.onReady({ target: this }), 0); }
                getCurrentTime() { return 0; } getDuration() { return 240; }
                seekTo() {} playVideo() {} pauseVideo() {} destroy() {}
            } };
        });
        await page.route(/youtube\.com|youtu\.be|ytimg\.com/, r => r.abort());
        await page.goto(process.env.APP_URL || 'http://127.0.0.1:5174/YListPlayer/');
        await page.evaluate(async () => {
            const { db } = await import('/YListPlayer/src/utils/db.ts');
            await db.playlists.add({ id: 1, name: 'Sticky test', createdAt: 1 });
            await db.videos.bulkAdd(Array.from({ length: 30 }, (_, i) => ({
                id: i + 1, playlistId: 1, youtubeUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
                title: `Sticky video ${i + 1}`, thumbnail: '', order: i, savedSegments: [],
            })));
        });
        await page.getByRole('combobox').click();
        await page.getByRole('option', { name: 'Sticky test', exact: true }).click();
        await page.getByText('Sticky video 1', { exact: true }).click();
        const frame = page.getByRole('region', { name: '動画プレイヤー', exact: true });
        await frame.waitFor();
        if (width < 900) {
            await page.evaluate(() => window.scrollTo(0, 500));
            await page.waitForTimeout(100);
            assert.ok(await page.evaluate(() => window.scrollY > 100), 'page must scroll');
            assert.ok(Math.abs((await frame.boundingBox()).y) <= 1, `${width}px: video must stay at viewport top`);
            await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
            await page.waitForTimeout(100);
            assert.ok(Math.abs((await frame.boundingBox()).y) <= 1, `${width}px: video must remain at top at playlist end`);
            assert.equal(await page.getByText('Sticky video 30', { exact: true }).isVisible(), true);
            const covered = await frame.evaluate(el => {
                const r = el.getBoundingClientRect();
                return !el.contains(document.elementFromPoint(r.x + r.width / 2, 10));
            });
            assert.equal(covered, false, 'scrolling content must not cover video');
            await page.evaluate(() => window.scrollTo(0, 0));
            const grip = page.getByRole('separator', { name: '動画の高さを変更', exact: true });
            await grip.focus();
            await grip.press('End');
            await page.getByRole('button', { name: '動画の高さを自動に戻す', exact: true }).click({ timeout: 3000 });
            await page.evaluate(() => window.scrollTo(0, 0));
            const initialHeight = (await frame.boundingBox()).height;
            await page.getByRole('button', { name: '動画を高くする', exact: true }).click();
            if (height === 390) assert.equal((await frame.boundingBox()).height, 200, 'short screen must retain room for controls');
            else assert.ok((await frame.boundingBox()).height > initialHeight);
            await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
            await page.waitForTimeout(100);
            assert.ok(Math.abs((await frame.boundingBox()).y) <= 1, 'resized video must remain sticky');
        } else {
            assert.notEqual(await frame.evaluate(el => getComputedStyle(el).position), 'sticky');
            assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight), false);
        }
        console.log(`PASS ${width}x${height}px: sticky video layout`);
        await context.close();
    }
} finally { await browser.close(); }
