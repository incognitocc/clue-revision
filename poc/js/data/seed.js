// ds-sense 產出 — Clue POC 種子資料
// 專案清單是示範用；已完成專案的結果一律以「屈臣氏 2022Q4 測試資料」範本呈現（見 watsons.js）。
// 使用者名稱為虛構。

import { WATSONS } from './watsons.js';

export const CURRENT_USER = { id: 'u-lin', name: '林示範', initial: '林' };

export const USERS = {
  'u-lin': { id: 'u-lin', name: '林示範', email: 'lin.demo@example.com' },
  'u-wang': { id: 'u-wang', name: '王示範', email: 'wang.demo@example.com' },
  'u-chang': { id: 'u-chang', name: '張示範', email: 'chang.demo@example.com' },
  'u-chen': { id: 'u-chen', name: '陳示範', email: 'chen.demo@example.com' },
};

// 「分享專案」面板使用的 Email 通訊錄（虛構；正式版來自公司目錄）
const EXTRA = ['aaron.chang', 'abbie.huang', 'adam.chiang', 'agnes.hsiao', 'agnes.teng', 'albert.chang', 'albert.tsao', 'amy.lin', 'andy.wu', 'angela.liu', 'ben.chou', 'bella.yeh', 'carol.sung', 'cindy.kuo', 'daniel.wei', 'emily.tsai', 'eric.hsu', 'fiona.lai', 'gary.ho', 'helen.pan', 'ivy.chen', 'jason.ku', 'kevin.fang', 'linda.tu'];
for (const local of EXTRA) USERS['d-' + local] = { id: 'd-' + local, name: local.split('.').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), email: local + '@example.com' };
export const DIRECTORY = Object.values(USERS).filter((u) => u.id !== 'u-lin').sort((a, b) => a.email.localeCompare(b.email));

/** 範本資料：使用者提供的兩份上傳檔 */
export const DEMO_DATASET = {
  id: 'DS-WATSONS-2022Q4',
  label: '屈臣氏 2022Q4 測試資料（POC 範本）',
  articleFile: { name: WATSONS.meta.datasetName, size: 2_814_246 },
  keywordFile: { name: WATSONS.meta.keywordFileName, size: 10_073 },
  note: `OpView 匯出 ${WATSONS.meta.totalRows.toLocaleString()} 筆（主文 ${WATSONS.meta.totalPosts.toLocaleString()}、回文 ${WATSONS.meta.totalReplies.toLocaleString()}），查詢期間 2022/10/01–12/31。`,
};

const iso = (s) => new Date(s).toISOString();

function a(id, name, mode, status, owner, updatedAt, extra = {}) {
  return {
    id,
    name,
    client: '屈臣氏（測試資料）',
    brand: 'Watsons',
    clientType: 'existing',
    industry: '零售與通路',
    subIndustry: '藥妝與生活用品',
    mode,
    status,
    ownerId: owner,
    access: 'owner',
    createdAt: iso(updatedAt),
    updatedAt: iso(updatedAt),
    researchQuestion: '',
    dataset: {
      source: 'demo',
      datasetId: DEMO_DATASET.id,
      files: [{ ...DEMO_DATASET.articleFile, kind: 'article' }],
      keywordFile: { ...DEMO_DATASET.keywordFile },
    },
    settings: { clusterCount: 6 },
    sharedWith: [],
    ...extra,
  };
}

export function buildSeedAnalyses() {
  return [
    a('AN-1001', '屈臣氏 2022Q4 社群口碑分析', 'cluster', 'completed', 'u-lin', '2026-10-06T09:20:00+08:00',
      { sharedWith: [{ userId: 'u-wang', role: 'viewer' }] }),
    a('AN-1002', '屈臣氏 2022Q4 話題洞察', 'cluster', 'completed', 'u-lin', '2026-10-05T16:05:00+08:00'),
    a('AN-1003', '屈臣氏雙 11 促銷聲量追蹤', 'cluster', 'processing', 'u-lin', '2026-10-07T10:12:00+08:00'),
    a('AN-1004', '藥妝通路比較洞察', 'cluster', 'failed', 'u-lin', '2026-10-04T11:40:00+08:00',
      { failure: { code: 'SIMULATED_TIMEOUT', message: '分析服務在處理時逾時。' } }),
    a('AN-1005', '【長標題示範】屈臣氏 2022 第四季跨平台社群口碑、促銷集點、門市服務與職場話題之綜合話題分群分析（含迪士尼聯名贈品交換與開架彩妝新品討論）', 'cluster', 'completed', 'u-lin', '2026-10-03T14:30:00+08:00'),
    a('AN-1006', '開架彩妝新品討論分群', 'cluster', 'completed', 'u-lin', '2026-10-02T10:00:00+08:00'),
    a('AN-1007', '集點贈品交換洞察', 'cluster', 'completed', 'u-lin', '2026-09-30T18:20:00+08:00'),
    a('AN-1008', '門市服務口碑觀察', 'cluster', 'completed', 'u-lin', '2026-09-28T09:45:00+08:00'),
    a('AN-1009', '保養品功效討論洞察', 'cluster', 'completed', 'u-lin', '2026-09-25T13:10:00+08:00'),
    a('AN-1010', '隱形眼鏡彩片話題分群', 'cluster', 'completed', 'u-lin', '2026-09-22T15:55:00+08:00'),
    a('AN-1011', '員工職場話題洞察', 'cluster', 'completed', 'u-lin', '2026-09-19T11:25:00+08:00'),
    a('AN-1012', '康是美比價討論分群', 'cluster', 'failed', 'u-lin', '2026-09-16T17:00:00+08:00',
      { failure: { code: 'SIMULATED_FILE_ERROR', message: '檔案內容無法讀取。' } }),
    a('AN-2001', '藥妝通路競品口碑分群', 'cluster', 'completed', 'u-wang', '2026-10-06T15:00:00+08:00',
      { access: 'viewer', sharedWith: [{ userId: 'u-lin', role: 'viewer' }] }),
    a('AN-2002', '年度通路健檢洞察', 'cluster', 'completed', 'u-chang', '2026-10-01T10:30:00+08:00',
      { access: 'viewer', sharedWith: [{ userId: 'u-lin', role: 'viewer' }] }),
    a('AN-2003', '客戶機密專案（無權限示範）', 'cluster', 'completed', 'u-chen', '2026-09-29T09:00:00+08:00',
      { access: 'none' }),
  ];
}

/** OpView 已索取資料（OpView 寄回的檔案清單）示範資料 */
export function buildSeedRequests() {
  const r = (id, client, keywords, createdAt, extra = {}) => ({
    id, client, keywords, from: '2026-04-01', to: '2026-09-30',
    sources: { social: '全部社群網站', forum: '全部討論區' }, advanced: '',
    createdAt: iso(createdAt), pinned: false, ownerId: 'u-lin', ...extra,
  });
  return [
    r('RQ-1001', '屈臣氏', '(屈臣氏|Watsons|小屈)&(保養|彩妝|護膚)!廣告!代購', '2026-10-06T11:30:00+08:00'),
    r('RQ-1002', '蘭蔻', '(蘭蔻|Lancome)&(粉底|精華|小黑瓶)', '2026-09-28T15:05:00+08:00'),
    r('RQ-1003', '全聯福利中心', '(全聯|PXPay)&(支付|APP)|全支付!贈!送!活動', '2026-09-20T09:40:00+08:00'),
    r('RQ-1004', '康是美', '(康是美|Cosmed)&(集點|優惠|折扣)', '2026-09-12T17:15:00+08:00', { pinned: true }),
    r('RQ-1005', '寶雅', '(寶雅|Poya)&(開架|新品|聯名)!二手', '2026-08-30T10:00:00+08:00'),
    r('RQ-1006', '【長關鍵字範例】美妝通路比較', '(屈臣氏|康是美|寶雅|大樂|美妝)&(通路|比價|促銷|集點|會員|門市|服務)', '2026-08-18T13:25:00+08:00'),
  ];
}
