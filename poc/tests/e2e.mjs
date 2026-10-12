// ds-sense 產出 — Clue POC 端到端驗證（puppeteer-core ＋ 本機 Chrome）
// 用法：先 `npm start`（或 PORT=5174 npm start），再執行
//   NODE_PATH=<含 puppeteer-core 的 node_modules> node tests/e2e.mjs [baseUrl]
// 產出：docs/screenshots/*.png 與終端機上的檢查結果。只連到本機伺服器。
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const BASE = process.argv[2] || 'http://127.0.0.1:5174/';
const SHOTS = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = await browser.newPage();
const consoleErrors = [];
const externalRequests = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));
page.on('request', (r) => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) externalRequests.push(r.url()); });

const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await sleep(700); await page.waitForFunction(() => !document.querySelector('#view .loading'), { timeout: 5000 }).catch(() => {}); await sleep(150); };
const shot = async (name) => { await page.evaluate(() => window.scrollTo(0, 0)); await sleep(100); await page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true }); };
const text = (sel) => page.$eval(sel, (el) => el.textContent.trim()).catch(() => null);
const overflowX = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

// ───────── Desktop 1440 ─────────
await page.setViewport({ width: 1440, height: 900 });
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await sleep(600);
await shot('01-workbench-desktop');

// 主 CTA 顏色＝Clue 紫，非 Wonder 藍
const hs = await page.$eval('.hero', (el) => ({ bg: getComputedStyle(el).backgroundColor, img: getComputedStyle(el).backgroundImage, fg: getComputedStyle(el.querySelector('.hero__title')).color }));
const plusBg = await page.$eval('.hero__plus', (el) => getComputedStyle(el).backgroundColor);
const ctaFg = await page.$eval('.hero__cta', (el) => getComputedStyle(el).color);
check('Hero 白底黑字（無漸層）', hs.bg === 'rgb(255, 255, 255)' && hs.img === 'none' && hs.fg === 'rgb(40, 41, 45)', JSON.stringify(hs));
check('CTA 圓形「+」與標籤使用 Clue 紫 theme token', plusBg === 'rgb(132, 75, 153)' && ctaFg === 'rgb(132, 75, 153)', `${plusBg} / ${ctaFg}`);
check('Hero 標題、副標、CTA 文字', (await text('.hero__title')) === 'Every Conversation Holds a Clue' && (await text('.hero__sub')) === 'Clue 社群口碑分析系統 - 建立新的社群內容分析，或繼續查看你的分析與同事分享的成果。' && (await text('.hero__cta')) === '創建新檔');
const plusRatio = await page.evaluate(() => { const c = document.querySelector('.hero__plus').getBoundingClientRect(); const s = document.querySelector('.hero__plus svg').getBoundingClientRect(); return Math.round((s.width / c.width) * 100); });
check('「創建新檔」的 + 圖示加大加粗（約占圓形直徑 68%）', plusRatio >= 60 && plusRatio <= 75, String(plusRatio));
check('首頁只有一個主要 CTA「創建新檔」（舊「建立分析」按鈕已移除）', (await page.$$('[data-action="create"]')).length === 1 && !(await text('#view')).includes('建立分析'));
check('Hero 撐滿內容欄寬', await page.evaluate(() => { const h = document.querySelector('.hero').getBoundingClientRect(); const m = document.querySelector('.main').getBoundingClientRect(); return Math.abs(h.left - m.left) < 1 && Math.abs(h.right - m.right) < 1; }));
check('頁面標題維持「社群口碑分析」', (await page.title()).startsWith('社群口碑分析'));
check('頂部 POC 標示列與頁尾 POC 文字／情境面板連結皆已移除', !(await page.$('.poc-banner')) && !(await page.$('.app-footer a')) && !(await text('.app-footer')).includes('POC'));
check('清單不分頁：一次顯示全部 12 筆（捲動清單）', (await page.$$('tbody tr')).length === 12 && (await text('.list-count')) === '共 12 筆' && !(await page.$('.pagination')));

// 搜尋 + 狀態篩選 + 排序
await page.type('#f-q', '洞察');
await sleep(700);
const aiRows = (await page.$$('tbody tr')).length;
check('搜尋可操作', aiRows === 5, `「洞察」→ ${aiRows} 筆`);
await page.select('#f-status', 'failed');
await sleep(500);
check('狀態篩選可操作', (await page.$$('tbody tr')).length === 1);
await page.click('[data-sort-col="name"]');
await sleep(500);
check('欄位排序更新 aria-sort', (await page.$eval('th[aria-sort="ascending"]', (el) => el.textContent.includes('專案名稱')).catch(() => false)));
// 篩選無結果
await page.click('#f-q', { clickCount: 3 });
await page.type('#f-q', 'zzz');
await sleep(700);
check('篩選無結果提供清除條件', !!(await page.$('[data-action="clear-filters"]')));
await shot('02-workbench-no-result');
await page.click('[data-action="clear-filters"]');
await sleep(500);
// 設定條件 → 進入分析 → 返回保留條件
await page.type('#f-q', '分群');
await sleep(700);
await page.click('a[data-row-link]');
await sleep(900);
await page.goBack();
await sleep(900);
check('返回工作台保留搜尋條件', (await page.$eval('#f-q', (el) => el.value)) === '分群');
await page.click('#f-q', { clickCount: 3 });
await page.keyboard.press('Backspace');
await sleep(600);

// 與我分享（鍵盤方向鍵切換 tab）
await page.focus('#tab-mine');
await page.keyboard.press('ArrowRight');
await sleep(600);
check('「與我分享」可用方向鍵切換', (await page.$eval('#tab-shared', (el) => el.getAttribute('aria-selected'))) === 'true' && (await page.$$('tbody tr')).length === 2);
await shot('03-workbench-shared');
await page.keyboard.press('ArrowLeft');
await sleep(600);

// ───────── 專案列「⋯」次選單 ─────────
await page.evaluate(() => scrollTo(0, 0));
const heads = await page.$$eval('thead th', (els) => els.map((e) => e.textContent.trim().replace(/[↕↑↓]/g, '').trim()));
check('清單標題為「專案名稱」，最右有「更多操作」欄', heads[0] === '專案名稱' && heads.at(-1) === '更多操作', heads.join('|'));
check('每列最右有「⋯」按鈕', (await page.$$('tbody tr [data-action="row-menu"]')).length === 12);
const row1 = '[data-action="row-menu"][data-id="AN-1002"]';
await page.click(row1);
await sleep(150);
const items = await page.$$eval('#row-menu [role="menuitem"]', (els) => els.map((e) => e.textContent.trim()));
check('自己的已完成專案：次選單為 置頂／分享／刪除', items.join('|') === '置頂|分享|刪除', items.join('|'));
check('次選單 ARIA：aria-expanded、focus 在第一項', (await page.$eval(row1, (b) => b.getAttribute('aria-expanded'))) === 'true' && await page.evaluate(() => document.activeElement.textContent.trim() === '置頂'));
await page.screenshot({ path: `${SHOTS}34-row-menu.png` });
await page.keyboard.press('ArrowDown');
check('方向鍵在選單項目間移動', await page.evaluate(() => document.activeElement.textContent.trim() === '分享'));
await page.keyboard.press('Escape');
check('Esc 關閉選單並把焦點還給「⋯」', await page.$eval('#row-menu', (m) => m.hidden) && await page.evaluate(() => document.activeElement.dataset.id === 'AN-1002'));
// 置頂
await page.click(row1); await sleep(100);
await page.click('#row-menu [data-key="pin"]');
await sleep(700);
const first = await page.$eval('tbody tr:first-child .row-link', (a) => a.textContent.trim());
check('置頂後該專案移到最上方並標示「已置頂」', first.includes('話題洞察') && (await text('tbody tr:first-child .cell-sub'))?.includes('已置頂'), first);
check('置頂後焦點回到該列的「⋯」', await page.evaluate(() => document.activeElement.dataset.id === 'AN-1002'));
await shot('35-pinned');
await page.click(row1); await sleep(100);
check('已置頂專案的選單顯示「取消置頂」', (await text('#row-menu [data-key="pin"]')) === '取消置頂');
await page.click('#row-menu [data-key="pin"]');
await sleep(700);
check('取消置頂後恢復原排序', !(await text('tbody tr:first-child .cell-sub'))?.includes('已置頂'));
// 處理中專案：分享不可用並說明原因
await page.click('[data-action="row-menu"][data-id="AN-1003"]'); await sleep(100);
check('處理中專案的「分享」不可用並說明「完成後才能分享」', (await page.$eval('#row-menu [data-key="share"]', (b) => b.getAttribute('aria-disabled'))) === 'true' && (await text('#row-menu [data-key="share"]'))?.includes('完成後才能分享'));
await page.keyboard.press('Escape');
// 與我分享：只有置頂
await page.evaluate(() => scrollTo(0, 0)); await sleep(150);
await page.click('#tab-shared'); await sleep(700);
await page.click('tbody tr [data-action="row-menu"]'); await sleep(100);
const sharedItems = await page.$$eval('#row-menu [role="menuitem"]', (els) => els.map((e) => e.textContent.trim()));
check('別人分享的專案：選單只有「置頂」（不出現分享、刪除）', sharedItems.join('|') === '置頂', sharedItems.join('|'));
await page.keyboard.press('Escape');
await page.evaluate(() => scrollTo(0, 0)); await sleep(150);
await page.click('#tab-mine'); await sleep(700);
// 點外面關閉
await page.click(row1); await sleep(100);
await page.mouse.click(700, 300);
await sleep(100);
check('點選單外部會關閉選單', await page.$eval('#row-menu', (m) => m.hidden));
// 分享 → 右側滑出面板
await page.click(row1); await sleep(100);
await page.click('#row-menu [data-key="share"]');
await sleep(600);
check('列表「分享」→ 右側滑出「分享專案」面板（不離開清單）', await page.$eval('#share-drawer', (d) => d.open) && (await text('#drawer-title')) === '分享專案' && !page.url().includes('/analysis/') && !!(await page.$('.hero')));
await shot('39-share-drawer');
const dr = await page.evaluate(() => { const r = document.querySelector('#share-drawer').getBoundingClientRect(); return { right: Math.round(r.right), w: Math.round(r.width), vw: innerWidth }; });
check('面板貼齊視窗右緣、約半個畫面寬', dr.right === dr.vw && dr.w >= 440 && dr.w <= 700, JSON.stringify(dr));
check('面板含「請選擇分享的 Email 信箱」、搜尋欄、信箱清單、分享按鈕', (await text('#share-drawer .field__label'))?.includes('請選擇分享的 Email 信箱') && !!(await page.$('#d-search')) && (await page.$$('.share-row')).length >= 20 && (await text('[data-d="submit"]')) === '分享');
check('未選信箱時「分享」為灰色（aria-disabled）', (await page.$eval('[data-d="submit"]', (b) => b.getAttribute('aria-disabled'))) === 'true');
await page.type('#d-search', 'agnes'); await sleep(200);
check('搜尋信箱可篩選清單', (await page.$$('.share-row')).length === 2);
await page.click('.share-row input'); await sleep(100);
check('勾選後「分享」可用，並顯示已選數量', (await page.$eval('[data-d="submit"]', (b) => b.getAttribute('aria-disabled'))) === 'false' && (await text('#d-hint'))?.includes('已選取 1'));
await page.click('[data-d="submit"]'); await sleep(900);
check('按下分享後面板關閉並提示（POC 不寄信）', await page.$eval('#share-drawer', (d) => !d.open) && (await text('.toast'))?.includes('未寄送通知'));
await page.click(row1); await sleep(100);
await page.click('#row-menu [data-key="share"]'); await sleep(500);
check('再次開啟：已分享的信箱顯示「已分享」且不可重複勾選', (await page.$$('.share-row.is-shared')).length === 1 && await page.$eval('.share-row.is-shared input', (i) => i.checked && i.disabled));
await page.keyboard.press('Escape'); await sleep(200);
check('Esc 關閉面板', await page.$eval('#share-drawer', (d) => !d.open));
await page.reload({ waitUntil: 'networkidle0' }); await sleep(800); await page.evaluate(() => scrollTo(0, 0)); await sleep(300);
// 刪除：取消 → 確認
await page.click('[data-action="row-menu"][data-id="AN-1008"]'); await sleep(100);
await page.click('#row-menu [data-key="delete"]'); await sleep(300);
check('刪除先跳出確認對話框（預設焦點在「取消」）', await page.evaluate(() => document.querySelector('.confirm-dialog')?.open && document.activeElement.dataset.cd === 'cancel'));
await shot('36-delete-confirm-dialog');
await page.click('[data-cd="cancel"]'); await sleep(300);
check('取消後專案仍在，焦點回到「⋯」', !!(await page.$('[data-action="row-menu"][data-id="AN-1008"]')) && !(await page.$('.confirm-dialog')) && await page.evaluate(() => document.activeElement.dataset.id === 'AN-1008'));
await page.click('[data-action="row-menu"][data-id="AN-1008"]'); await sleep(100);
await page.click('#row-menu [data-key="delete"]'); await sleep(300);
await page.evaluate(() => { const b = document.querySelector('[data-cd="ok"]'); b.click(); b.click(); });
await sleep(1500);
const left = await page.evaluate(() => JSON.parse(localStorage.getItem('clue-poc:db:v3')).analyses.filter((a) => a.id === 'AN-1008').length);
check('確認刪除後從清單移除（重複點擊只執行一次）', left === 0 && !(await page.$('[data-action="row-menu"][data-id="AN-1008"]')) && (await text('.list-count'))?.includes('共 11 筆'), String(left));

// ───────── 三步建立（話題分群＋示範資料） ─────────
const before = await page.evaluate(() => JSON.parse(localStorage.getItem('clue-poc:db:v3')).analyses.length);
await page.click('[data-action="create"]');
await sleep(600);
check('步驟一標題「專案基本資訊」與說明文字', (await text('.wizard-card__title')) === '專案基本資訊' && (await text('.wizard-card__desc'))?.includes('為了讓分析資料更加準確，請詳細填入或勾選以下資料') && (await text('.wizard-card__desc'))?.includes('為必填選項'));
check('已刪除「話題分群／AI 洞察」模式區塊', !(await page.$('input[name="mode"]')) && !(await text('.wizard-card'))?.includes('AI 洞察'));
await go('#/');
const listHeads = await page.$$eval('thead th', (els) => els.map((e) => e.textContent.replace(/[↕↑↓]/g, '').trim()));
check('專案清單沒有「模式」欄，也沒有模式標籤', !listHeads.includes('模式') && !(await page.$('tbody .tag')), listHeads.join('|'));
await go('#/analysis/AN-1001');
check('專案內頁沒有模式標籤', !(await page.$('.meta-row .tag')));
await go('#/create/1');
check('必填未完成時「下一步」呈灰色（aria-disabled）', (await page.$eval('[data-action="next"]', (b) => b.getAttribute('aria-disabled'))) === 'true');
await page.click('[data-action="next"]');
await sleep(200);
check('步驟一必填驗證（專案命名、客戶名稱、產業大類）', (await page.$$('.field__error:not([hidden])')).length === 3);
await page.type('#f-name', 'bad name!');
await page.click('[data-action="next"]');
await sleep(200);
check('專案命名不可含空白與其他符號', (await text('#name-error'))?.includes('不可有空白或其他符號'));
await page.click('#f-name', { clickCount: 3 });
await page.type('#f-name', '屈臣氏_Q4-社群口碑分析');
check('客戶屬性預設「既有客戶」，子類在選大類前停用', (await page.$eval('input[name="clientType"][value="existing"]', (el) => el.checked)) && (await page.$eval('#f-subIndustry', (el) => el.disabled)));
check('「AI 搜尋比對」未輸入公司名稱前停用', await page.$eval('[data-action="match"]', (b) => b.disabled));
await page.type('#f-clientName', 'Watsons');
await page.click('[data-action="match"]');
await sleep(1000);
check('搜尋比對（POC 模擬）帶入客戶名稱與產業', (await page.$eval('#f-clientName', (el) => el.value)) === '屈臣氏' && (await page.$eval('#f-industry', (el) => el.value)) === '零售與通路' && (await page.$eval('#f-subIndustry', (el) => el.value)) === '藥妝與生活用品' && (await text('#client-note'))?.includes('已帶入產業類別'));
await page.click('[data-action="info"]');
check('產業大類說明可展開（按鈕，不靠 hover）', await page.$eval('#industry-info', (p) => !p.hidden));
await page.click('input[name="clientType"][value="new"]');
check('切換「創建新客戶」隱藏 AI 搜尋比對，保留已填內容', !(await page.$('[data-action="match"]')) && (await page.$eval('#f-clientName', (el) => el.value)) === '屈臣氏');
const newLabels = await page.$$eval('.client-grid--new .field__label', (els) => els.map((e) => e.textContent.replace(/[*（）必填]/g, '').trim()));
check('創建新客戶：公司名稱、統編、產業大類／子類三欄', newLabels.slice(0, 2).join('|') === '公司名稱|統編' && newLabels.some((l) => l.includes('客戶產業大類')) && !!(await page.$('#f-taxId')) && (await text('#client-note'))?.includes('請至商工登記查詢') , newLabels.join('|'));
check('統編未填時「下一步」仍為灰色', (await page.$eval('[data-action="next"]', (b) => b.getAttribute('aria-disabled'))) === 'true');
await page.type('#f-taxId', '12ab345');
check('統編只接受數字（最多 8 碼）', (await page.$eval('#f-taxId', (el) => el.value)) === '12345');
await page.click('[data-action="next"]'); await sleep(200);
check('統編不足 8 碼會提示', (await text('#taxId-error'))?.includes('8 碼'));
await page.type('#f-taxId', '678');
await page.click('input[name="clientType"][value="existing"]');
await page.$eval('#f-industry', (el) => { el.value = ''; el.dispatchEvent(new Event('change', { bubbles: true })); });
await page.click('[data-action="next"]'); await sleep(200);
check('清除產業大類後需重選', (await text('#industry-error'))?.includes('請選擇客戶產業大類'));
await page.select('#f-industry', '零售與通路');
await page.select('#f-subIndustry', '藥妝與生活用品');
check('必填完成後「下一步」恢復可用', (await page.$eval('[data-action="next"]', (b) => b.getAttribute('aria-disabled'))) === 'false');
await shot('04-create-step1');
await page.click('[data-action="next"]');
await sleep(600);
check('進入步驟二，預設範本資料（兩份上傳檔）', page.url().endsWith('#/create/2') && (await text('.subpanel'))?.includes('Social Listening Data _testing (Waston).xlsx') && (await text('#keyword-panel'))?.includes('Keyword Data _testing (Waston).xlsx'));
check('範本資料模式也有自訂關鍵字拖放上傳區', !!(await page.$('#keyword-panel [data-drop="keyword"]')) && !!(await page.$('#keyword-panel #f-kw')));
const plats = await page.$$eval('input[name="platform"]', (els) => els.map((e) => e.value + (e.checked ? '*' : '')));
const platTitles = await page.$$eval('.choice-grid--3 .choice-card__title', (els) => els.map((e) => e.textContent.trim()));
check('資料來源為 3 個單選區塊：OpView（預設）／Keypo／Qsearch', plats.join(',') === 'opview*,keypo,qsearch' && platTitles.join(',') === 'OpView,Keypo,Qsearch', plats.join(','));
check('OpView 區塊含說明文字與「前往索取頁」連結', (await text('.choice-card--split:first-child'))?.includes('還沒有文章檔？先到索取頁填寫條件，取得匯出檔後再回來上傳。已填的內容會保留。') && (await page.$eval('.choice-card__link', (a) => a.getAttribute('href'))) === '#/opview');
check('第二、三步標題靠左且為 Clue 紫', await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.wizard-card__title')); return s.color === 'rgb(132, 75, 153)' && s.textAlign !== 'center'; }));
await page.click('input[name="platform"][value="keypo"]');
check('可切換為 Keypo', await page.$eval('input[name="platform"][value="keypo"]', (el) => el.checked));
await page.click('input[name="platform"][value="opview"]');
await shot('05-create-step2-demo');
await page.click('[data-action="prev"]');
await sleep(500);
check('上一步保留輸入', (await page.$eval('#f-name', (el) => el.value)) === '屈臣氏_Q4-社群口碑分析' && (await page.$eval('#f-subIndustry', (el) => el.value)) === '藥妝與生活用品');
await page.click('button[type="submit"]');
await sleep(500);
await page.click('button[type="submit"]');
await sleep(600);
check('進入步驟三', page.url().endsWith('#/create/3'));
await shot('06-create-step3');
// 快速連點兩次「開始分析」
await page.evaluate(() => { const b = document.querySelector('[data-action="start"]'); b.click(); b.click(); });
await sleep(1500);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('clue-poc:db:v3')).analyses.length);
check('重複點擊只建立一筆分析', after === before + 1, `${before} → ${after}`);
check('送出後進入處理中頁', (await text('#proc-title')) === '分析處理中');
check('處理中不顯示百分比', !(await page.evaluate(() => /\d+\s*%/.test(document.querySelector('.state-panel').textContent))));
await shot('07-processing');
await sleep(6500);
check('模擬完成後自動顯示專案內頁', !!(await page.$('#tab-insight')));
await shot('08-result-cluster');

// ───────── 專案內頁結構 ─────────
await go('#/analysis/AN-1001');
const headBtns = await page.$$eval('.page-head__actions .btn', (els) => els.map((e) => e.textContent.trim()));
check('頁首右側為「下載資料」「分享」', headBtns.join('|') === '下載資料|分享', headBtns.join('|'));
const order = await page.evaluate(() => ['.page-head', '.tabs', '.project-actions'].map((s) => document.querySelector(s).getBoundingClientRect().top));
check('由上而下：專案名稱 → 四個 tab → 底部操作', order[0] < order[1] && order[1] < order[2]);
const tabs = await page.$$eval('[role="tab"].tabs__tab', (els) => els.map((e) => e.textContent.trim()));
check('第一層只有兩個 tab：話題洞察／話題分群', tabs.join('|') === '話題洞察|話題分群', tabs.join('|'));
await page.click('#tab-layers'); await sleep(200);
const subs = await page.$$eval('.segmented .segmented__item', (els) => els.map((e) => e.textContent.trim()));
check('話題分群底下為按鈕式分頁：分群摘要／關鍵字總表／摘要統整', subs.join('|') === '分群摘要|關鍵字總表|摘要統整' && (await page.$eval('.segmented__item[aria-selected="true"]', (el) => { const s = getComputedStyle(el); return s.backgroundColor === 'rgb(132, 75, 153)' && s.color === 'rgb(255, 255, 255)' && el.getBoundingClientRect().height === 50; })), subs.join('|'));
await page.click('#tab-insight'); await sleep(200);
check('已移除「POC 範本資料」說明框與「摘要」區塊（含分群數據表）', !(await page.$('.notice--neutral')) && !(await page.$('#summary-table')) && !(await page.$('.table--summary')) && !(await text('#view'))?.includes('POC 範本資料：') && !(await text('#view'))?.includes('查看各分群數據表'));
const firstSec = await page.$eval('.report-sec__title', (el) => el.textContent.trim());
check('話題洞察：「社群洞察總結」在最上方', firstSec.includes('社群洞察總結'), firstSec);
const insightText = await text('#tabpanel');
check('話題洞察分頁沒有任何連結（與話題分群資料來源不同，不互相連結）', (await page.$$('#tabpanel a')).length === 0);
check('話題洞察分頁文案不再出現「分群」', !insightText.includes('分群'));
const tones = await page.$$eval('td[data-label="情緒傾向"] .status-tag', (els) => els.map((e) => ({ t: e.textContent.trim(), cls: e.className.replace('status-tag status-tag--', ''), w: Math.round(e.getBoundingClientRect().width) })));
check('情緒傾向標籤沿用狀態標籤樣式：偏正面＝紫底、中立＝灰框、偏負面＝咖啡底，寬度一致', tones.length === 6 && tones.every((x) => x.w === 64) && tones.filter((x) => x.t === '偏正面').every((x) => x.cls === 'completed') && tones.filter((x) => x.t === '中立').every((x) => x.cls === 'processing') && tones.filter((x) => x.t === '偏負面').every((x) => x.cls === 'failed') && !(await page.$('td[data-label="情緒傾向"] .badge')), JSON.stringify(tones));
const lg = await page.evaluate(() => ({ neg: getComputedStyle(document.querySelector('.linechart__line--neg')).stroke, pos: getComputedStyle(document.querySelector('.linechart__line--pos')).stroke, total: getComputedStyle(document.querySelector('.linechart__line--total')).stroke }));
check('每日聲量圖：負面＝咖啡色（與標籤同色）、正面＝綠、總聲量＝紫', lg.neg === 'rgb(173, 96, 56)' && lg.pos === 'rgb(62, 115, 80)' && lg.total === 'rgb(124, 79, 160)', JSON.stringify(lg));
await page.hover('.linechart__hit[data-day-date="2022-11-12"]'); await sleep(200);
const dayTip = await page.$eval('#topic-tip', (e) => ({ text: e.textContent, colors: [...e.querySelectorAll('.topic-tip__row .legend')].map((l) => getComputedStyle(l, '::before').backgroundColor) }));
check('hover 每日聲量圖顯示當天總聲量／正面／負面，顏色對應圖例', dayTip.text.includes('2022/11/12') && dayTip.text.includes('總聲量') && dayTip.text.includes('正面') && dayTip.text.includes('負面') && dayTip.colors[0] === 'rgb(124, 79, 160)' && dayTip.colors[1] === 'rgb(62, 115, 80)' && dayTip.colors[2] === 'rgb(173, 96, 56)', dayTip.text);
await page.mouse.move(5, 5); await sleep(150);
check('滑開後提示消失', await page.$eval('#topic-tip', (e) => e.hidden));
await page.click('.linechart__hit[data-day-date="2022-11-12"]'); await sleep(200);
check('click 每日聲量圖也會顯示提示', (await text('#topic-tip'))?.includes('2022/11/12'));
await page.click('.report-sec__title'); await sleep(150);
check('點其他地方收起折線圖提示', await page.$eval('#topic-tip', (e) => e.hidden));
const kpiAlign = await page.$$eval('.kpi', (els) => els.map((k) => { const kr = k.getBoundingClientRect(); const l = k.querySelector('.kpi__label'); const v = k.querySelector('.kpi__value'); const body = k.querySelector('.kpi__body').getBoundingClientRect(); return { centered: Math.abs((body.left - kr.left) - (kr.right - body.right)) <= 2, sameLeft: Math.abs(l.getBoundingClientRect().left - v.getBoundingClientRect().left) <= 1 }; }));
check('KPI 卡：數字組整體置中，上方小字與數字左緣對齊', kpiAlign.length === 4 && kpiAlign.every((x) => x.centered && x.sameLeft), JSON.stringify(kpiAlign));
await page.evaluate(() => scrollTo(0, 0));
await page.hover('.hbar__label [data-topic="2"]'); await sleep(250);
const tip1 = await page.evaluate(() => { const e = document.querySelector('#topic-tip'); return { vis: !e.hidden, text: e.textContent }; });
check('話題排行 hover 顯示簡短話題內容與關鍵字', tip1.vis && tip1.text.includes('話題 2') && tip1.text.includes('屈臣氏') && tip1.text.includes('關鍵字：沒有、大家、推薦'), tip1.text);
await page.mouse.move(5, 5); await sleep(150);
check('滑開後提示消失', await page.$eval('#topic-tip', (e) => e.hidden));
await page.hover('td, th[scope="row"] .topic-ref'); await sleep(250);
const tip2 = await page.evaluate(() => ({ vis: !document.querySelector('#topic-tip').hidden, text: document.querySelector('#topic-tip').textContent }));
check('情緒分析表的「話題 N」hover 也顯示提示', tip2.vis && tip2.text.includes('關鍵字：'), tip2.text);
await page.mouse.move(5, 5); await sleep(150);
await page.focus('.hbar__label [data-topic="1"]'); await sleep(200);
check('鍵盤 focus 同樣顯示提示（可 Tab 到達）', await page.$eval('#topic-tip', (e) => !e.hidden) && (await page.$eval('.hbar__label [data-topic="1"]', (el) => el.getAttribute('aria-describedby'))) === 'topic-tip');
await page.keyboard.press('Escape'); await sleep(100);
check('Esc 關閉提示', await page.$eval('#topic-tip', (e) => e.hidden));
await page.evaluate(() => document.activeElement.blur());
check('話題洞察標示非 AI 模型撰寫', (await text('.report-note'))?.includes('並非 AI 模型撰寫'));
const heatmapW = await page.evaluate(() => { const t = document.querySelector('.heat'); const c = t.closest('.scroll-x'); return { t: Math.round(t.getBoundingClientRect().width), c: Math.round(c.getBoundingClientRect().width) }; });
check('發布時段熱力圖寬度撐滿容器（fill container）', Math.abs(heatmapW.t - heatmapW.c) <= 1, JSON.stringify(heatmapW));
check('每小時聲量／星期聲量改為上下堆疊（不同列）', await page.evaluate(() => { const [a, b] = document.querySelectorAll('.chart-stack > div'); return b.getBoundingClientRect().top > a.getBoundingClientRect().bottom - 1; }));
const barColors = await page.$$eval('.minicols__col', (els) => els.map((e) => ({ strong: e.classList.contains('is-strong'), bg: getComputedStyle(e.querySelector('.minicols__bar')).backgroundColor })));
const strongColors = new Set(barColors.filter((b) => b.strong).map((b) => b.bg));
const plainColors = new Set(barColors.filter((b) => !b.strong).map((b) => b.bg));
check('只有最高聲量長條是紫色，其餘為淺灰色', strongColors.size === 1 && [...strongColors].every((c) => c === 'rgb(124, 79, 160)') && [...plainColors].every((c) => c === 'rgb(218, 218, 218)'), JSON.stringify([...strongColors, ...plainColors]));
await page.hover('.minicols__col[data-tip^="0:00"]'); await sleep(200);
check('hover 長條顯示數量提示', (await text('#topic-tip'))?.includes('0:00') && (await text('#topic-tip'))?.includes('篇'));
await page.mouse.move(5, 5); await sleep(150);
await page.click('.minicols__col[data-tip^="週二"]'); await sleep(200);
check('click 長條也會顯示數量提示', (await text('#topic-tip'))?.includes('週二') && (await text('#topic-tip'))?.includes('篇'));
await page.click('.report-sec__title'); await sleep(150);
check('點其他地方會收起提示', await page.$eval('#topic-tip', (e) => e.hidden));
const bottomBtns = await page.$$eval('.project-actions__main .btn, .project-actions > .btn', (els) => els.map((e) => e.textContent.trim()));
check('底部有下載資料／分享大按鍵與刪除專案', bottomBtns.join('|') === '下載資料|分享|刪除專案', bottomBtns.join('|'));
check('只有一個主要 CTA', (await page.$$('.btn--primary')).length === 1);
await shot('08-result-insight');

// Tab 鍵盤切換 + 分群下拉
await page.focus('#tab-insight');
await page.keyboard.press('ArrowRight');
await sleep(300);
check('方向鍵切到「話題分群」，預設顯示第二層「分群摘要」', (await page.$eval('#tab-layers', (el) => el.getAttribute('aria-selected'))) === 'true' && (await page.$eval('#subtab-clusters', (el) => el.getAttribute('aria-selected'))) === 'true');
const opts = await page.$$eval('#cluster-select option', (os) => os.map((o) => o.textContent.split('（')[0]));
check('分群下拉命名為 分群 1…分群 6', opts.join(',') === '分群 1,分群 2,分群 3,分群 4,分群 5,分群 6', opts.join(','));
await page.select('#cluster-select', '5');
await sleep(300);
check('切到分群 5：直條圖與泡泡圖同步強調', (await page.$eval('.colchart__col.is-strong', (el) => el.dataset.cluster)) === '5' && (await page.$eval('.bubble__item.is-strong', (el) => el.dataset.cluster)) === '5');
const kw5 = await page.$$eval('.pairbar__label', (els) => els.slice(0, 3).map((e) => e.textContent));
check('分群 5 關鍵字 Top 30 來自真實資料（店員…）', kw5[0] === '店員' && (await page.$$('.pairbar__row')).length === 30, kw5.join('、'));
check('關鍵字矩陣 20×20、對角線 1.00', (await page.$$('.heat tbody tr')).length === 20 && (await page.$eval('.heat tbody tr td', (td) => td.textContent)) === '1.00');
const matrixW = await page.evaluate(() => { const t = document.querySelector('.heat'); const c = t.closest('.scroll-x'); return { t: Math.round(t.getBoundingClientRect().width), c: Math.round(c.getBoundingClientRect().width) }; });
check('關鍵字矩陣表寬度撐滿容器（fill container）', Math.abs(matrixW.t - matrixW.c) <= 1, JSON.stringify(matrixW));
check('網址保留分頁與分群', page.url().includes('tab=layers') && page.url().includes('c=5'));
await shot('09-result-clusters');

await page.click('#subtab-keywords');
await sleep(300);
check('關鍵字總表：總表 30 筆、分群表 180 筆', (await page.$$('.dash-card:first-child tbody tr')).length === 30 && (await page.$$('.dash-card:nth-child(2) tbody tr')).length === 180);
await page.select('#kw-filter', '6');
await sleep(300);
const kwRows = await page.$$eval('.dash-card:nth-child(2) tbody tr', (trs) => trs.map((tr) => tr.children[0].textContent));
check('分群篩選只顯示分群 6', kwRows.length === 30 && kwRows.every((c) => c === '6'));
await shot('10-result-keywords');
await page.click('#subtab-summary');
await sleep(300);
check('摘要統整：6 群摘要且無 Markdown 星號', (await page.$$('.table--topics tbody tr')).length === 6 && !(await text('.table--topics')).includes('**'));
await shot('11-result-summary');

// 來源查核：分群 → 文章 → 返回
await page.click('#subtab-clusters');
await sleep(300);
await page.select('#cluster-select', '5');
await sleep(300);
await page.click('.tab-toolbar a.btn');
await sleep(1200);
check('分群 5 來源列表 211 篇（每頁 20）', (await text('.list-count'))?.includes('211') && (await page.$$('.article-card')).length === 20);
await page.select('#s-sent', '負面');
await sleep(400);
const negCount = await page.$$eval('.article-card', (els) => els.length);
await shot('12-sources');
await page.click('.article-card__title a');
await sleep(1000);
check('文章全文頁顯示所屬分群', (await text('.article-aside'))?.includes('分群 5'));
check('原始連結以新分頁開啟並標示外部', !!(await page.$('.article-body a[target="_blank"][rel~="noopener"]')));
await shot('13-article');
await page.click('.back-row a');
await sleep(1200);
check('返回來源列表保留分群與情緒篩選', (await page.$eval('#s-sent', (el) => el.value)) === '負面' && (await page.$$('.article-card')).length === negCount);
await page.click('.back-row a');
await sleep(1200);
check('返回分群摘要（保留分群 5）', (await page.$eval('#subtab-clusters', (el) => el.getAttribute('aria-selected'))) === 'true' && (await page.$eval('#cluster-select', (el) => el.value)) === '5');

// 黏貼式 tab 與回到最上方
await go('#/analysis/AN-1001?tab=layers');
check('頁面頂端時不顯示「回到最上方」', await page.$eval('.fab-top', (b) => b.hidden));
await page.evaluate(() => scrollTo(0, 1800)); await sleep(400);
const stick = await page.evaluate(() => ({ tabs: Math.round(document.querySelector('.tabs').getBoundingClientRect().top), sub: Math.round(document.querySelector('.segmented').getBoundingClientRect().top), fab: !document.querySelector('.fab-top').hidden }));
check('往下捲後：第一層 tab 黏在頁首下方（80px）', stick.tabs === 80, JSON.stringify(stick));
check('往下捲後：第二層按鈕黏在第一層 tab 下方（129px）', stick.sub === 129, JSON.stringify(stick));
check('捲超過一個畫面高度後出現「回到最上方」圓形按鈕', stick.fab);
await shot('38-sticky-tabs');
await page.evaluate(() => scrollTo(0, 1800)); await sleep(300);
await page.click('.fab-top'); await sleep(1200);
check('按下回到最上方並隱藏按鈕', (await page.evaluate(() => scrollY)) === 0 && await page.$eval('.fab-top', (b) => b.hidden));
await go('#/analysis/AN-1001');
await page.evaluate(() => scrollTo(0, 1500)); await sleep(300);
check('「話題洞察」頁同樣有黏貼 tab 與回到最上方', (await page.$eval('.tabs', (el) => Math.round(el.getBoundingClientRect().top))) === 80 && await page.$eval('.fab-top', (b) => !b.hidden));
await page.evaluate(() => scrollTo(0, 0));
await go('#/');
await page.evaluate(() => scrollTo(0, 1200)); await sleep(300);
check('清單頁（捲到 1200px）：tab 仍黏在頁首下方，並有「回到最上方」按鈕', (await page.$eval('.tabs--list', (el) => Math.round(el.getBoundingClientRect().top))) === 80 && await page.$eval('.fab-top', (b) => !b.hidden));
await page.evaluate(() => scrollTo(0, 0));
await go('#/analysis/AN-1001');

await go('#/analysis/AN-1001');
const pads = await page.evaluate(() => ['.core-findings', '.insight-card', '.kpi'].map((s) => { const e = document.querySelector(s); const cs = getComputedStyle(e); const first = e.firstElementChild.getBoundingClientRect().top - e.getBoundingClientRect().top; const last = e.getBoundingClientRect().bottom - e.lastElementChild.getBoundingClientRect().bottom; return [s, [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join('/'), Math.round(first), Math.round(last)]; }));
check('話題洞察區塊：上下左右 padding 皆為 32px，內容到上下緣距離相等（無多餘 margin）', pads.every(([, p, f, l]) => p === '32px/32px/32px/32px' && Math.abs(f - l) <= 6 && f >= 32), JSON.stringify(pads));
await page.click('#tab-layers'); await sleep(300);
const pads2 = await page.$$eval('.dash-card', (els) => els.map((e) => { const s = getComputedStyle(e); return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].join('/'); }));
check('話題分群卡片上下左右 padding 皆為 32px', pads2.length >= 4 && pads2.every((p) => p === '32px/32px/32px/32px'), pads2.join(','));
await page.click('#tab-insight'); await sleep(200);

check('專案頁底部按鈕上方沒有分隔線', await page.$eval('.project-actions', (el) => getComputedStyle(el).borderTopWidth === '0px'));
await go('#/create/1');
check('創建新檔底部按鈕上方沒有分隔線', await page.$eval('.wizard-card__foot', (el) => getComputedStyle(el).borderTopWidth === '0px'));
await go('#/opview');
check('OpView 索取底部按鈕上方沒有分隔線', await page.$eval('.form-card__foot', (el) => getComputedStyle(el).borderTopWidth === '0px'));
await go('#/analysis/AN-1001');

// 唯讀：無刪除；刪除：確認後移除
await go('#/analysis/AN-2001');
check('別人分享的專案沒有刪除按鍵', !(await page.$('[data-action="delete"]')) && !!(await page.$('.notice--readonly')));
await go('#/analysis/AN-1006');
await page.click('[data-action="delete"]');
await sleep(200);
check('刪除前需要確認', await page.$eval('#delete-confirm', (el) => !el.hidden));
await shot('14-delete-confirm');
await page.click('[data-action="confirm-delete"]');
await sleep(1500);
const gone = await page.evaluate(() => !JSON.parse(localStorage.getItem('clue-poc:db:v3')).analyses.some((a) => a.id === 'AN-1006'));
check('確認後刪除並回到清單', gone && (await page.title()).startsWith('社群口碑分析') && !!(await page.$('.hero')));

// ───────── 錯誤／狀態 ─────────
await go('#/poc');
await shot('13-poc-panel');
await page.click('[data-act="bad-files"]');
await sleep(900);
const errs = await page.$$eval('.file-item__error', (els) => els.map((e) => e.textContent));
check('格式／大小／空檔錯誤指出原因', errs.length === 3 && errs.some((e) => e.includes('格式')) && errs.some((e) => e.includes('16.0 MB')) && errs.some((e) => e.includes('空的')), errs.length + ' 項 @ ' + page.url());
await page.click('button[type="submit"]');
await sleep(300);
check('有錯誤時無法前往確認', page.url().includes('#/create/2'));
await shot('14-create-file-errors');
// 移除一個錯誤檔，其他檔案保留
await page.click('.file-item [data-action="remove-file"]');
await sleep(300);
check('移除單一檔案不清除其他輸入', (await page.$$('.file-item')).length === 2);
const kwDz = await page.$$eval('.dropzone', (els) => els.map((e) => e.dataset.drop));
check('自訂關鍵字使用與文章檔相同的拖放上傳區', kwDz.join(',') === 'article,keyword' && !(await page.$('.kw-row')), kwDz.join(','));
const fs2 = await import('node:fs'); fs2.writeFileSync('/tmp/clue-poc-kw.csv', '新增關鍵字,刪除關鍵字\n雙11,BR\n');
await (await page.$('#f-kw')).uploadFile('/tmp/clue-poc-kw.csv');
await sleep(300);
check('關鍵字上傳區提示與文章檔相同（最多 4 份）且可多選', (await text('[data-drop="keyword"] .dropzone__hint')) === (await text('[data-drop="article"] .dropzone__hint')) && await page.$eval('#f-kw', (el) => el.multiple));
check('選擇關鍵字檔後以相同的檔案卡片顯示（檔名、大小、狀態、可移除）', (await text('#kw-results .file-item'))?.includes('clue-poc-kw.csv') && (await text('#kw-results .file-item'))?.includes('通過基本檢查') && !!(await page.$('#kw-results [data-action="remove-file"]')));
await page.click('#kw-results [data-action="remove-file"]');
await sleep(200);
check('移除關鍵字檔', !(await page.$('#kw-results .file-item')));
await page.click('[data-action="use-demo"]'); await sleep(200);
check('可改用範本資料，並可改回上傳本機檔案', !!(await page.$('[data-action="use-local"]')) && !(await page.$('[data-drop="article"]')));
await page.click('[data-action="use-local"]'); await sleep(200);

await go('#/analysis/AN-1004');
check('失敗頁說明原因並提供重試', (await text('.state-panel--error'))?.includes('逾時') && !!(await page.$('[data-action="retry"]')));
await shot('15-failed');
await page.click('[data-action="retry"]');
await sleep(1200);
check('重試後回到處理中', (await text('#proc-title')) === '分析處理中');

await go('#/analysis/AN-2001');
await page.click('.page-head [data-action="share"]'); await sleep(500);
check('唯讀分析有唯讀標示、無刪除，分享面板僅可查看對象', !!(await page.$('.notice--readonly')) && !(await page.$('[data-action="delete"]')) && (await text('#share-drawer'))?.includes('無法新增分享對象') && !(await page.$('#d-search')));
await page.keyboard.press('Escape'); await sleep(200);
await shot('16-readonly');
await go('#/analysis/AN-2003');
check('無權限頁不顯示內容', (await text('.page-title')) === '沒有存取權限' && !(await page.$('.tabs')));
await shot('17-forbidden');
await go('#/analysis/AN-9999');
check('未知 ID 有返回路徑', (await text('.page-title')) === '找不到這份分析' && !!(await page.$('a[href="#/"].btn')));
await go('#/analysis/AN-1005');
await shot('18-long-title');
check('長標題不造成水平溢出', (await overflowX()) <= 0);
await go('#/analysis/AN-1005/articles/W-1693?cluster=5');
check('長標題文章完整呈現並說明匯出上限', (await text('.page-title'))?.length > 80 && (await text('.article-body'))?.includes('200 字'));
await shot('19-long-article');

// 刷新後檔案需重新選擇
await go('#/poc');
await page.click('[data-act="bad-files"]');
await sleep(600);
await page.reload({ waitUntil: 'networkidle0' });
await sleep(600);
check('刷新後明確要求重新選檔', (await text('.subpanel .notice--warn'))?.includes('重新選擇檔案'));

// 空資料
await go('#/poc');
await page.click('[data-act="empty"]');
await sleep(900);
check('空清單收起列表，仍只有 Hero 的「創建新檔」', !!(await page.$('.hero__cta')) && !(await page.$('table')) && !(await page.$('.empty-hero .btn')) && (await page.$$('[data-action="create"]')).length === 1);
await shot('20-workbench-empty');

// 鍵盤：Tab 可達主要 CTA，focus 可見
await go('#/poc');
await page.click('[data-act="reset"]');
await sleep(900);
await page.evaluate(() => document.activeElement.blur());
let reached = false; let outline = '';
for (let i = 0; i < 40; i++) {
  await page.keyboard.press('Tab');
  const info = await page.evaluate(() => ({ t: document.activeElement.textContent.trim(), o: getComputedStyle(document.activeElement).outlineStyle }));
  if (info.t === '創建新檔') { reached = true; outline = info.o; break; }
}
check('鍵盤 Tab 可到達「創建新檔」且 focus 可見', reached && outline !== 'none', outline);

// 左欄、OpView 社群資料索取、使用指南
await go('#/');
check('左欄已移除 Clue／社群內容分析 標題', !(await page.$('.main-nav__brand')) && !(await text('#main-nav')).includes('社群內容分析'));
const navTop = await page.evaluate(() => ({ nav: document.querySelector('#main-nav').getBoundingClientRect().top, first: document.querySelector('.main-nav__links a').getBoundingClientRect().top }));
check('「社群口碑分析」移到左欄頂部', navTop.first - navTop.nav < 60, String(Math.round(navTop.first - navTop.nav)));
const navLabels = await page.$$eval('.main-nav__links a', (els) => els.map((e) => e.textContent.trim()));
check('左欄項目命名', navLabels.join('|') === '社群口碑分析|OpView 社群資料索取|使用指南', navLabels.join('|'));
check('「最近開啟」上方有 1px 分隔線', await page.$eval('#recent-block', (el) => { const s = getComputedStyle(el); return s.borderTopWidth === '1px' && s.borderTopStyle === 'solid'; }));
await page.evaluate(() => document.querySelector('a[href="#/opview"]').click());
await sleep(600);
check('進入 OpView 社群資料索取，左欄標示目前頁', (await text('.page-title')) === 'OpView 社群資料索取' && (await page.$eval('a[href="#/opview"]', (el) => el.getAttribute('aria-current'))) === 'page');
await page.click('button[type="submit"]');
await sleep(200);
check('索取表單必填驗證（客戶、關鍵字、來源）', (await page.$$('.field__error:not([hidden])')).length === 3);
await page.type('#o-client', '屈臣氏');
await page.type('#o-keywords', '(屈臣氏|Watsons|小屈)!直播!限定');
check('查詢區間為單一欄位（不再是兩個日期選單）', !!(await page.$('#o-range')) && !(await page.$('input[type="date"]')));
await page.click('#o-range'); await sleep(200);
check('點欄位開啟日曆浮層（一次選起訖）', await page.$eval('#range-pop', (p) => !p.hidden) && (await page.$eval('#o-range', (b) => b.getAttribute('aria-expanded'))) === 'true');
check('未來日期不可選', await page.$$eval('.datepicker__day', (els) => els.filter((e) => e.dataset.date > new Date().toISOString().slice(0, 10)).every((e) => e.getAttribute('aria-disabled') === 'true')));
await shot('31b-range-picker');
await page.click('.datepicker__day[data-date$="-03"]'); await sleep(100);
check('先點開始日期後，浮層提示「請選擇結束日期」', (await text('.datepicker__hint')) === '請選擇結束日期');
await page.click('.datepicker__day[data-date$="-01"]'); await sleep(200);
const rangeText = await text('#o-range-text');
check('先點 3 日再點 1 日會自動對調成 1 日 – 3 日，選完自動關閉', /\/01 – .*\/03$/.test(rangeText) && await page.$eval('#range-pop', (p) => p.hidden), rangeText);
await page.keyboard.press('Enter'); await sleep(200);
check('鍵盤：欄位按 Enter 可再次開啟，Esc 關閉並回到欄位', await page.$eval('#range-pop', (p) => !p.hidden));
await page.keyboard.press('Escape'); await sleep(150);
check('Esc 關閉日曆並把焦點還給欄位', await page.$eval('#range-pop', (p) => p.hidden) && await page.evaluate(() => document.activeElement.id === 'o-range'));
check('主題來源選單勾選前為停用', await page.$eval('[data-source-opt="forum"]', (el) => el.disabled));
await page.click('[data-source="forum"]');
check('勾選後可指定平台', await page.$eval('[data-source-opt="forum"]', (el) => !el.disabled));
await page.select('[data-source-opt="forum"]', 'Ptt');
await shot('31-opview-form');
await page.click('button[type="submit"]');
await sleep(300);
check('送出後顯示需求摘要且標明未送出', (await text('#sub-title'))?.includes('未送出') && (await text('.summary__list'))?.includes('討論區：Ptt') && (await page.$$('.btn--primary')).length === 1);
await shot('32-opview-submitted');
await page.click('[data-action="edit"]');
await sleep(200);
check('修改條件保留已填內容', (await page.$eval('#o-client', (el) => el.value)) === '屈臣氏');
await page.click('[data-action="reset"]');
await sleep(200);
check('重新輸入清空欄位', (await page.$eval('#o-client', (el) => el.value)) === '');

await page.evaluate(() => document.querySelector('a[href="#/guide"]').click());
await sleep(600);
check('使用指南不分頁：一次顯示全部 30 則', (await page.$$('.faq-item')).length === 30 && (await text('.list-count'))?.includes('共 30 則') && !(await page.$('.pagination')));
check('已移除「示範內容」說明框', !(await page.$('.notice--neutral')));
await shot('33-guide');
const faqTag = await page.$eval('.faq-item__q .status-tag', (e) => { const s = getComputedStyle(e); return { cls: e.className, w: Math.round(e.getBoundingClientRect().width), bg: s.backgroundColor, bw: s.borderTopWidth, fs: s.fontSize, r: s.borderTopLeftRadius, icon: !!e.querySelector('svg') }; });
check('問題類型標籤：與「處理中」同樣式（白底灰框、10px、8px 圓角），無圖示', faqTag.cls.includes('status-tag--processing') && faqTag.bg === 'rgb(255, 255, 255)' && faqTag.bw === '1px' && faqTag.fs === '10px' && faqTag.r === '8px' && !faqTag.icon, JSON.stringify(faqTag));
const faqTagW = await page.$$eval('.faq-item__q .status-tag', (els) => els.map((e) => ({ t: e.textContent.trim(), w: Math.round(e.getBoundingClientRect().width), sw: Math.round(e.scrollWidth) })));
check('問題類型標籤寬度隨文字（hug content）：字多的較寬，且文字不被截斷', new Set(faqTagW.map((x) => x.w)).size > 1 && faqTagW.every((x) => x.sw <= x.w + 1), JSON.stringify(faqTagW.slice(0, 3)));
await page.click('.faq-item__q');
await sleep(150);
check('點問題展開答案', await page.$eval('.faq-item', (d) => d.open));
await page.evaluate(() => scrollTo(0, 900)); await sleep(400);
const gs = await page.evaluate(() => ({ filters: Math.round(document.querySelector('.zone--filters').getBoundingClientRect().top), fab: !document.querySelector('.fab-top').hidden }));
check('往下捲：搜尋篩選列黏在頁首下方', gs.filters === 80, JSON.stringify(gs));
check('捲超過門檻後出現「回到最上方」', gs.fab);
await page.click('.fab-top'); await sleep(900);
check('按下回到最上方並隱藏按鈕', (await page.evaluate(() => scrollY)) === 0 && await page.$eval('.fab-top', (b) => b.hidden));
await page.select('#g-cat', '分享與權限');
await sleep(300);
check('問題類型篩選（分享與權限 4 則）並回到第 1 頁', (await page.$$('.faq-item')).length === 4 && !(await page.$('.pagination')));
await page.select('#g-cat', 'all');
await sleep(200);
await page.type('#g-q', '檔案大小');
await sleep(600);
check('搜尋「檔案大小」找到相關問答', (await page.$$('.faq-item')).length >= 1 && (await text('.faq-item__q'))?.includes('大小'));
await page.click('#g-q', { clickCount: 3 });
await page.type('#g-q', 'zzzzz');
await sleep(600);
check('搜尋無結果提供清除條件', !!(await page.$('[data-action="clear"]')));
await page.click('[data-action="clear"]');
await sleep(300);
check('清除後回到全部 30 則', (await text('.list-count'))?.includes('共 30 則'));
await page.goto(BASE + '#/', { waitUntil: 'networkidle0' });
await sleep(300);

// 控制項高度與底部 CTA 50/50
const dims = (sel) => page.$$eval(sel, (els) => els.filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width) }; }));
await go('#/');
const hs1 = [...await dims('.input'), ...await dims('select.select')];
await go('#/create/1');
check('創建新檔頁面背景為白色（無漸層）', await page.$eval('.main', (el) => { const s = getComputedStyle(el); return s.backgroundImage === 'none' && (s.backgroundColor === 'rgba(0, 0, 0, 0)' || s.backgroundColor === 'rgb(255, 255, 255)'); }) && (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(255, 255, 255)');
await go('#/');
check('第一層 tab 選中時文字與底線為 Clue 紫', await page.$eval('.tabs__tab[aria-selected="true"]', (el) => getComputedStyle(el).color === 'rgb(132, 75, 153)' && getComputedStyle(el, '::after').backgroundColor === 'rgb(132, 75, 153)'));
await page.focus('#f-status'); await sleep(400);
check('下拉選單聚焦時只有一條粗線（外框緊貼邊框，無間隙）', await page.$eval('#f-status', (el) => { const s = getComputedStyle(el); return s.outlineOffset === '0px' && s.outlineWidth === '1px' && s.borderTopColor === s.outlineColor; }));
await page.evaluate(() => scrollTo(0, 700)); await sleep(400);
const ls = await page.evaluate(() => ({ tabs: Math.round(document.querySelector('.tabs--list').getBoundingClientRect().top), filters: Math.round(document.querySelector('.zone--filters').getBoundingClientRect().top), fab: !document.querySelector('.fab-top').hidden }));
check('清單往下捲：tab 黏在頁首下方、搜尋篩選列緊接其下', ls.tabs === 80 && ls.filters === 129, JSON.stringify(ls));
check('清單往下捲超過門檻後出現「回到最上方」', ls.fab);
await page.evaluate(() => scrollTo(0, 0)); await sleep(300);
check('頁首已移除「dentsu Pro」按鈕', !(await text('.app-header'))?.includes('dentsu Pro') && !(await page.$('.app-header [data-app]')));
const tagInfo = await page.$$eval('.status-tag', (els) => els.map((e) => { const s = getComputedStyle(e); return { w: Math.round(e.getBoundingClientRect().width), kind: e.className.replace('status-tag status-tag--', ''), bg: s.backgroundColor, fg: s.color, bw: s.borderTopWidth, hasIcon: !!e.querySelector('svg') }; }));
const kinds = Object.fromEntries(tagInfo.map((x) => [x.kind, x]));
check('狀態標籤固定寬度（64px，不隨內容或容器變動）且保留圖示', tagInfo.length >= 5 && tagInfo.every((x) => x.w === 64 && x.hasIcon), JSON.stringify([...new Set(tagInfo.map((x) => x.w))]));
check('狀態標籤：字級 10px、圓角 8px、上下 padding 2px、左右 4px', await page.$eval('.status-tag', (e) => { const s = getComputedStyle(e); return s.fontSize === '10px' && s.borderTopLeftRadius === '8px' && s.paddingTop === '2px' && s.paddingLeft === '4px'; }));
check('已完成＝Clue 紫底白字；處理中＝白底灰框黑字；失敗＝銅褐底白字', kinds.completed.bg === 'rgb(132, 75, 153)' && kinds.completed.fg === 'rgb(255, 255, 255)' && kinds.processing.bg === 'rgb(255, 255, 255)' && kinds.processing.bw === '1px' && kinds.failed.bg === 'rgb(173, 96, 56)' && kinds.failed.fg === 'rgb(255, 255, 255)', JSON.stringify(kinds));
check('Hero 下方已移除分隔線', await page.$eval('.hero', (el) => getComputedStyle(el).borderBottomWidth === '0px'));
await go('#/opview');
check('OpView 索取頁已移除「POC 不會連到 OpView」說明框', !(await page.$('.notice--neutral')));
check('表單不再包在外框線內（無邊框、無左右內距）', await page.$eval('.form-card', (el) => { const s = getComputedStyle(el); return s.borderStyle === 'none' && s.paddingLeft === '0px' && s.paddingRight === '0px'; }));
await go('#/');
check('清單頁 input／下拉高度皆為 50px', hs1.length >= 3 && hs1.every((d) => d.h === 50), JSON.stringify(hs1));
await go('#/create/1');
const hs2 = [...await dims('.input'), ...await dims('select.select'), ...await dims('.wizard-card .btn:not(.btn--sm)')];
check('創建新檔步驟一：input、下拉、按鈕高度皆為 50px', hs2.length >= 6 && hs2.every((d) => d.h === 50), JSON.stringify(hs2));
const foot1 = await dims('.wizard-card__foot .btn');
check('創建新檔底部兩顆按鈕各占 50% 寬', foot1.length === 2 && Math.abs(foot1[0].w - foot1[1].w) <= 1 && foot1[0].h === 50, JSON.stringify(foot1));
for (const s of [1, 2]) {
  await go('#/create/' + s);
  const gap = await page.evaluate(() => { const card = document.querySelector('.wizard-card').getBoundingClientRect(); const bs = [...document.querySelectorAll('.wizard-card__foot .btn')].map((b) => b.getBoundingClientRect()); return { left: Math.round(bs[0].left - card.left), right: Math.round(card.right - bs[1].right), bottom: Math.round(card.bottom - bs[0].bottom) }; });
  check('創建新檔步驟 ' + s + '：按鈕到卡片下緣的距離 = 左右距離', Math.abs(gap.bottom - gap.left) <= 2 && Math.abs(gap.right - gap.left) <= 2, JSON.stringify(gap));
}
await go('#/opview');
const foot2 = await dims('.form-card__foot .btn');
const hs3 = [...await dims('.form-card .input'), ...await dims('.form-card select.select:not(:disabled)')];
check('OpView 索取：底部按鈕 50/50、欄位高度 50px', foot2.length === 2 && Math.abs(foot2[0].w - foot2[1].w) <= 1 && foot2[0].h === 50 && hs3.every((d) => d.h === 50), JSON.stringify([foot2, hs3.length]));
await go('#/analysis/AN-1001');
const foot3 = await dims('.project-actions__main .btn');
check('專案頁底部「下載資料／分享」各占 50% 寬、高 50px', foot3.length === 2 && Math.abs(foot3[0].w - foot3[1].w) <= 1 && foot3[0].h === 50, JSON.stringify(foot3));
const wrap = await page.evaluate(() => { const a = document.querySelector('.project-actions__main').getBoundingClientRect(); const b = document.querySelector('.project-actions').getBoundingClientRect(); return Math.abs(a.width - b.width) < 2; });
check('底部按鈕列撐滿容器', wrap);
await shot('37-bottom-ctas');
await go('#/opview');
const taH = await page.$$eval('textarea', (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
check('多行輸入框（textarea）維持多行高度，不被壓成 50px', taH.length === 2 && taH.every((h) => h > 80), taH.join(','));
const radii = await page.evaluate(() => [...document.querySelectorAll('.input, select.select, textarea, .btn:not(.btn--sm)')].filter((e) => e.offsetParent).map((e) => getComputedStyle(e).borderTopLeftRadius));
check('輸入框、下拉選單、按鈕圓角皆為 8px', radii.length >= 6 && radii.every((r) => r === '8px'), [...new Set(radii)].join(','));
await go('#/');

// 工具切換 lightbox
check('左側 App-Nav 已移除', !(await page.$('.app-nav')));
await page.click('#app-switch-toggle');
await sleep(400);
check('Clue 旁箭頭開啟工具切換 lightbox', await page.$eval('#app-switcher', (d) => d.open) && (await page.$eval('#app-switch-toggle', (b) => b.getAttribute('aria-expanded'))) === 'true');
check('開啟後焦點在目前工具（Clue）', await page.evaluate(() => document.activeElement.dataset.app === 'Clue'));
await shot('29-app-switcher');
await page.keyboard.press('Escape');
await sleep(300);
check('Esc 關閉並把焦點還給箭頭按鈕', !(await page.$eval('#app-switcher', (d) => d.open)) && await page.evaluate(() => document.activeElement.id === 'app-switch-toggle'));
await page.click('#app-switch-toggle');
await sleep(300);
await page.click('[data-app="Wonder"]');
await sleep(300);
check('點其他工具會關閉並提示 POC 未連結', !(await page.$eval('#app-switcher', (d) => d.open)) && (await text('.toast'))?.includes('Wonder'));

// ───────── Mobile 390 ─────────
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
for (const [hash, name] of [['#/', '21-m-workbench'], ['#/opview', '21b-m-opview'], ['#/guide', '21c-m-guide'], ['#/create/1', '22-m-create-step1'], ['#/analysis/AN-1001', '23-m-result'], ['#/analysis/AN-1001/sources?cluster=1', '24-m-sources'], ['#/analysis/AN-1005/articles/W-1693?cluster=5', '25-m-article'], ['#/analysis/AN-1001?tab=clusters&c=5', '26-m-result-clusters'], ['#/analysis/AN-1001?tab=keywords', '26b-m-result-keywords'], ['#/poc', '27-m-poc']]) {
  await go(hash);
  await sleep(300);
  const ox = await overflowX();
  check(`手機 390：${hash} 無水平溢出`, ox <= 0, `overflow ${ox}px`);
  await shot(name);
}
// 手機選單
await go('#/');
await page.click('#menu-toggle');
await sleep(300);
check('手機選單可展開', await page.$eval('#main-nav', (el) => getComputedStyle(el).display !== 'none'));
await page.screenshot({ path: `${SHOTS}28-m-menu.png` });
// 觸控目標
const small = await page.evaluate(() => [...document.querySelectorAll('button, a.btn, .input, .select')]
  .filter((el) => el.offsetParent && el.getBoundingClientRect().height < 44)
  .map((el) => `${el.tagName}.${el.className}`.slice(0, 50)));
check('手機主要控制項觸控高度 ≥ 44px', small.length === 0, small.slice(0, 5).join(', '));

await page.keyboard.press('Escape');
await page.click('#app-switch-toggle');
await sleep(400);
check('手機也可開啟工具切換', await page.$eval('#app-switcher', (d) => d.open));
await page.screenshot({ path: `${SHOTS}30-m-app-switcher.png` });
await page.keyboard.press('Escape');
await sleep(200);
// 建立流程手機 sticky 主行動
await go('#/create/1');
const footPos = await page.$eval('.wizard-card__foot', (el) => getComputedStyle(el).position);
check('手機建立流程主行動固定底部', footPos === 'sticky');

check('沒有對外部服務送出請求', externalRequests.length === 0, externalRequests.slice(0, 3).join(', '));
check('Console 無錯誤', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 項通過`);
process.exit(failed.length ? 1 : 0);
