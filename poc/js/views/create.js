// ds-sense 產出 — B. 三步建立分析（Wizard：漸層底＋白卡＋圓點步驟＋灰上一步／主色下一步）
import { html, raw, on, $, $$, fmtSize, MB, announce } from '../core/dom.js';
import { wizard, DEFAULT_SETTINGS } from '../core/store.js';
import { navigate } from '../core/router.js';
import { createAnalysis } from '../services/mock-service.js';
import { DEMO_DATASET } from '../data/seed.js';
import { INDUSTRIES, matchClients, PROJECT_NAME_RE } from '../data/industries.js';
import { pageHead } from './ui.js';
import { icon } from './icons.js';
import { track } from '../core/telemetry.js';

// POC 設定：沿用現站觀察到的限制；正式規則待工程確認（前後端須一致）
export const LIMITS = {
  ai: { maxFiles: 1, maxTotal: 15 * MB, label: '1 份 CSV／XLSX，15 MB 以內' },
  cluster: { maxFiles: 4, maxTotal: 15 * MB, label: '最多 4 份 CSV／XLSX，合計 15 MB 以內' },
  keyword: { maxFiles: 1, maxTotal: 10 * MB, label: '1 份 CSV／XLSX，10 MB 以內' },
};
const EXT_OK = /\.(csv|xlsx)$/i;
const STEPS = ['專案基本資訊', '資料', '確認'];

// ───────── 驗證 ─────────

const NAME_ERR = '專案命名只能使用中英文字母、數字與 - _，不可有空白或其他符號。';
function validateStep1(d) {
  const e = {};
  const n = d.name.trim();
  if (!n) e.name = '請輸入專案命名，方便之後在「社群口碑分析」清單找到它。';
  else if (!PROJECT_NAME_RE.test(d.name)) e.name = NAME_ERR;
  if (!d.clientName.trim()) e.clientName = '請輸入客戶公司名稱。';
  if (d.clientType === 'new' && !/^\d{8}$/.test(d.taxId || '')) e.taxId = '請輸入 8 碼數字的統一編號。';
  if (!d.industry) e.industry = '請選擇客戶產業大類。';
  else if (!d.subIndustry) e.subIndustry = '請選擇客戶產業子類。';
  return e;
}

/** 回傳每個檔案的檢查結果與整體錯誤（只檢查副檔名、數量、大小；不解析內容） */
export function checkFiles(files, limit) {
  const items = files.map((f) => {
    const errs = [];
    if (!EXT_OK.test(f.name)) errs.push({ type: 'format', msg: '格式不支援：只接受 .csv 或 .xlsx。請另存成這兩種格式後重新選擇。' });
    if (f.size === 0) errs.push({ type: 'empty', msg: '檔案是空的（0 bytes），請確認匯出是否完整。' });
    else if (f.size > limit.maxTotal) errs.push({ type: 'size', msg: `檔案 ${fmtSize(f.size)}，超過 ${limit.maxTotal / MB} MB 上限。請縮小時間範圍或分批分析。` });
    return { file: f, errs };
  });
  const group = [];
  const total = files.reduce((n, f) => n + f.size, 0);
  if (files.length > limit.maxFiles) group.push({ type: 'count', msg: `最多 ${limit.maxFiles} 份，目前 ${files.length} 份。請移除多出的檔案。` });
  if (limit.maxFiles > 1 && total > limit.maxTotal && items.every((i) => !i.errs.some((x) => x.type === 'size'))) {
    group.push({ type: 'total', msg: `合計 ${fmtSize(total)}，超過 ${limit.maxTotal / MB} MB 上限。請移除部分檔案。` });
  }
  const ok = files.length > 0 && group.length === 0 && items.every((i) => i.errs.length === 0);
  return { items, group, total, ok };
}

function validateStep2(d) {
  const kw0 = wizard.keywordFiles.length ? checkFiles(wizard.keywordFiles, LIMITS[d.mode]) : { ok: true };
  if (d.source === 'demo') return { ok: kw0.ok, kw: kw0 };
  const art = checkFiles(wizard.files, LIMITS[d.mode]);
  const kw = wizard.keywordFiles.length ? checkFiles(wizard.keywordFiles, LIMITS[d.mode]) : { ok: true };
  return { ok: art.ok && kw.ok, art, kw, missing: wizard.files.length === 0 };
}

function firstInvalidStep(d) {
  if (Object.keys(validateStep1(d)).length) return 1;
  if (!validateStep2(d).ok) return 2;
  return 3;
}

// ───────── Render ─────────

export function renderCreate(root, { params }) {
  const d = wizard.draft;
  let step = Math.min(Math.max(Number(params.step) || 1, 1), 3);
  // 不允許跳過未完成的步驟
  const reachable = firstInvalidStep(d);
  if (step > reachable) { navigate(`/create/${reachable}`, {}, { replace: true }); return; }
  wizard.update({ step });

  const view = document.createElement('div');
  view.className = 'view view--create';
  view.innerHTML = html`
    <div class="create-wrap">
      ${pageHead({
        title: '創建新檔',
        desc: '依序完成專案基本資訊、資料與確認三個步驟。可以隨時回上一步，已輸入的內容會保留。',
        crumbs: [{ label: '社群口碑分析', href: '#/' }, { label: '創建新檔' }],
      })}
      <ol class="stepper" aria-label="創建新檔步驟">
        ${STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < step ? 'done' : n === step ? 'current' : 'todo';
          return html`<li class="stepper__item stepper__item--${state}" ${n === step ? raw('aria-current="step"') : ''}>
            <span class="stepper__dot" aria-hidden="true">${n < step ? raw(icon('check', { size: 12 })) : n}</span>
            <span class="stepper__label"><span class="sr-only">步驟 ${n}：</span>${label}${n < step ? html`<span class="sr-only">（已完成）</span>` : ''}</span>
          </li>`;
        })}
      </ol>
      <form class="wizard-card" novalidate data-step="${step}">
        <div class="wizard-card__body">${step === 1 ? step1(d) : step === 2 ? step2(d) : step3(d)}</div>
        <div class="wizard-card__foot">
          ${step === 1
            ? html`<a class="btn btn--secondary" href="#/">返回社群口碑分析</a>`
            : html`<button type="button" class="btn btn--secondary" data-action="prev">${raw(icon('arrowLeft', { size: 16 }))}<span>上一步</span></button>`}
          ${step < 3
            ? html`<button type="submit" class="btn btn--primary" data-action="next">下一步${raw(icon('arrowRight', { size: 16 }))}</button>`
            : html`<button type="submit" class="btn btn--primary" data-action="start">開始分析</button>`}
        </div>
      </form>
    </div>`;
  root.replaceChildren(view);
  window.scrollTo(0, 0);

  const form = $('form', view);
  on(view, 'click', '[data-action="prev"]', () => navigate(`/create/${step - 1}`));
  if (step === 1) bindStep1(view, form);
  if (step === 2) bindStep2(view, form);
  if (step === 3) bindStep3(view, form);
}

// ───────── Step 1：專案基本資訊 ─────────

const COMMERCE_URL = 'https://findbiz.nat.gov.tw/';

function step1(d) {
  const existing = d.clientType !== 'new';
  const subs = d.industry ? INDUSTRIES[d.industry] : [];
  return html`
    <h2 class="wizard-card__title wizard-card__title--brand">專案基本資訊</h2>
    <p class="wizard-card__desc">為了讓分析資料更加準確，請詳細填入或勾選以下資料 <span class="req" aria-hidden="true">*</span> 為必填選項</p>

    <div class="field">
      <label class="field__label" for="f-name">專案命名 <span class="req" aria-hidden="true">*</span><span class="sr-only">（必填）</span></label>
      <input id="f-name" name="name" class="input" type="text" value="${d.name}" maxlength="60" autocomplete="off" placeholder="輸入專案名稱(中英文大小寫字母與數字,避免使用 - _ 以外的符號與空白)" aria-describedby="name-error">
      <p class="field__error" id="name-error" hidden></p>
    </div>

    <fieldset class="fieldset">
      <legend class="field__label">請選擇客戶屬性 <span class="req" aria-hidden="true">*</span><span class="sr-only">（必填）</span></legend>
      <div class="radio-row">
        <label class="radio"><input type="radio" name="clientType" value="existing" ${existing ? 'checked' : ''}><span>既有客戶</span></label>
        <label class="radio"><input type="radio" name="clientType" value="new" ${existing ? '' : 'checked'}><span>創建新客戶</span></label>
      </div>
    </fieldset>

    <div class="client-grid ${existing ? '' : 'client-grid--new'}">
      <div class="client-grid__left">
        <div class="field">
          <label class="field__label" for="f-clientName">${existing ? '輸入客戶公司名稱' : '公司名稱'} <span class="req" aria-hidden="true">*</span><span class="sr-only">（必填）</span></label>
          <input id="f-clientName" name="clientName" class="input" type="text" value="${d.clientName}" maxlength="60" autocomplete="off" placeholder="${existing ? '輸入客戶公司名稱進行搜尋' : '請輸入公司名稱'}" aria-describedby="clientName-error client-note">
          <p class="field__error" id="clientName-error" hidden></p>
        </div>
        ${existing ? html`<button type="button" class="btn btn--secondary btn--block" data-action="match" ${d.clientName.trim() ? '' : 'disabled'}><span class="ai-chip" aria-hidden="true">AI</span>搜尋比對</button>
        <p class="field__hint" id="client-note" aria-live="polite">${d.matchNote || 'POC 的比對只會查詢示範客戶清單（不是真實客戶主檔，也沒有使用 AI 模型）。'}</p>
        <p class="field__help">若您不清楚公司名稱，請至<a class="text-link text-link--inline" href="${COMMERCE_URL}" target="_blank" rel="noopener noreferrer">商工登記網站</a>查詢<span class="sr-only">（外部網站，開新分頁）</span></p>` : html`<p class="field__help" id="client-note">若您不清楚客戶公司名稱，請至<a class="text-link text-link--inline" href="${COMMERCE_URL}" target="_blank" rel="noopener noreferrer">商工登記</a>查詢<span class="sr-only">（外部網站，開新分頁）</span></p>`}
      </div>

      ${existing ? '' : html`<div class="client-grid__mid">
        <div class="field">
          <label class="field__label" for="f-taxId">統編 <span class="req" aria-hidden="true">*</span><span class="sr-only">（必填）</span></label>
          <input id="f-taxId" name="taxId" class="input" type="text" inputmode="numeric" maxlength="8" value="${d.taxId || ''}" autocomplete="off" placeholder="請輸入統一編號" aria-describedby="taxId-error">
          <p class="field__error" id="taxId-error" hidden></p>
        </div>
      </div>`}

      <div class="client-grid__right">
        <div class="field">
          <span class="field__label"><label for="f-industry">客戶產業大類</label>
            <button type="button" class="info-btn" data-action="info" aria-expanded="false" aria-controls="industry-info" aria-label="產業分類說明">${raw(icon('info', { size: 16 }))}</button>
            <span class="req" aria-hidden="true">*</span><span class="sr-only">（必填）</span></span>
          <p class="field__hint" id="industry-info" hidden>產業分類為 POC 示範選項；正式分類沿用公司內部產業標準（待確認）。</p>
          <select id="f-industry" name="industry" class="select" aria-describedby="industry-error">
            <option value="">請選擇產業大類</option>
            ${Object.keys(INDUSTRIES).map((k) => html`<option value="${k}" ${d.industry === k ? 'selected' : ''}>${k}</option>`)}
          </select>
          <p class="field__error" id="industry-error" hidden></p>
        </div>
        <div class="field">
          <label class="field__label" for="f-subIndustry">客戶產業子類 <span class="req" aria-hidden="true">*</span><span class="sr-only">（必填）</span></label>
          <select id="f-subIndustry" name="subIndustry" class="select" ${d.industry ? '' : 'disabled'} aria-describedby="subIndustry-error sub-hint">
            <option value="">請選擇產業子類</option>
            ${subs.map((k) => html`<option value="${k}" ${d.subIndustry === k ? 'selected' : ''}>${k}</option>`)}
          </select>
          <p class="field__hint" id="sub-hint">${d.industry ? '' : '請先選擇產業大類。'}</p>
          <p class="field__error" id="subIndustry-error" hidden></p>
        </div>
      </div>
    </div>`;
}

function showError(view, id, msg) {
  const el = $(`#${id}-error`, view);
  const input = $(`#f-${id}`, view);
  if (!el) return;
  el.hidden = !msg;
  el.innerHTML = msg ? `${icon('alert', { size: 14 })}<span></span>` : '';
  if (msg) el.lastChild.textContent = msg;
  if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

/** 「下一步」在必填未完成時呈現灰色（aria-disabled），仍可操作以顯示缺少哪些欄位 */
function syncNext(view) {
  const btn = $('[data-action="next"]', view);
  if (!btn) return;
  const incomplete = Object.keys(validateStep1(wizard.draft)).length > 0;
  btn.setAttribute('aria-disabled', incomplete ? 'true' : 'false');
}

function bindStep1(view, form) {
  const rerender = () => { const body = $('.wizard-card__body', view); body.innerHTML = step1(wizard.draft); syncNext(view); };
  syncNext(view);

  $('#f-name', view).addEventListener('input', (e) => {
    wizard.update({ name: e.target.value });
    showError(view, 'name', '');
    syncNext(view);
  });
  on(view, 'input', '#f-clientName', (e) => {
    wizard.update({ clientName: e.target.value, matchNote: '' });
    showError(view, 'clientName', '');
    const m = $('[data-action="match"]', view);
    if (m) m.disabled = !e.target.value.trim();
    syncNext(view);
  });
  on(view, 'input', '#f-taxId', (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 8);
    e.target.value = v;
    wizard.update({ taxId: v });
    showError(view, 'taxId', '');
    syncNext(view);
  });
  on(view, 'change', 'input[name="clientType"]', (e, el) => {
    wizard.update({ clientType: el.value, matchNote: '' });
    rerender();
    $(`input[name="clientType"][value="${el.value}"]`, view).focus();
  });
  on(view, 'change', '#f-industry', (e) => {
    wizard.update({ industry: e.target.value, subIndustry: '', matchNote: wizard.draft.matchNote });
    showError(view, 'industry', '');
    rerender();
    $('#f-subIndustry', view).focus();
  });
  on(view, 'change', '#f-subIndustry', (e) => {
    wizard.update({ subIndustry: e.target.value });
    showError(view, 'subIndustry', '');
    syncNext(view);
  });
  on(view, 'click', '[data-action="info"]', (e, el) => {
    const p = $('#industry-info', view);
    p.hidden = !p.hidden;
    el.setAttribute('aria-expanded', String(!p.hidden));
  });
  // AI 搜尋比對（POC 模擬：只比對示範客戶清單）
  on(view, 'click', '[data-action="match"]', async (e, el) => {
    const text = wizard.draft.clientName;
    el.disabled = true;
    el.setAttribute('aria-busy', 'true');
    await new Promise((r) => setTimeout(r, 600));
    const hits = matchClients(text);
    if (hits.length) {
      const h = hits[0];
      wizard.update({ clientName: h.name, industry: h.industry, subIndustry: h.sub, matchNote: `找到示範客戶「${h.name}」，已帶入產業類別（${h.industry} › ${h.sub}）。可自行修改。` });
      track('client_match_completed', { result: 'found' });
    } else {
      wizard.update({ matchNote: `示範客戶清單中沒有符合「${text.trim()}」的客戶。請確認公司名稱，或改選「創建新客戶」。` });
      track('client_match_completed', { result: 'not-found' });
    }
    rerender();
    announce(wizard.draft.matchNote);
    $('[data-action="match"]', view)?.focus();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const errs = validateStep1(wizard.draft);
    ['name', 'clientName', 'taxId', 'industry', 'subIndustry'].forEach((k) => showError(view, k, errs[k] || ''));
    const first = Object.keys(errs)[0];
    if (first) { $(`#f-${first}`, view).focus(); announce(`還有 ${Object.keys(errs).length} 個必填欄位需要修正`); return; }
    track('analysis_mode_selected', { mode: wizard.draft.mode });
    navigate('/create/2');
  });
}

// ───────── Step 2：資料 ─────────

const PLATFORMS = {
  opview: { label: 'OpView', fit: '上傳由 OpView 匯出的社群文章檔（CSV／XLSX）。' },
  keypo: { label: 'Keypo', fit: '上傳由 Keypo 匯出的社群文章檔（CSV／XLSX）。' },
  qsearch: { label: 'Qsearch', fit: '上傳由 Qsearch 匯出的社群文章檔（CSV／XLSX）。' },
};

function step2(d) {
  return html`
    <h2 class="wizard-card__title wizard-card__title--brand">資料來源</h2>
    <p class="wizard-card__desc">選擇文章資料的來源平台，再上傳該平台匯出的檔案。沒有檔案時，可以改用範本資料完整走一次流程。</p>
    <fieldset class="fieldset">
      <legend class="field__label">資料來源 <span class="req" aria-hidden="true">*</span><span class="sr-only">（必填）</span></legend>
      <div class="choice-grid choice-grid--3">
        ${Object.entries(PLATFORMS).map(([key, p]) => html`<div class="choice-card choice-card--split ${d.platform === key ? 'is-selected' : ''}">
          <label class="choice-card__label">
            <input type="radio" name="platform" value="${key}" class="choice-card__input" ${d.platform === key ? 'checked' : ''}>
            <span class="choice-card__title">${p.label}</span>
            <span class="choice-card__fit">${key === 'opview' ? '還沒有文章檔？先到索取頁填寫條件，取得匯出檔後再回來上傳。已填的內容會保留。' : p.fit}</span>
          </label>
          ${key === 'opview' ? html`<a class="text-link choice-card__link" href="#/opview">前往索取頁${raw(icon('chevronRight', { size: 14 }))}</a>` : ''}
        </div>`)}
      </div>
    </fieldset>
    <div id="source-panel">${d.source === 'demo' ? demoPanel() : localPanel(d)}</div>
    <div id="keyword-panel">${keywordPanel(d)}</div>`;
}

function demoPanel() {
  const f = (file, meta) => html`<li class="file-item file-item--ok">
        <span class="file-item__type">XLSX</span>
        <span class="file-item__main"><span class="file-item__name">${file.name}</span>
          <span class="file-item__meta">${fmtSize(file.size)} · ${meta}</span></span>
        <span class="file-item__status">${raw(icon('check', { size: 14 }))}可使用</span>
      </li>`;
  return html`<section class="subpanel" aria-label="範本資料內容">
    <h3 class="subpanel__title">範本資料內容</h3>
    <ul class="file-list">
      ${f(DEMO_DATASET.articleFile, `社群文章 · ${DEMO_DATASET.note}`)}
    </ul>
    <p class="field__hint">範本為 OpView 匯出格式，無論選擇哪個來源平台都可使用。</p>
    <button type="button" class="btn btn--secondary btn--sm" data-action="use-local">改為上傳本機檔案</button>
  </section>`;
}

function localPanel(d) {
  const lim = LIMITS[d.mode];
  return html`<section class="subpanel" aria-labelledby="upload-title">
    <h3 class="subpanel__title" id="upload-title">文章檔案</h3>
    <p class="subpanel__rule">文章檔：${lim.label}（1 MB = 1,048,576 bytes）。</p>
    ${wizard.lostFiles ? html`<div class="notice notice--warn" role="alert">${raw(icon('alert', { size: 18 }))}
      <div>頁面重新整理後，瀏覽器不會保留已選的檔案（${wizard.draft.fileMeta.map((f) => f.name).join('、')}）。請重新選擇檔案。</div></div>` : ''}
    <label class="dropzone" for="f-files" data-drop="article">
      ${raw(icon('upload', { size: 24 }))}
      <span class="dropzone__main">拖曳檔案到這裡，或<span class="dropzone__link">點選選擇檔案</span></span>
      <span class="dropzone__hint">CSV、XLSX · ${lim.maxFiles > 1 ? `最多 ${lim.maxFiles} 份` : '1 份'}</span>
    </label>
    <input id="f-files" class="visually-hidden-input" type="file" accept=".csv,.xlsx" ${lim.maxFiles > 1 ? 'multiple' : ''} aria-describedby="file-check-note">
    <div id="file-results" aria-live="polite"></div>
    <p class="field__help">沒有檔案？<button type="button" class="text-link text-link--btn text-link--inline" data-action="use-demo">改用範本資料（屈臣氏 2022Q4 測試資料）</button></p>
    <p class="field__hint" id="file-check-note">${raw(icon('alert', { size: 14 }))} POC 只完成檔案基本檢查（副檔名、數量、大小），<strong>未解析 CSV／XLSX 內容與欄位</strong>；結果頁將以屈臣氏範本資料呈現。</p>
  </section>`;
}

function keywordPanel(d) {
  return html`<section class="subpanel" aria-labelledby="kw-title">
    <h3 class="subpanel__title" id="kw-title">自訂關鍵字 <span class="optional">選填</span></h3>
    <p class="subpanel__rule">用途：提供品牌名、產品名、俗稱或競品名，讓分析辨識主題時優先參考。可略過；正式版是否必填待確認。格式：${LIMITS[wizard.draft.mode].label}（與文章檔相同）。</p>
    ${wizard.lostKeyword ? html`<div class="notice notice--warn" role="alert">${raw(icon('alert', { size: 18 }))}<div>頁面重新整理後未保留關鍵字檔（${wizard.draft.keywordMeta.map((f) => f.name).join('、')}），需要時請重新選擇。</div></div>` : ''}
    <label class="dropzone" for="f-kw" data-drop="keyword">
      ${raw(icon('upload', { size: 24 }))}
      <span class="dropzone__main">拖曳檔案到這裡，或<span class="dropzone__link">點選選擇檔案</span></span>
      <span class="dropzone__hint">CSV、XLSX · ${LIMITS[wizard.draft.mode].maxFiles > 1 ? `最多 ${LIMITS[wizard.draft.mode].maxFiles} 份` : '1 份'}</span>
    </label>
    <input id="f-kw" class="visually-hidden-input" type="file" accept=".csv,.xlsx" ${LIMITS[wizard.draft.mode].maxFiles > 1 ? 'multiple' : ''}>
    <div id="kw-results" aria-live="polite"></div>
    ${d.source === 'demo' ? html`<p class="field__hint">未上傳時，使用範本的自訂關鍵字（${DEMO_DATASET.keywordFile.name}，${fmtSize(DEMO_DATASET.keywordFile.size)}）。</p>` : ''}
  </section>`;
}

function fileList(check, kind) {
  if (!check.items.length) return '';
  return html`
    ${check.group.map((g) => html`<p class="field__error field__error--block" role="alert">${raw(icon('alert', { size: 14 }))}<span>${g.msg}</span></p>`)}
    <ul class="file-list">
      ${check.items.map(({ file, errs }, i) => html`<li class="file-item ${errs.length ? 'file-item--error' : 'file-item--ok'}">
        <span class="file-item__type">${(file.name.split('.').pop() || '?').slice(0, 4).toUpperCase()}</span>
        <span class="file-item__main">
          <span class="file-item__name">${file.name}</span>
          <span class="file-item__meta">${fmtSize(file.size)}</span>
          ${errs.map((er) => html`<span class="file-item__error">${er.msg}</span>`)}
        </span>
        <span class="file-item__status">${errs.length ? html`${raw(icon('alert', { size: 14 }))}需修正` : html`${raw(icon('check', { size: 14 }))}通過基本檢查`}</span>
        <button type="button" class="icon-btn" data-action="remove-file" data-kind="${kind}" data-index="${i}" aria-label="移除 ${file.name}">${raw(icon('close', { size: 16 }))}</button>
      </li>`)}
    </ul>`;
}

function bindStep2(view, form) {
  const d = wizard.draft;
  const renderLists = () => {
    if ($('#file-results', view)) $('#file-results', view).innerHTML = fileList(checkFiles(wizard.files, LIMITS[d.mode]), 'article');
    if ($('#kw-results', view)) $('#kw-results', view).innerHTML = wizard.keywordFiles.length ? fileList(checkFiles(wizard.keywordFiles, LIMITS[d.mode]), 'keyword') : '';
  };
  const bindInputs = () => {
    const fi = $('#f-files', view);
    if (fi) fi.addEventListener('change', () => { addArticleFiles([...fi.files]); fi.value = ''; });
  };
  const addArticleFiles = (picked) => {
    if (!picked.length) return;
    // 不因單一檔案失敗而清除其他有效輸入：新檔加到既有清單；單檔模式則替換
    const lim = LIMITS[d.mode];
    wizard.setFiles(lim.maxFiles === 1 ? picked : [...wizard.files, ...picked]);
    const res = checkFiles(wizard.files, lim);
    track('upload_validation_completed', {
      result: res.ok ? 'pass' : 'fail',
      errorTypes: [...new Set([...res.group.map((g) => g.type), ...res.items.flatMap((i) => i.errs.map((x) => x.type))])],
      fileCount: wizard.files.length,
    });
    renderLists();
    announce(res.ok ? '檔案通過基本檢查' : '檔案有需要修正的問題，請查看清單');
  };

  renderLists();
  bindInputs();

  on(view, 'change', 'input[name="platform"]', (e, el) => {
    wizard.update({ platform: el.value });
    $$('.choice-card', view).forEach((c) => { const i = $('input', c); if (i) c.classList.toggle('is-selected', i.value === el.value); });
  });
  const renderPanel = (focusSel) => {
    $('#source-panel', view).innerHTML = d.source === 'demo' ? demoPanel() : localPanel(d);
    $('#keyword-panel', view).innerHTML = keywordPanel(d);
    bindInputs();
    renderLists();
    if (focusSel) $(focusSel, view)?.focus();
  };
  on(view, 'click', '[data-action="use-local"]', () => { wizard.update({ source: 'local' }); renderPanel('.dropzone'); });
  on(view, 'click', '[data-action="use-demo"]', () => { wizard.update({ source: 'demo' }); renderPanel('[data-action="use-local"]'); });
  // 自訂關鍵字：規則與文章檔完全相同（同樣的數量與大小限制）
  const addKeywordFiles = (picked) => {
    if (!picked.length) return;
    const lim = LIMITS[d.mode];
    wizard.setKeywordFiles(lim.maxFiles === 1 ? picked : [...wizard.keywordFiles, ...picked]);
    const res = checkFiles(wizard.keywordFiles, lim);
    track('upload_validation_completed', {
      result: res.ok ? 'pass' : 'fail',
      errorTypes: [...new Set([...res.group.map((g) => g.type), ...res.items.flatMap((i) => i.errs.map((x) => x.type))])],
      fileCount: wizard.keywordFiles.length, target: 'keyword',
    });
    renderLists();
    announce(res.ok ? '關鍵字檔通過基本檢查' : '關鍵字檔有需要修正的問題，請查看清單');
  };
  on(view, 'change', '#f-kw', (e) => { const picked = [...e.target.files]; e.target.value = ''; addKeywordFiles(picked); });
  on(view, 'click', '[data-action="remove-file"]', (e, el) => {
    const idx = Number(el.dataset.index);
    if (el.dataset.kind === 'keyword') wizard.setKeywordFiles(wizard.keywordFiles.filter((_, i) => i !== idx));
    else wizard.setFiles(wizard.files.filter((_, i) => i !== idx));
    renderLists();
    announce('已移除檔案');
    ($('[data-action="remove-file"]', view) || $('.dropzone', view) || $('#f-kw', view))?.focus();
  });

  // 拖放（桌面）
  on(view, 'dragover', '[data-drop]', (e, el) => { e.preventDefault(); el.classList.add('is-dragover'); });
  on(view, 'dragleave', '[data-drop]', (e, el) => el.classList.remove('is-dragover'));
  on(view, 'drop', '[data-drop]', (e, el) => {
    e.preventDefault();
    el.classList.remove('is-dragover');
    if (el.dataset.drop === 'keyword') addKeywordFiles([...e.dataTransfer.files]);
    else addArticleFiles([...e.dataTransfer.files]);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = validateStep2(wizard.draft);
    if (!v.ok) {
      if (v.missing) {
        $('#file-results', view).innerHTML = html`<p class="field__error field__error--block" role="alert">${raw(icon('alert', { size: 14 }))}<span>請選擇至少 1 份文章檔，或改用範本資料。</span></p>`;
      } else {
        renderLists();
      }
      ($('.file-item--error [data-action="remove-file"]', view) || $('.dropzone', view))?.focus();
      announce('資料有需要修正的地方');
      return;
    }
    wizard.clearLostFileHints();
    navigate('/create/3');
  });
}

// ───────── Step 3：確認 ─────────

function step3(d) {
  const files = d.source === 'demo' ? [DEMO_DATASET.articleFile] : wizard.files;
  const kwFiles = wizard.keywordFiles.length ? wizard.keywordFiles : d.source === 'demo' ? [DEMO_DATASET.keywordFile] : [];
  return html`
    <h2 class="wizard-card__title wizard-card__title--brand">確認並開始</h2>
    <p class="wizard-card__desc">確認摘要與設定。送出後會開始<strong>模擬處理</strong>，不會執行真實 AI 分析。</p>

    <section class="summary" aria-labelledby="sum-task">
      <div class="summary__head"><h3 id="sum-task" class="summary__title">專案基本資訊</h3><a href="#/create/1" class="text-link">修改</a></div>
      <dl class="summary__list">
        <div><dt>專案命名</dt><dd class="break">${d.name}</dd></div>
        <div><dt>客戶</dt><dd class="break">${d.clientName}（${d.clientType === 'new' ? '新客戶' : '既有客戶'}）</dd></div>
        ${d.clientType === 'new' ? html`<div><dt>統編</dt><dd class="num">${d.taxId}</dd></div>` : ''}
        <div><dt>客戶產業</dt><dd>${d.industry} › ${d.subIndustry}</dd></div>
      </dl>
    </section>

    <section class="summary" aria-labelledby="sum-data">
      <div class="summary__head"><h3 id="sum-data" class="summary__title">資料</h3><a href="#/create/2" class="text-link">修改</a></div>
      <dl class="summary__list">
        <div><dt>資料來源平台</dt><dd>${PLATFORMS[d.platform || 'opview'].label}</dd></div>
        <div><dt>檔案</dt><dd>${d.source === 'demo' ? '範本資料（屈臣氏 2022Q4 測試資料）' : '本機檔案（只完成基本檢查，未解析內容）'}</dd></div>
        <div><dt>文章檔</dt><dd><ul class="plain-list">${files.map((f) => html`<li class="break">${f.name}${f.size != null ? html` <span class="muted">· ${fmtSize(f.size)}</span>` : ''}</li>`)}</ul></dd></div>
        <div><dt>自訂關鍵字</dt><dd>${kwFiles.length ? html`<ul class="plain-list">${kwFiles.map((f) => html`<li class="break">${f.name} <span class="muted">· ${fmtSize(f.size)}</span></li>`)}</ul>` : '未提供（選填）'}</dd></div>
      </dl>
    </section>

    <section class="summary" aria-labelledby="sum-set">
      <div class="summary__head"><h3 id="sum-set" class="summary__title">設定</h3></div>
      <dl class="summary__list">
        <div><dt>分群數量</dt><dd>由模型依資料決定 <span class="demo-note">（POC 範本結果為 6 群；正式是否開放設定待分析負責人確認）</span></dd></div>
        <div><dt>關鍵字處理</dt><dd>套用自訂關鍵字的新增／刪除清單</dd></div>
        <div><dt>輸出內容</dt><dd>話題洞察、分群摘要、關鍵字總表、摘要統整</dd></div>
      </dl>
    </section>

    <section class="summary" aria-labelledby="sum-share">
      <div class="summary__head"><h3 id="sum-share" class="summary__title">可見對象</h3></div>
      <p class="summary__text">僅自己。POC 不會建立分享、不會發送通知。</p>
    </section>
    <p class="form-status" id="submit-status" role="status"></p>`;
}

function bindStep3(view, form) {
  const d = wizard.draft;

  let submitting = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;                        // 防重複送出（第一道：UI）
    submitting = true;
    const btn = $('[data-action="start"]', view);
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = '正在建立…';
    $('#submit-status', view).textContent = '正在建立分析，請稍候。';
    try {
      const payload = {
        name: d.name.trim(), clientName: d.clientName, clientType: d.clientType, taxId: d.clientType === 'new' ? d.taxId : '', industry: d.industry, subIndustry: d.subIndustry, mode: d.mode, researchQuestion: '',
        source: d.source,
        platform: d.platform || 'opview',
        files: d.source === 'demo' ? [DEMO_DATASET.articleFile] : wizard.files.map((f) => ({ name: f.name, size: f.size })),
        keywordFiles: wizard.keywordFiles.length ? wizard.keywordFiles.map((f) => ({ name: f.name, size: f.size })) : d.source === 'demo' ? [DEMO_DATASET.keywordFile] : [],
        settings: d.settings[d.mode] || {},
      };
      const an = await createAnalysis(payload, d.key);   // 第二道：冪等鍵
      track('analysis_submitted', { mode: an.mode, source: d.source, analysisId: an.id });
      wizard.reset();
      navigate(`/analysis/${an.id}`);
    } catch (err) {
      submitting = false;
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = '開始分析';
      $('#submit-status', view).textContent = `建立失敗：${err.message}。輸入內容已保留，請再試一次。`;
    }
  });
}
