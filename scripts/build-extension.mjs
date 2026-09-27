/**
 * scripts/build-extension.mjs
 *
 * extension/ ディレクトリの内容を以下の2箇所に出力する。
 *
 *   dist-ext/
 *     ylistplayer-chrome.zip   ← Chrome/Edge 用
 *     ylistplayer-firefox.xpi  ← Firefox 用（manifest を差し替え）
 *
 *   public/extensions/         ← Vite 経由で配信（dev/preview/build 共通）
 *     ylistplayer-chrome.zip
 *     ylistplayer-firefox.xpi
 *
 * Chrome と Firefox の manifest 差異:
 *   Chrome: background.service_worker + "type": "module"
 *   Firefox: background.scripts (配列) のみ。"type" キーを含めない。
 *
 * 依存: zip コマンド（Linux/macOS 標準搭載）
 */

import { execSync } from 'node:child_process';
import { mkdirSync, existsSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, '..');
const srcDir    = resolve(root, 'extension');
const distDir   = resolve(root, 'dist-ext');
const publicDir = resolve(root, 'public', 'extensions');

mkdirSync(distDir,   { recursive: true });
mkdirSync(publicDir, { recursive: true });

if (!existsSync(srcDir)) {
    console.error('[build-extension] extension/ ディレクトリが見つかりません。');
    process.exit(1);
}

// ─── manifest のブラウザ別バリアントを生成 ────────────────────────────────────

const baseManifest = JSON.parse(readFileSync(resolve(srcDir, 'manifest.json'), 'utf-8'));

/** Chrome 用 manifest: service_worker + type: module のみ（scripts を除去） */
function chromeManifest() {
    const m = structuredClone(baseManifest);
    // scripts フィールドは Chrome では無視されるが念のため除去
    const bg = { ...m.background };
    delete bg.scripts;
    m.background = bg;
    return m;
}

/** Firefox 用 manifest: scripts 配列のみ。service_worker と type を除去 */
function firefoxManifest() {
    const m = structuredClone(baseManifest);
    const bg = { ...m.background };
    delete bg.service_worker;
    delete bg.type;
    m.background = bg;
    return m;
}

// ─── zip ビルド関数 ───────────────────────────────────────────────────────────

/**
 * extension/ を zip 化して outPath に出力する。
 * manifestOverride が指定された場合は manifest.json を一時的に差し替える。
 *
 * @param {string} outPath
 * @param {object|null} manifestOverride
 */
function buildZip(outPath, manifestOverride = null) {
    const manifestPath = resolve(srcDir, 'manifest.json');
    let originalManifest = null;

    if (manifestOverride) {
        originalManifest = readFileSync(manifestPath, 'utf-8');
        writeFileSync(manifestPath, JSON.stringify(manifestOverride, null, 2), 'utf-8');
    }

    try {
        try { execSync(`rm -f "${outPath}"`); } catch { /* ignore */ }
        execSync(`zip -r "${outPath}" .`, { cwd: srcDir, stdio: 'inherit' });
        console.log(`[build-extension] 生成: ${outPath}`);
    } finally {
        // 必ず元の manifest に戻す
        if (originalManifest !== null) {
            writeFileSync(manifestPath, originalManifest, 'utf-8');
        }
    }
}

// ─── Chrome 用 zip ────────────────────────────────────────────────────────────

const chromeZip       = resolve(distDir,   'ylistplayer-chrome.zip');
const chromeZipPublic = resolve(publicDir, 'ylistplayer-chrome.zip');

buildZip(chromeZip, chromeManifest());
copyFileSync(chromeZip, chromeZipPublic);
console.log(`[build-extension] コピー: ${chromeZipPublic}`);

// ─── Firefox 用 xpi ───────────────────────────────────────────────────────────

const firefoxXpi       = resolve(distDir,   'ylistplayer-firefox.xpi');
const firefoxXpiPublic = resolve(publicDir, 'ylistplayer-firefox.xpi');

buildZip(firefoxXpi, firefoxManifest());
copyFileSync(firefoxXpi, firefoxXpiPublic);
console.log(`[build-extension] コピー: ${firefoxXpiPublic}`);

console.log('[build-extension] 完了');
