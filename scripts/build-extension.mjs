/**
 * scripts/build-extension.mjs
 *
 * extension/ ディレクトリの内容を以下の2箇所に出力する。
 *
 *   dist-ext/                         ← ビルド成果物（git管理外）
 *     ylistplayer-chrome.zip
 *     ylistplayer-firefox.xpi
 *
 *   public/extensions/                ← Vite 経由で配信（dev/preview/build 共通）
 *     ylistplayer-chrome.zip
 *     ylistplayer-firefox.xpi
 *
 * 依存: zip コマンド（Linux/macOS 標準搭載）
 */

import { execSync } from 'node:child_process';
import { mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, '..');
const srcDir    = resolve(root, 'extension');
const distDir   = resolve(root, 'dist-ext');
const publicDir = resolve(root, 'public', 'extensions');

// 出力ディレクトリを作成
mkdirSync(distDir,   { recursive: true });
mkdirSync(publicDir, { recursive: true });

if (!existsSync(srcDir)) {
    console.error('[build-extension] extension/ ディレクトリが見つかりません。');
    process.exit(1);
}

/**
 * extension/ の中身を zip で固めて指定パスに出力する。
 * @param {string} outPath  出力ファイルのフルパス
 */
function buildZip(outPath) {
    // 既存ファイルを削除（zip は追記モードになるため）
    try { execSync(`rm -f "${outPath}"`); } catch { /* ignore */ }

    execSync(`zip -r "${outPath}" .`, {
        cwd: srcDir,
        stdio: 'inherit',
    });

    console.log(`[build-extension] 生成: ${outPath}`);
}

// ─── Chrome 用 zip ────────────────────────────────────────────────────────────
const chromeZip        = resolve(distDir,   'ylistplayer-chrome.zip');
const chromeZipPublic  = resolve(publicDir, 'ylistplayer-chrome.zip');

buildZip(chromeZip);
copyFileSync(chromeZip, chromeZipPublic);
console.log(`[build-extension] コピー: ${chromeZipPublic}`);

// ─── Firefox 用 xpi（zip のコピー、拡張子だけ異なる）─────────────────────────
const firefoxXpi       = resolve(distDir,   'ylistplayer-firefox.xpi');
const firefoxXpiPublic = resolve(publicDir, 'ylistplayer-firefox.xpi');

copyFileSync(chromeZip, firefoxXpi);
console.log(`[build-extension] 生成: ${firefoxXpi}`);

copyFileSync(chromeZip, firefoxXpiPublic);
console.log(`[build-extension] コピー: ${firefoxXpiPublic}`);

console.log('[build-extension] 完了');
