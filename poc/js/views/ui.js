// ds-sense 產出 — 共用的小型 UI 片段（DS 元件形似物；DS 套件未安裝，見 README 元件對照）
import { html, raw } from '../core/dom.js';
import { icon } from './icons.js';

export const STATUS = {
  completed: { label: '已完成', tone: 'success', icon: 'check' },
  processing: { label: '處理中', tone: 'neutral', icon: 'clock' },
  failed: { label: '失敗', tone: 'error', icon: 'alert' },
};

export function statusBadge(status) {
  const s = STATUS[status] ?? { label: status, tone: 'neutral', icon: 'clock' };
  return html`<span class="status-tag status-tag--${status in STATUS ? status : 'processing'}">${raw(icon(s.icon, { size: 14 }))}${s.label}</span>`;
}

export function breadcrumb(items) {
  return html`<nav class="breadcrumb" aria-label="麵包屑">
    <ol>${items.map((it, i) => i < items.length - 1
      ? html`<li><a href="${it.href}">${it.label}</a><span class="breadcrumb__sep" aria-hidden="true">›</span></li>`
      : html`<li><span aria-current="page">${it.label}</span></li>`)}</ol>
  </nav>`;
}

export function pageHead({ title, desc, crumbs, actions = '', meta = '' }) {
  return html`<header class="page-head">
    ${crumbs ? breadcrumb(crumbs) : ''}
    <div class="page-head__row">
      <div class="page-head__text">
        <h1 class="page-title" tabindex="-1">${title}</h1>
        ${desc ? html`<p class="page-desc">${desc}</p>` : ''}
        ${meta}
      </div>
      ${actions ? html`<div class="page-head__actions">${actions}</div>` : ''}
    </div>
  </header>`;
}

export function readOnlyNotice(ownerName) {
  return html`<div class="notice notice--readonly" role="note">
    <span class="notice__icon">${raw(icon('lock', { size: 18 }))}</span>
    <div><strong>唯讀檢視</strong>：這份分析由 ${ownerName} 分享給你，你的角色是「檢視者」。可以閱讀結果與查核來源，但無法重新執行、修改或再分享。</div>
  </div>`;
}

export function spinner(label = '載入中…') {
  return html`<div class="loading" role="status"><span class="loading__dot" aria-hidden="true"></span>${label}</div>`;
}

export function errorBlock({ title, body, actions }) {
  return html`<section class="state-block" aria-live="polite">
    <h2 class="state-block__title">${title}</h2>
    <p class="state-block__body">${body}</p>
    <div class="state-block__actions">${actions}</div>
  </section>`;
}
