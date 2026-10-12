// ds-sense 產出 — 「分享專案」右側滑出面板（原生 <dialog>：焦點圈限、Esc 關閉、關閉後焦點回到觸發按鈕）
// POC：選擇 Email 後只更新本機示範資料中的可見對象，不寄信、不改正式權限。
import { html, raw, on, $, announce, toast } from '../core/dom.js';
import { shareDirectory, shareAnalysis, shareInfo } from '../services/mock-service.js';
import { icon } from './icons.js';
import { track } from '../core/telemetry.js';

let wired = false;

function dlgEl() {
  let d = document.getElementById('share-drawer');
  if (!d) {
    d = document.createElement('dialog');
    d.id = 'share-drawer';
    d.className = 'drawer';
    d.setAttribute('aria-labelledby', 'drawer-title');
    document.body.append(d);
  }
  if (!wired) {
    wired = true;
    // 點背景（面板外）關閉；面板內容有自己的 inner 容器，所以點到 dialog 本身就是背景
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  }
  return d;
}

export function openShareDrawer(an, { onShared } = {}) {
  const dlg = dlgEl();
  const canShare = an.access === 'owner';
  const dir = shareDirectory();
  const members = new Set(an.sharedWith.map((s) => s.userId));
  const selected = new Set();
  let query = '';
  let busy = false;

  const inner = document.createElement('div');
  inner.className = 'drawer__inner';
  dlg.replaceChildren(inner);

  const list = () => {
    const q = query.trim().toLowerCase();
    const rows = dir.filter((u) => !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
    if (!rows.length) return html`<p class="drawer__empty">找不到符合「${query}」的信箱。</p>`;
    return html`<ul class="drawer__list">${rows.map((u) => {
      const shared = members.has(u.id);
      return html`<li><label class="share-row ${shared ? 'is-shared' : ''}">
        <input type="checkbox" value="${u.id}" ${shared || selected.has(u.id) ? 'checked' : ''} ${shared ? 'disabled' : ''}>
        <span class="share-row__email">${u.email}</span>${shared ? html`<span class="share-row__tag">已分享</span>` : ''}
      </label></li>`;
    })}</ul>`;
  };

  if (canShare) {
    inner.innerHTML = html`
      <button type="button" class="drawer__close icon-btn" data-d="close" aria-label="關閉">${raw(icon('close', { size: 22 }))}</button>
      <h2 class="drawer__title" id="drawer-title">分享專案</h2>
      <p class="drawer__sub break">${an.name}</p>
      <div class="field">
        <label class="field__label" for="d-search">請選擇分享的 Email 信箱 <span class="req" aria-hidden="true">*</span><span class="sr-only">（必填）</span></label>
        <input id="d-search" class="input" type="search" placeholder="搜尋信箱" autocomplete="off">
      </div>
      <div class="drawer__box" tabindex="0" role="region" aria-label="信箱清單，可捲動" id="d-list"></div>
      <p class="field__hint" id="d-hint" aria-live="polite">被分享的人只能檢視（唯讀）。POC 不會寄送通知，也不會變更正式權限。</p>
      <p class="field__error" id="d-error" role="alert" hidden></p>
      <button type="button" class="btn btn--primary btn--block drawer__submit" data-d="submit" aria-disabled="true">分享</button>`;
    const refresh = () => {
      $('#d-list', inner).innerHTML = list();
      $('[data-d="submit"]', inner).setAttribute('aria-disabled', selected.size ? 'false' : 'true');
      $('#d-hint', inner).textContent = selected.size ? `已選取 ${selected.size} 個信箱，被分享的人只能檢視（唯讀）。` : '被分享的人只能檢視（唯讀）。POC 不會寄送通知，也不會變更正式權限。';
    };
    refresh();
    $('#d-search', inner).addEventListener('input', (e) => { query = e.target.value; refresh(); });
    on(inner, 'change', 'input[type="checkbox"]', (e, el) => {
      if (el.checked) selected.add(el.value); else selected.delete(el.value);
      $('#d-error', inner).hidden = true;
      $('[data-d="submit"]', inner).setAttribute('aria-disabled', selected.size ? 'false' : 'true');
      $('#d-hint', inner).textContent = selected.size ? `已選取 ${selected.size} 個信箱，被分享的人只能檢視（唯讀）。` : '被分享的人只能檢視（唯讀）。POC 不會寄送通知，也不會變更正式權限。';
    });
    on(inner, 'click', '[data-d="submit"]', async (e, el) => {
      if (busy) return;
      if (!selected.size) {
        const er = $('#d-error', inner);
        er.hidden = false;
        er.innerHTML = `${icon('alert', { size: 14 })}<span>請至少選擇 1 個 Email 信箱。</span>`;
        $('#d-search', inner).focus();
        return;
      }
      busy = true;
      el.setAttribute('aria-busy', 'true');
      el.textContent = '正在分享…';
      try {
        const n = selected.size;
        const updated = await shareAnalysis(an.id, [...selected]);
        track('analysis_shared', { analysisId: an.id, result: 'shared', fileCount: n });
        dlg.close();
        toast(`已分享給 ${n} 位（POC：僅更新本機示範資料，未寄送通知）`);
        announce(`已分享給 ${n} 位`);
        onShared?.(updated);
      } catch (err) {
        busy = false;
        el.removeAttribute('aria-busy');
        el.textContent = '分享';
        const er = $('#d-error', inner);
        er.hidden = false;
        er.innerHTML = `${icon('alert', { size: 14 })}<span>分享失敗：${err.message}</span>`;
      }
    });
  } else {
    // 檢視者：只能查看可見對象，不能新增
    const info = shareInfo(an);
    inner.innerHTML = html`
      <button type="button" class="drawer__close icon-btn" data-d="close" aria-label="關閉">${raw(icon('close', { size: 22 }))}</button>
      <h2 class="drawer__title" id="drawer-title">可見對象</h2>
      <p class="drawer__sub break">${an.name}</p>
      <div class="notice notice--readonly" role="note">${raw(icon('lock', { size: 18 }))}<div>你是檢視者，無法新增分享對象。</div></div>
      <ul class="member-list">
        <li><span class="avatar" aria-hidden="true">${info.owner.name.slice(0, 1)}</span><span>${info.owner.name}</span><span class="role-chip">擁有者</span></li>
        ${info.members.map((m) => html`<li><span class="avatar" aria-hidden="true">${m.name.slice(0, 1)}</span><span>${m.name}${m.id === 'u-lin' ? '（你）' : ''}</span><span class="role-chip">${raw(icon('lock', { size: 12 }))}檢視者（唯讀）</span></li>`)}
      </ul>`;
  }
  on(inner, 'click', '[data-d="close"]', () => dlg.close());
  dlg.showModal();
  ($('#d-search', inner) || $('[data-d="close"]', inner)).focus();
}
