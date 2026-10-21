// ds-sense 產出 — 清單列「⋯」次選單（WAI-ARIA menu button）與確認對話框，首頁清單與 OpView 索取清單共用
import { html, raw } from '../core/dom.js';
import { icon } from './icons.js';

let menuEl = null;
let menuTrigger = null;
let menuRun = null;
let menuCtx = null;
let menuOpenedAt = 0;

export const isMenuOpenFor = (el) => menuTrigger === el;

function ensureMenu() {
  if (menuEl) return menuEl;
  menuEl = document.createElement('div');
  menuEl.className = 'menu';
  menuEl.id = 'row-menu';
  menuEl.setAttribute('role', 'menu');
  menuEl.hidden = true;
  document.body.append(menuEl);
  menuEl.addEventListener('click', (e) => {
    const item = e.target.closest('[role="menuitem"]');
    if (!item || item.getAttribute('aria-disabled') === 'true') return;
    const run = menuRun; const ctx = menuCtx; const trigger = menuTrigger;
    closeRowMenu({ restoreFocus: false });
    run?.(item.dataset.key, ctx, trigger);
  });
  menuEl.addEventListener('keydown', (e) => {
    const items = [...menuEl.querySelectorAll('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement);
    const go = { ArrowDown: (i + 1) % items.length, ArrowUp: (i - 1 + items.length) % items.length, Home: 0, End: items.length - 1 }[e.key];
    if (go != null) { e.preventDefault(); items[go].focus(); return; }
    if (e.key === 'Escape') { e.preventDefault(); closeRowMenu(); }
    if (e.key === 'Tab') closeRowMenu({ restoreFocus: false });
  });
  document.addEventListener('pointerdown', (e) => {
    if (!menuEl.hidden && !menuEl.contains(e.target) && !e.target.closest('[data-action="row-menu"]')) closeRowMenu({ restoreFocus: false });
  }, true);
  // 捲動／縮放時關閉（固定定位的選單不會跟著按鈕移動）；剛開啟的 250ms 內忽略，避免瀏覽器為了露出按鈕而觸發的捲動把選單關掉
  ['scroll', 'resize', 'hashchange'].forEach((t) => window.addEventListener(t, () => { if (t === 'hashchange' || Date.now() - menuOpenedAt > 250) closeRowMenu({ restoreFocus: false }); }, true));
  return menuEl;
}

/** items：{ key, label, ico, disabled?, hint?, danger? } 或 { sep: true }；run(key, ctx, trigger) */
export function openRowMenu(trigger, { label, items, ctx }, run, focus = 'first') {
  closeRowMenu({ restoreFocus: false });
  const el = ensureMenu();
  menuTrigger = trigger; menuRun = run; menuCtx = ctx;
  el.setAttribute('aria-label', label);
  el.innerHTML = items.map((it) => it.sep ? '<div class="menu__sep" role="separator"></div>'
    : html`<button type="button" role="menuitem" class="menu__item ${it.danger ? 'is-danger' : ''}" data-key="${it.key}" tabindex="-1" ${it.disabled ? raw('aria-disabled="true"') : ''}>
        ${raw(icon(it.ico, { size: 16 }))}<span class="menu__text"><span>${it.label}</span>${it.disabled ? html`<span class="menu__hint">${it.hint}</span>` : ''}</span></button>`).join('');
  el.hidden = false;
  menuOpenedAt = Date.now();
  trigger.setAttribute('aria-expanded', 'true');
  // 定位：預設在按鈕下方、右緣對齊；空間不足時往上開
  const r = trigger.getBoundingClientRect();
  const w = el.offsetWidth; const h = el.offsetHeight;
  const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
  const top = r.bottom + 4 + h > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4;
  el.style.left = `${left}px`; el.style.top = `${top}px`;
  const els = el.querySelectorAll('[role="menuitem"]');
  (focus === 'last' ? els[els.length - 1] : els[0]).focus({ preventScroll: true });
}

export function closeRowMenu({ restoreFocus = true } = {}) {
  if (!menuEl || menuEl.hidden) return;
  menuEl.hidden = true;
  menuTrigger?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) menuTrigger?.focus({ preventScroll: true });
  menuTrigger = null;
}

/** 刪除確認（不可逆：必須確認；原生 <dialog> 提供焦點圈限與 Esc）。doDelete 成功回傳 true */
export function confirmDelete({ title, body, okLabel = '確認刪除', busyLabel = '正在刪除…' }, doDelete, onCancel) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'confirm-dialog';
    dlg.setAttribute('aria-labelledby', 'cd-title');
    dlg.setAttribute('aria-describedby', 'cd-desc');
    dlg.innerHTML = html`
      <h2 class="confirm-dialog__title" id="cd-title">${title}</h2>
      <p id="cd-desc" class="break">${body}</p>
      <p class="field__error" id="cd-error" role="alert" hidden></p>
      <div class="confirm-dialog__actions">
        <button type="button" class="btn btn--secondary" data-cd="cancel">取消</button>
        <button type="button" class="btn btn--danger" data-cd="ok">${okLabel}</button>
      </div>`;
    document.body.append(dlg);
    let busy = false; let done = false;
    const finish = (deleted) => { if (done) return; done = true; dlg.remove(); if (!deleted) onCancel?.(); resolve(deleted); };
    dlg.addEventListener('cancel', (e) => { if (busy) e.preventDefault(); });
    dlg.addEventListener('close', () => finish(false));
    dlg.querySelector('[data-cd="cancel"]').addEventListener('click', () => { if (!busy) dlg.close(); });
    dlg.querySelector('[data-cd="ok"]').addEventListener('click', async (e) => {
      if (busy) return;                       // 防重複送出
      busy = true;
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = busyLabel;
      try {
        await doDelete();
        done = true; dlg.close(); dlg.remove(); resolve(true);
      } catch (err) {
        busy = false;
        e.currentTarget.disabled = false;
        e.currentTarget.textContent = okLabel;
        const er = dlg.querySelector('#cd-error');
        er.hidden = false; er.textContent = '刪除失敗：' + err.message;
      }
    });
    dlg.showModal();
    dlg.querySelector('[data-cd="cancel"]').focus();
  });
}
