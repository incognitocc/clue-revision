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
