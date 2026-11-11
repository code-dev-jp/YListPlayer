/** Existing behavior audit. Start Vite, then run:
 * PLAYWRIGHT_MODULE=/tmp/ylist-interface-tools/node_modules/playwright/index.mjs node tests/playback-bdd.browser.mjs
 * APP_URL defaults to http://127.0.0.1:5176/YListPlayer/.
 * Exercises real React + IndexedDB. Only YouTube's external API is replaced;
 * playVideo calls do not prove real media autoplay or native iframe controls.
 */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const ids = ['jfKfPfyJRdk', '5qap5aO4i9A', 'dQw4w9WgXcQ'];
async function session(segments = []) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.addInitScript(() => {
        window.auditPlayers = [];
        window.YT = { PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 }, Player: class {
            constructor(el, config) {
                this.config = config; this.time = 0; this.seeks = []; this.plays = 0; this.pauses = 0;
                window.auditPlayers.push(this);
                setTimeout(() => { config.events.onReady({ target: this }); this.ready = true; }, 0);
            }
            getCurrentTime() { return this.time; } getDuration() { return 240; }
            seekTo(time) { this.seeks.push(time); this.time = time; }
            playVideo() { this.plays++; this.config.events.onStateChange({ data: 1 }); }
            pauseVideo() { this.pauses++; this.config.events.onStateChange({ data: 2 }); }
            destroy() { this.destroyed = true; }
        } };
    });
    await page.route(/youtube\.com|youtu\.be|ytimg\.com/, r => r.abort());
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:5176/YListPlayer/');
    await page.evaluate(async ({ ids, segments }) => {
        const { db } = await import('/YListPlayer/src/utils/db.ts');
        await db.playlists.add({ id: 1, name: 'BDD playback audit', createdAt: 1 });
        await db.videos.bulkAdd(ids.map((id, i) => ({ id: i + 1, playlistId: 1,
            youtubeUrl: `https://www.youtube.com/watch?v=${id}`, title: `Audit video ${i + 1}`,
            thumbnail: '', order: i, savedSegments: i === 0 ? segments : [] })));
    }, { ids, segments });
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'BDD playback audit', exact: true }).click();
    return { context, page };
}
async function selected(page, index) {
    await page.waitForFunction(id => {
        const p = window.auditPlayers.at(-1);
        return p?.ready && p.config.videoId === id && p.plays > 0;
    }, ids[index - 1]);
    assert.match(await page.locator('[aria-current="true"]').innerText(), new RegExp(`Audit video ${index}`));
}
async function end(page) { await page.evaluate(() => window.auditPlayers.at(-1).config.events.onStateChange({ data: 0 })); }
async function tick(page, time) {
    await page.evaluate(time => { window.auditPlayers.at(-1).time = time; }, time);
    await page.waitForFunction(time => Number(document.querySelector('input[type=range]').value) === time, time);
}
async function stored(page) { return page.evaluate(async () => { const { db } = await import('/YListPlayer/src/utils/db.ts'); return (await db.videos.get(1)).savedSegments; }); }
try {
    {
        const { context, page } = await session();
        await page.getByText('Audit video 1', { exact: true }).click();
        await selected(page, 1);
        assert.equal(await page.evaluate(() => window.auditPlayers[0].config.playerVars.autoplay), 1);
        console.log('PASS selection: requests autoplay through the YouTube API (real autoplay remains unverified)');
        await context.close();
    }
    {
        const { context, page } = await session();
        await page.getByRole('button', { name: 'すべて再生', exact: true }).click();
        await selected(page, 1); await end(page); await selected(page, 2); await end(page); await selected(page, 3);
        await end(page);
        // If automatic playback was not cleared at the last video, this new
        // ENDED event with loop enabled would incorrectly jump back to video 1.
        await page.getByRole('checkbox', { name: 'ループ', exact: true }).check();
        await end(page); await page.waitForTimeout(700);
        await selected(page, 3);
        assert.equal(await page.evaluate(() => window.auditPlayers.length), 3);
        console.log('PASS playlist: starts first, advances in order, stops automatic playback at the end');
        await context.close();
    }
    {
        const { context, page } = await session();
        await page.getByRole('button', { name: 'すべて再生', exact: true }).click(); await selected(page, 1);
        await page.getByText('Audit video 2', { exact: true }).click(); await selected(page, 2);
        await end(page); await page.waitForTimeout(700); await selected(page, 2);
        assert.equal(await page.evaluate(() => window.auditPlayers.length), 2);
        console.log('PASS manual selection: plays selected video and cancels automatic advance');
        await context.close();
    }
    {
        const { context, page } = await session();
        await page.getByRole('checkbox', { name: 'ループ', exact: true }).check();
        await page.getByRole('button', { name: 'すべて再生', exact: true }).click(); await selected(page, 1);
        await end(page); await selected(page, 2); await end(page); await selected(page, 3); await end(page); await selected(page, 1);
        assert.equal(await page.evaluate(() => window.auditPlayers.length), 4);
        console.log('PASS playlist loop: last video advances to first');
        await context.close();
    }
    {
        const { context, page } = await session([{ start: 10, end: 20 }, { start: 30, end: 40 }]);
        await page.getByText('Audit video 1', { exact: true }).click(); await selected(page, 1);
        await page.evaluate(() => { window.auditPlayers.at(-1).time = 20.2; });
        await page.waitForFunction(() => Number(document.querySelector('input[type=range]').value) === 30);
        // Observe the UI and API boundary, rather than copying resolveSegmentAction.
        assert.equal(await page.evaluate(() => window.auditPlayers.at(-1).time), 30);
        await page.waitForTimeout(700);
        await page.evaluate(() => { const p = window.auditPlayers.at(-1); p.config.events.onStateChange({ data: 2 }); p.time = 25; });
        await tick(page, 25); await page.waitForTimeout(650);
        assert.equal(Number(await page.getByRole('slider', { name: '再生位置' }).inputValue()), 25);
        await page.evaluate(() => { const p = window.auditPlayers.at(-1); p.config.events.onStateChange({ data: 1 }); p.time = 40; });
        await page.waitForFunction(() => window.auditPlayers.at(-1).pauses === 1);
        await page.waitForTimeout(1100);
        assert.equal(await page.evaluate(() => window.auditPlayers.at(-1).pauses), 1);
        console.log('PASS segments: skip gap, respect PAUSED events, pause once after final segment');
        await context.close();
    }
    {
        const { context, page } = await session([{ start: 10, end: 20 }, { start: 30, end: 40 }]);
        await page.getByText('Audit video 1', { exact: true }).click(); await selected(page, 1);
        await page.getByRole('checkbox', { name: '区間外で停止', exact: true }).uncheck();
        await tick(page, 12);
        await page.getByRole('button', { name: '区間1の開始位置を現在位置に合わせる', exact: true }).click();
        await page.waitForFunction(async () => { const { db } = await import('/YListPlayer/src/utils/db.ts'); return (await db.videos.get(1)).savedSegments[0].start === 12; });
        await tick(page, 18);
        await page.getByRole('button', { name: '区間1の終了位置を現在位置に合わせる', exact: true }).click();
        await page.waitForFunction(async () => { const { db } = await import('/YListPlayer/src/utils/db.ts'); return (await db.videos.get(1)).savedSegments[0].end === 18; });
        assert.deepEqual(await stored(page), [{ start: 12, end: 18 }, { start: 30, end: 40 }]);
        await tick(page, 60); await page.getByRole('button', { name: '開始点をセット', exact: true }).click();
        await tick(page, 65); await page.getByRole('button', { name: '終了点をセット', exact: true }).click();
        await tick(page, 61); await page.getByRole('button', { name: '新しい区間の開始位置を現在位置に合わせる', exact: true }).click();
        await tick(page, 66); await page.getByRole('button', { name: '新しい区間の終了位置を現在位置に合わせる', exact: true }).click();
        await page.getByRole('button', { name: '区間を保存', exact: true }).click();
        await page.waitForFunction(async () => { const { db } = await import('/YListPlayer/src/utils/db.ts'); return (await db.videos.get(1)).savedSegments.length === 3; });
        assert.deepEqual((await stored(page))[2], { start: 61, end: 66 });
        console.log('PASS snap: current position updates both saved and draft boundaries, persists correct times');
        await context.close();
    }
} finally { await browser.close(); }
