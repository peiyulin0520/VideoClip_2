# Little Moments / VideoClip_2 手機剪輯網頁：總體規劃

> 給之後實作的模型（Sonnet）讀的主文件。先讀 `CLAUDE.md`，再讀這份，再依 Phase 順序做。
> 細節規格在：`docs/TEXT_CARDS.md`（字卡、雲朵字、字塊形狀、尾端圈圈）、`docs/EFFECTS.md`（動畫、轉場、筆刷、參考影片拆解）、`docs/FONTS.md`（字體清單與來源）。
> 舊的 ffmpeg 工作流程筆記在 `docs/reference/legacy-notes/`（使用者先前整理，可參考規則，但本專案改為**純網頁、在手機瀏覽器內完成**）。

---

## 0. 一句話目標

一個**公開、免登入**的網頁 App（可加到 iPhone 主畫面），可以：
多專案管理 → 匯入多支影片/照片拼接 → 多圖層疊加（同一秒可疊多支影片、字卡、圖形、手繪）→ 豐富字卡（模板、字體、字塊、裝飾、雲朵字、逐字出現）→ 特效與轉場 → 調色 → 在影片上繪畫 → 匯出 1080×1920 MP4 → 推薦 IG 可用音源。

**每台裝置的專案彼此獨立**：分享網址給別人，別人只會看到自己裝置上的專案。

---

## 1. 使用者需求清單（全部要做，對應到 Phase）

| # | 需求 | Phase |
|---|---|---|
| R1 | 公開網址、免登入；每台裝置資料獨立，互相看不到 | P0 |
| R2 | 首頁區分不同剪輯 project（新增/改名/複製/刪除，縮圖） | P1 |
| R3 | 可匯入多支影片，主軌拼接（不只單一影片） | P1 |
| R4 | **圖層**：同一秒可疊多支影片素材；圖層可上下調整順序 | P2 |
| R5 | 字卡、icon、圖形選取後直接**兩指縮放/旋轉**，單指拖移；取消浮動圓鈕，數值與刪除放圖層頁籤（最新實測更正） | P2 |
| R6 | 修好「icon 沒有反應」：所有按鈕、貼圖在手機觸控都要有反應 | P1（全程驗收） |
| R7 | 字體選擇：**下拉式選單直接放在字卡頁籤**，選單裡每個字體用自己的字形預覽 | P3 |
| R8 | 字卡可自由調整：底色、字距、行距、寬度、字級；**字塊上下左右內距分開調**，修正「字上方色塊多、下方貼底」問題 | P3 |
| R9 | 字卡裝飾：尾端畫圈圈（照參考圖）、波浪、虛線、雲朵、對話框…；**字卡風格選單直接顯示預覽範例** | P3 |
| R10 | 更多可愛字卡模板（參考截圖：美妝清單、片中序章、運動、收藏、Vlog 標題、書法電影感） | P3 |
| R11 | 雲朵字效果（不必很蓬鬆，有那個感覺即可） | P3 |
| R12 | 字塊形狀/icon 參考 Office PPT 圖案（方塊、圓角、雲朵、對話框、星形、爆炸、緞帶、箭頭…），可當**字卡底塊** | P3 |
| R13 | 字卡出現方式（特效）：逐字出現、打字機、直接顯示、彈跳、淡入、手寫描繪… | P4 |
| R14 | 影片進出場動畫、片段之間轉場特效 | P4 |
| R15 | 在影片上**繪畫**：多種筆刷、橡皮擦、粗細、透明度、顏色；筆畫可做「逐筆描繪」動畫並與特效結合 | P5 |
| R16 | **VLOG 疊層效果**：底層完整影片 → 中層文字「V L G」→ 上層只保留人頭的影片，嵌在 O 的位置。上層用**自己描邊剪裁/橡皮擦擦掉**不要的區域（不是自動去背） | P5 |
| R17 | 調色功能（亮度、對比、飽和、色溫…＋濾鏡預設） | P4 |
| R18 | 字體：下載好看、支援繁體的免費字體（含日文字體中繁體覆蓋率高的）；首次使用自動下載清單；之後從快取讀取 | P3 |
| R19 | 佮逸體放入字庫；Zizi app 字體（饅頭黑體、中規中矩體、星光手體） | P3（見 FONTS.md 限制） |
| R20 | 首次使用就讓使用者選專案備份位置：手機檔案，或 Google 雲端（貼資料夾網址或登入後選資料夾） | P3 精靈＋P6 |
| R21 | 依影片內容推薦 IG 音源 | P7 |
| R23 | 拍貼/膠卷多格版型及滑動效果、可自訂底色的開場留白 | 本次實測更新 |
| R24 | 自由留白素材/主軌間隔、裝置 GIPHY Key 與搜尋、共用自己的素材/畫作、四邊及套索 crop、同裝置續用、主題/色輪/裝飾長度透明度、播放效能、音軌/配樂、完整影片輸出 | 本次明確需求，見 2026-11-12-editor-completion |
| R25 | 第二輪 iPhone：來源修剪/留白、GIF 效能、直接拖圖層、裁切結果預覽、獨立填色框線、編號縮圖與整組版型 | 已發布，見 2026-11-12-timeline-and-template-feedback 與 PROGRESS |
| R26 | 正常大預覽與播放列隨頁捲走、細圖層列表展開、往下依序功能/選項、返回捷徑 | PR #2 已合併；連續參考圖補充 PR #3 待使用者合併，246/74，見 2026-11-12-reference-page-flow |
| R22 | Icon、手繪與疊加素材可選擇收藏，跨專案套用；本機素材庫備份/還原 | P6（新增需求，尚未實作） |

---

## 2. 關鍵技術決策（已定案，照做）

VideoClip_2 建立說明：本次只建立參考庫已完成版本，保留其階段狀態，不代表 P4–P7 已完成。原 VideoClip 和 Sites 網站不變；詳細差異、驗收與授權阻礙見 PROGRESS.md 最新快照。

### 2.1 部署：GitHub Pages（公開、免登入）
- 純前端靜態網站，`vite build` 後由 GitHub Actions 部署到 GitHub Pages。
- 網址預計：`https://peiyulin0520.github.io/VideoClip_2/`（Vite `base: '/VideoClip_2/'`）。
- ✅ 已定案（2026-11-11）：使用者已把 repo 改為公開，用免費 GitHub Pages。公開的只是程式碼，不是使用者的影片。
- 部署方式：repo Settings → Pages → Source 選「GitHub Actions」（Phase 0 時請使用者做這一步，並附截圖說明位置）。
- 路由用 **HashRouter**（`#/`、`#/p/<projectId>`、`#/settings`），避免 Pages 子路徑 404。

### 2.2 資料隔離與儲存（R1）
- **所有專案資料只存在該裝置的瀏覽器**：沒有後端、沒有帳號。分享網址 = 分享 App，本身不帶任何資料。
- 專案中繼資料（JSON）：IndexedDB（用 `idb` 或 Dexie）。
- 影片/圖片原檔：**OPFS**（Origin Private File System, `navigator.storage.getDirectory()`），每個專案一個資料夾 `projects/<id>/media/<assetId>.<ext>`。不要把大檔塞進 IndexedDB。
- 字體：Cache Storage（`fonts-v1`）＋ IndexedDB 記錄已下載清單；使用者自行匯入的字體存 OPFS `fonts/`。
- 啟動時呼叫 `navigator.storage.persist()`，並在設定頁顯示用量 `navigator.storage.estimate()`。
- **iPhone 重要限制**：Safari 對「沒有加入主畫面」的網站，7 天未使用可能清掉儲存資料。→ 首次使用引導「加入主畫面」（PWA），並提供 Google Drive 備份（P6）與「匯出專案 .zip」。這點要在 UI 上清楚告知。

### 2.3 技術棧
| 用途 | 選擇 | 理由 |
|---|---|---|
| 建置 | Vite + TypeScript | |
| UI | React 18 + Zustand（+ immer） | 狀態集中，方便 undo/redo |
| 合成渲染 | **PixiJS v8**（WebGL2） | 圖層、遮罩、混合模式、濾鏡、iOS Safari 可跑；不要依賴 Canvas2D `ctx.filter`（Safari 支援不穩） |
| 字卡繪製 | Canvas2D 離屏繪製 → 轉成 Pixi Texture（快取） | 字型/描邊/字塊/裝飾用 2D 畫最直接 |
| 手繪筆畫 | `perfect-freehand`（MIT） | 平滑、有粗細變化 |
| 手勢 | Pointer Events ＋ `@use-gesture/react` | 拖移、雙指縮放旋轉 |
| 解碼/編碼/封裝 | **Mediabunny**（WebCodecs；MPL-2.0） | 逐格精準解碼與 MP4 匯出；預覽用 `<video>` |
| 音訊 | Web Audio API（OfflineAudioContext 混音） | |
| PWA | `vite-plugin-pwa` | 加入主畫面、離線、快取字體 |
| UI 圖示 | `lucide-react`（ISC） | 介面按鈕 |
| 貼圖 icon | Fluent Emoji（Microsoft，MIT）、Tabler Icons（MIT）、Fluent UI System Icons（MIT） | Office 風格、可商用 |
| 測試 | Vitest（單元）、Playwright（行動裝置模擬 e2e＋截圖） | |

> 沙盒內已預裝 Chromium＋Playwright，不要再 `playwright install`。WebKit 沒裝，iPhone Safari 的行為一定要請使用者在真機上確認（列在「待真機驗證」）。

### 2.4 渲染架構（預覽與匯出共用同一套）
- `Compositor.renderFrame(project, t)`：依時間 `t` 算出所有可見圖層 → 依 z-order 由下往上畫到 Pixi stage。
- **預覽**：每個影片素材用一個 `<video>`（muted、playsinline）當 texture 來源，播放時以 `requestVideoFrameCallback` 同步；預覽解析度降為 540×960 以保順暢。
- **匯出**：不播放，逐格走時間軸：用 Mediabunny 的 `VideoSampleSink` 取得精準影格 → 畫到 stage → `new VideoFrame(canvas)` → H.264 編碼；音訊用 OfflineAudioContext 混好後 AAC 編碼 → MP4。
- 匯出規格：直式 1080×1920 / 30fps（預設）、橫式 1920×1080、方形 1080×1080；寬高偶數。
- 若裝置不支援 AudioEncoder（AAC），退路：先輸出無聲 MP4（IG 上再加音樂本來就是推薦做法，見 P7），並在 UI 說明。不要偷偷失敗。
- iPhone HDR（HLG/10-bit）素材在 canvas 中可能偏灰：先記錄為已知限制，P4 調色提供「HDR 校正」預設（提高對比/飽和）作為暫解。

### 2.5 資料模型（`src/model/types.ts`）

```ts
type Project = {
  id: string; name: string; createdAt: number; updatedAt: number;
  aspect: '9:16' | '16:9' | '1:1'; width: number; height: number; fps: number;
  assets: Asset[];          // 匯入的素材（影片/圖片/音訊/使用者字體）
  tracks: Track[];          // 由下往上排列 = 圖層順序（index 越大越上層）
  thumbnail?: string;       // dataURL，首頁顯示
  version: 1;
};

type Track = {
  id: string; kind: 'main' | 'overlay' | 'text' | 'sticker' | 'drawing' | 'adjust' | 'audio';
  name: string; hidden: boolean; locked: boolean; muted?: boolean;
  items: Item[];
};
// main：主軌，片段首尾相接，可設轉場；其他軌道：自由放置、可重疊於任何秒數

type ItemBase = {
  id: string; start: number; duration: number;      // 時間軸位置（秒）
  transform: { x: number; y: number; scale: number; rotation: number; opacity: number }; // x,y 為畫面比例 0–1（中心點）
  keyframes?: Keyframe[];                             // 位置/縮放/旋轉/透明度關鍵影格（P5 可選）
  animIn?: Anim; animOut?: Anim; animLoop?: Anim;     // 進場/出場/循環
  blend?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'add';
  mask?: Mask;                                        // 自由剪裁（R16）
  grade?: Grade;                                      // 調色（R17）
};

type VideoItem = ItemBase & { type: 'video' | 'image'; assetId: string;
  trimIn: number; speed: number; volume: number; crop?: Rect; fit: 'cover' | 'contain';
  transitionOut?: Transition; };                      // 只有主軌片段用 transitionOut
type TextItem = ItemBase & { type: 'text'; card: TextCard };     // 見 TEXT_CARDS.md
type StickerItem = ItemBase & { type: 'sticker'; source: { kind: 'shape' | 'icon' | 'emoji'; id: string }; fill?: string; stroke?: Stroke; };
type DrawingItem = ItemBase & { type: 'drawing'; strokes: BrushStroke[]; reveal: 'instant' | 'stroke-by-stroke'; revealDuration?: number }; // 見 EFFECTS.md
type AdjustItem = ItemBase & { type: 'adjust'; grade: Grade };  // 調整圖層：作用在它下方所有圖層

type Mask = {                                          // R16 自由剪裁
  shapes: Array<
    | { kind: 'lasso'; points: [number, number][] }    // 手指描邊的封閉路徑（素材座標 0–1）
    | { kind: 'ellipse' | 'rect'; x: number; y: number; w: number; h: number; rotation: number }
  >;
  eraseStrokes: BrushStroke[];                         // 橡皮擦：再擦掉的部分
  restoreStrokes: BrushStroke[];                       // 還原筆：補回的部分
  feather: number;                                     // 羽化 px
  invert: boolean;
  outline?: { color: string; width: number };         // 貼紙白邊（參考影片 8a645cc7）
  follow?: Keyframe[];                                 // 遮罩位置隨時間移動（人頭會動時手動對位）
};
```
- 所有編輯動作走 store 的 action，並寫入 undo/redo 歷史（上限 100 步）。
- 自動儲存：變更後 800ms debounce 寫入 IndexedDB。
- 專案檔要有 `version` 欄位，之後改格式要寫 migration。

---

## 3. 介面規劃（手機優先，直式）

```
┌────────────────────────┐
│ ← 專案名稱      ↶ ↷  匯出 │  頂列
├────────────────────────┤
│                        │
│      預覽畫面 9:16      │  可點選物件；選取框＋右上角縮放鈕
│                        │
├────────────────────────┤
│ ▶ 00:03.2 / 00:15.0  ⤢ │  播放列
├────────────────────────┤
│ 圖層軌道（可捲動、雙指縮放時間軸）│  上層在上、主軌在最下
│ [文字] ▭▭      ▭       │  每軌左側：眼睛(隱藏)、鎖、拖曳把手(調圖層順序)
│ [疊加] ▭▭▭▭            │
│ [主軌] ▭▭▭|▭▭▭|▭▭       │  片段間的 | 點擊＝設定轉場
├────────────────────────┤
│ 剪輯 文字 貼圖 繪畫 特效 轉場 調色 圖層 音訊 │  底部工具列（可左右滑）
└────────────────────────┘
```

- 首頁 `#/`：專案卡片網格（縮圖、名稱、長度、最後修改），右下「＋新專案」（選比例 → 選素材）。長按卡片：改名/複製/刪除/匯出 .zip。
- 選取物件時，預覽上顯示選取框：
  - **右上角圓形鈕**：拖曳 = 等比縮放＋旋轉（R5，使用者指定位置）。
  - 左上角 ✕：刪除；拖曳框內 = 移動；雙指 = 縮放旋轉。
  - 文字卡另有左右側邊把手：調整**字卡寬度**（自動換行）。
- 所有可點元素 ≥ 44×44px；預覽層 `touch-action: none`；按鈕用 `onPointerUp`/`onClick`，不要只綁 `touchstart`（R6）。
- 首次啟動流程（R18）：見 §5 Phase 3。

---

## 4. 檔案結構（建議）

```
src/
  app/            路由、Layout、首次使用引導
  model/          types.ts、defaults.ts、migrations.ts
  store/          projectStore.ts（zustand + undo）、uiStore.ts
  storage/        db.ts（IndexedDB）、opfs.ts、fontCache.ts、drive.ts（P6）、zipExport.ts
  engine/
    compositor.ts       renderFrame(project, t)
    timeline.ts         可見圖層計算、時間換算
    videoSource.ts      預覽用 <video> 池
    exporter.ts         Mediabunny 匯出
    audioMix.ts
    transitions/        每種轉場一個檔（GLSL 或 Pixi filter）
    animations/         進出場/逐字動畫
    grade/              調色 shader、濾鏡預設
  text/
    layout.ts           字卡排版（逐字座標、實際墨跡邊界）
    renderCard.ts       畫字塊、文字、描邊、裝飾 → canvas
    cloudText.ts        雲朵字
    decorations/        尾端圈圈、波浪、虛線、雲朵框、對話框…（path 產生器）
    templates/          模板 JSON（每類一檔）
  shapes/          Office 風格圖形 SVG path 產生器
  drawing/         筆刷引擎、橡皮擦、遮罩繪製
  fonts/           字體目錄 catalog.ts（名稱、來源、授權、檔案）
  music/           分析與推薦（P7）
  ui/              元件：Timeline、Preview、SelectionBox、ToolTabs、FontSelect、ColorPicker…
public/
  fonts/           自架 OFL 字體 woff2（含 OFL.txt）
  music/ig-songs.json
scripts/
  fetch-fonts.mjs   下載字體原檔到暫存資料夾（不進 git）
  build-fonts.py    fontTools 轉 woff2＋分塊、計算繁體覆蓋率
docs/
```

---

## 5. 實作階段（每個 Phase 結束都要：測試通過 → commit → push → 回報）

### Phase 0：專案骨架與部署
- Vite + React + TS + ESLint + Prettier + Vitest + Playwright 設定。
- GitHub Actions：push 到 main 時 build 並部署 Pages（`.github/workflows/deploy.yml`）；在功能分支只跑 build＋test。
- PWA manifest（名稱「Little Moments」、圖示、`display: standalone`）。
- **驗收**：`npm run build` 成功；Playwright 以 iPhone 13 模擬開首頁截圖無錯誤。

### Phase 1：專案管理＋多影片拼接（R2、R3、R6）
- 首頁專案列表、CRUD、縮圖。
- 匯入：`<input type="file" accept="video/*,image/*" multiple>` → 複製到 OPFS → 讀 metadata（長度、尺寸、是否有音軌）→ 產生縮圖條。
- 主軌：片段依序相接；可拖曳排序、修剪頭尾（拖片段邊緣）、分割（在播放頭處）、刪除、複製、變速（0.25–4x）、音量。
- 照片素材預設 3 秒。
- 預覽播放（跨片段無縫切換：預先載入下一支 `<video>`）。
- Undo/Redo、自動儲存。
- **驗收**：e2e：建 2 個專案 → 各匯入 2 支測試影片（用 ffmpeg 產生的色條/倒數測試片，放 `tests/fixtures/`）→ 重新整理後兩專案資料都在且互不影響；所有工具列按鈕點擊都有反應（寫一支 e2e 逐一點擊並斷言有 UI 變化）。

### Phase 2：圖層系統＋選取變形（R4、R5）
- 軌道種類：疊加影片（overlay）、文字、貼圖、繪畫、調整。可新增多條軌，每條軌可在**任意秒數**放物件，同一秒可疊多支影片。
- 圖層面板（「圖層」頁籤）：列出目前播放頭位置的所有物件，拖曳改上下順序、隱藏、鎖定、混合模式、透明度。
- 疊加影片可「畫中畫」：縮放、移動、裁切、圓角、外框。
- 選取框＋右上角縮放旋轉鈕＋雙指手勢；吸附（中心線、安全區）。
- 平台安全區參考線（底部約 250px、右側約 150px 半透明顯示，可關）。
- **驗收**：同一秒疊 3 支影片＋1 個字卡，改變順序後預覽正確；匯出的單格截圖（用 exporter 的 `renderFrame` 輸出 PNG）與預覽一致。

### Phase 3：字卡系統＋字體＋圖形（R7–R12、R18、R19）—— 最大的一塊
規格全部在 `docs/TEXT_CARDS.md` 與 `docs/FONTS.md`。重點：
1. 字卡排版引擎：**用實際墨跡邊界（`measureText().actualBoundingBoxAscent/Descent`）置中**，修正 CJK 字型上方空太多、下方貼底的問題；字塊內距上/下/左/右分開調，另有「垂直微調」。
2. 字卡頁籤 UI：文字輸入 → **字體下拉選單**（每項用該字體渲染名稱＋「範例字」）→ 字級、顏色、字距、行距、寬度、對齊、粗體（描邊模擬）、斜體、描邊、陰影、發光 → 字塊（形狀、顏色、透明度、內距、圓角）→ 裝飾 → 動畫。
3. 風格/模板選單是**縮圖格**，每格是即時渲染的範例（不是文字名稱）。
4. Office 風格圖形庫（可當貼圖，也可當字卡底塊）。
5. 雲朵字。
6. 字體：首次使用引導下載字體包；字體快取；匯入自己的字體檔（.ttf/.otf/.woff2）。
- **首次使用流程**（引導精靈，3 步）：開 App 時若 IndexedDB 沒有 `appState`：
  1. 「第一次在這台裝置使用嗎？」
     - 「是」→ 進入第 2 步。
     - 「不是，我換了裝置/清過資料」→「從 Google 雲端還原」（登入後選資料夾，見 Phase 6）/「從手機檔案匯入備份 .zip」/「略過」。
  2. **選擇專案備份位置**（使用者的需求：一開始就給選項；之後可在設定頁改）：
     - 「存在手機檔案」：專案平常存在瀏覽器內；備份時匯出 `.zip`，透過分享選單「儲存到檔案」（iPhone 可選「我的 iPhone」或 iCloud Drive）。
     - 「存到 Google 雲端」：可先貼上 Drive 資料夾網址（選填）→「用 Google 登入」→ Google 資料夾選擇器直接開在那個資料夾（沒貼網址就從「我的雲端硬碟」開始）→ 確認 → 之後自動備份。詳見 Phase 6。
     - 「先不要備份」：只存在瀏覽器（提示：iPhone 未加入主畫面可能被清掉）。
     - Phase 6 完成前，「存到 Google 雲端」顯示為「即將推出」，選了先當成「存在手機檔案」。
  3. 下載字體：顯示建議字體清單（勾選、每款大小、總大小，預設勾選「基本包」）→ 下載到 Cache Storage，顯示進度。
  - 之後開啟：直接從快取讀字體，不再詢問；設定頁可「管理字體」（增刪、重新下載）與「備份位置」（切換、重新選資料夾、登出）。
  - 若本機已有資料就**不詢問**（同一台裝置自然就是「不是初次」）。
- **驗收**：每個模板截圖存到 `docs/screenshots/templates/`（給使用者審核）；尾端圈圈截圖與 `docs/reference/tail-loop-underline.jpg` 並排對照；繁體覆蓋率報告 `docs/font-coverage.md`。

### Phase 4：動畫、轉場、調色（R13、R14、R17）
規格在 `docs/EFFECTS.md`。
- 字卡進場/出場/循環動畫（含逐字、打字機、手寫描繪、彈跳…）。
- 片段進出場動畫、主軌轉場（含筆刷擦除、愛心/星形擦除等可愛款）。
- 畫面特效（顆粒、暗角、色差故障、閃白、手震、光暈、VHS…）作為「特效軌」物件，可放在任意時間範圍。
- 調色：每個片段可調，或用「調整圖層」作用於下方所有圖層；濾鏡預設 12 款以上。
- **驗收**：每種動畫/轉場輸出 GIF 或關鍵 3 格對照圖到 `docs/screenshots/effects/`。

### Phase 5：繪畫＋自由剪裁遮罩（R15、R16）
- 繪畫模式：筆刷列（見 EFFECTS.md）、顏色、粗細、透明度、平滑度；橡皮擦（擦筆畫）、復原；筆畫可設「逐筆描繪」動畫。
- 剪裁模式（對影片/圖片物件）：套索描邊、圓形/方形選取、橡皮擦擦掉、還原筆補回、羽化、反轉、白邊描邊；遮罩可設關鍵影格跟著人頭移動。
- **VLOG 模板（一鍵建立）**：
  1. 底層：使用者選的完整影片（主軌）。
  2. 中層：文字物件「V」「L」「G」三個（或一個「V L G」字串留出 O 的空間），大字、可換字體。
  3. 上層：同一支影片（或另一支）複製一份到疊加軌，預設套用圓形遮罩，提示使用者「描出人頭範圍」，並放到 O 的位置。
  4. 上層可單獨縮放、移動，中層字放在不會被遮擋之處，只讓 O 被頭取代。
- **驗收**：用測試影片做出 VLOG 疊層，輸出 3 個時間點截圖；遮罩與白邊正確。

### Phase 6：備份位置（手機檔案 / Google 雲端）（R20）
使用者在首次使用精靈（見 Phase 3）或設定頁選擇備份位置。**每個人選自己的**：別人用同一網址選雲端，是登入他自己的 Google 帳號、存到他自己的資料夾。

**A. 存在手機檔案**
- 「備份」按鈕 → 產生 `.zip`（`project.json`＋縮圖＋可選原始影片）→ `navigator.share({ files })` 開分享選單 →「儲存到檔案」；不支援分享時改成下載。
- iPhone Safari **不能**讓網頁自動寫入「檔案」App 的資料夾（不支援 File System Access API），所以每次備份都要按一下確認；App 在專案有變更且超過 N 天沒備份時提醒。
- 桌機 Chrome/Edge 支援 `showDirectoryPicker()`：可選一個資料夾後自動備份（有支援才顯示）。
- 還原：選 `.zip` 匯入。

**B. 存到 Google 雲端**
- 用 Google Identity Services（OAuth 2.0 token flow，純前端）＋ Drive API v3 ＋ Google Picker，scope 只用 `drive.file`（只能存取 App 自己建立或使用者在選擇器裡選的檔案，不會看到使用者其他檔案）。
- 流程：
  1.（選填）貼上 Drive 資料夾網址 → 解析出資料夾 ID（支援 `drive.google.com/drive/folders/<id>`、`…/u/0/folders/<id>?usp=sharing` 等格式）。
  2. 「用 Google 登入」→ 授權。
  3. 開 Google Picker（資料夾模式）：有貼網址就用 `DocsView.setParent(<id>)` 直接開在那個資料夾，讓使用者確認；沒貼就從「我的雲端硬碟」開始選。
  4. App 在選定資料夾內建立 `VideoClip/`：`projects/<id>/project.json`、`projects/<id>/thumb.jpg`、`projects/<id>/media/*`（原始影片預設**不**上傳，因為很大；設定可開）、`fonts/`（使用者匯入的個人字體）。
  5. 之後自動備份：專案變更後 30 秒 debounce 上傳 `project.json`；影片在 Wi-Fi 下才上傳（可設定）。
  6. 換裝置：首次使用選「不是初次」→ 登入 → 選同一個資料夾 → 列出雲端上的專案 → 選要還原的；個人字體自動下載。
- 只有資料夾網址、不登入**不能寫入**：Google 不允許未登入的程式寫入 Drive，即使資料夾開放「知道連結的人可以編輯」也一樣。UI 要說明這點。
- 備份資料夾**不要**設成公開分享（否則別人能看到影片）；App 偵測到資料夾是公開時顯示警告。
- 登入權杖只放在記憶體／sessionStorage，過期時再請使用者點一次登入（純前端的 token flow 沒有長期 refresh token）。
- 使用者原本指定的資料夾：`https://drive.google.com/drive/folders/1fLGtxMS4oRFIOqpyn-jnBtifCRCclF2l`（只是使用者自己的預設，不要寫死在程式裡給所有人用）。
- 功能：備份目前專案、全部備份、從雲端還原、雲端上的個人字體同步、切換資料夾、登出。
- **需要使用者先做（Sonnet 要用中文一步步帶）**：建立 Google Cloud 專案（免費、不需綁信用卡）→ 啟用 Drive API 與 Picker API → 設定 OAuth 同意畫面（App 名稱、使用者的聯絡信箱、scope 只加 `drive.file`）→ 建立 OAuth Client ID（網頁應用程式，授權來源 `https://peiyulin0520.github.io`）→ 建立 API key（限制在 Drive/Picker API 與該網域）→ 記下專案編號（Picker 的 App ID）。Client ID、API key、App ID 都是公開值，可寫進前端設定檔。
- 同意畫面先用「測試」模式（只有加入的測試使用者能登入，上限 100 人）；要讓任何人都能登入再改「正式版」。`drive.file` 屬於非敏感 scope，通常不需要 Google 的完整審查，但發布時 Google 可能要求品牌資訊（隱私權政策網址等）：Sonnet 要在 repo 準備一頁 `privacy.html`，並以申請當下 Google 的實際要求為準，不要先說成一定不用審查。
- **驗收**：實際授權需要使用者在真機操作；Sonnet 寫好 mock 測試，真機測試列入待驗證。

### Phase 7：IG 音源推薦（R21）
- **事實先講清楚**：Instagram 沒有公開的音樂庫 API，也無法從網頁直接把音樂加入 IG。可做的是「推薦歌名＋搜尋關鍵字」，使用者發 Reels 時在 IG 內搜尋加入（這樣也才有授權）。商業帳號只能用 Meta 授權音效庫，曲庫依地區不同。
- 分析（全部在裝置上做）：總長度、剪接頻率（每秒幾刀）、畫面亮度/飽和/冷暖、動態量（相鄰影格差異）、字卡文字內容、使用者選的主題標籤（vlog/美食/旅行/運動/美妝/日常/可愛…）→ 得出情緒標籤與建議 BPM 範圍。
- 推薦來源 A（預設，離線）：`public/music/ig-songs.json` 精選曲目表（歌名、歌手、語言、情緒標籤、BPM、適合主題、備註）。Sonnet 先建 60 首左右常見於 Reels 的歌曲作為初版，並標註「需定期更新」；推薦依標籤與 BPM 打分。
- 推薦來源 B（選用，AI）：使用者在設定頁填入**自己的** Claude API key（只存在該裝置），同意後把 6 張縮小的關鍵影格（≤512px JPEG）＋分析 JSON 送到 Claude API，回傳 10 首推薦與 IG 搜尋關鍵字。
  - 用官方 `@anthropic-ai/sdk`，瀏覽器端需設 `dangerouslyAllowBrowser: true`；圖片用 base64 `image` content block；用 structured outputs（`output_config.format`）拿 JSON；model 預設 `claude-opus-5-5`（設定頁可改）。實作前先讀 claude-api skill。
  - 送出前清楚提示「影格會上傳到 Anthropic」，預設關閉；影片有家人小孩臉時要使用者明確同意。
- UI：匯出頁下方「推薦音樂」卡片：歌名、歌手、為什麼適合、「複製歌名」按鈕、建議從第幾秒切入（若有）。
- **驗收**：給 3 種不同測試專案（快節奏/慢節奏/暖色），推薦結果不同且合理。

---

## 6. 測試策略
- Vitest：排版引擎（墨跡邊界置中）、時間軸計算、遮罩幾何、轉場插值、推薦打分。
- Playwright（Chromium＋iPhone 13 裝置描述）：主要流程 e2e；**每個字卡模板、每種轉場的截圖**存檔給使用者審核（使用者只負責審核，見 legacy-notes 的溝通規則）。
- 測試素材：用 ffmpeg 產生（`testsrc2`、色塊、倒數數字），**不要用真人素材**。
- 每次回報時誠實區分：✅ 已驗證（附截圖）／🟡 寫好但只在 Chromium 驗證／🔴 做不到。

## 7. 待真機驗證清單（Sonnet 無法在沙盒驗證，要請使用者在 iPhone 上試）

- [ ] 單素材同頁精調：各iPhone直向/瀏覽器工具列與安全區下，預覽、起或迄標記、44px時間軸及膠囊秒數同頁可見；數字鍵盤開啟仍能捲動操作，82秒等長片精調定位正確；載入返回/同秒效果小按鈕好點。Chromium三尺寸驗收不能代替Safari鍵盤與安全區。

- [ ] 新固定邊界/播放修正：iPhone的worker/main相容proxy（H264/HEVC/HDR長片）/進度與取消/快取、回0秒重播、捲頁與popup後聲畫、無自動播、AudioSession/爆音與分離audio decoder、膠囊原生選單；來源VideoClip對照，Chromium不能代替真機。

- [ ] 特效固定單素材邊界/成對起迄：Safari在10秒影片中設定3秒B進/A退時，影片及聲音繼續；A/B總長保留、起迄標籤觸控、白線播放同步與暫停、局部復原/取消/重開、長片及匯出聲畫。
- [ ] 追加三點：自訂版型寬高與影片比例獨立、預覽540低畫質/切換保留時間與播放、輸出框/無效範圍、真機多影片播放順暢度。
- [ ] 最新六點：版型自訂文字/色彩/透明度與單一素材進出場、各預覽▶/⏸與active、每格進階設定、320–430px比例/visualViewport動態工具列與鍵盤、最底回頂。
- [ ] 全頁可讀性：六主題首次備份/字體包與字體選單，負字距/緊行高在Safari的中文、英文、網址與原生選單可讀且不重疊。
- [ ] 全介面14px（註解11px）與縮小文字框內距：Safari原生輸入聚焦/選單、320px播放時間兩行/時間軸標記及44px觸控。
- [ ] 最新 10 點：Safari 分類優先展開/重開、14px 控制與原生選單/輸入聚焦、緊湊交接入口及拖曳修剪、紙紋筆觸效能與手繪單指拖移、偏移瞄準圈保留/擦除/描邊（指觸不擋目標）與輸出、版型右側選單在窄螢幕操作。
- [ ] 最新 11 點：Safari 小音訊畫面/白線同步/暫停後精準標記，定格直接記錄/預覽拖移、交接 + 與混搭、播放不出白框、鉛筆及硬體感壓/一般手指速度筆觸；長片效能待真機。
- [ ] PR #7 九點：Safari 多組倒三角與白線新增/取消/局部復原、長按多選與分類收合、菱形定位/整組縮放、25 A/B/12 影片效果的即時效能與長片聲畫輸出、GIPHY 本機 Key 與主題圓圈。
- [ ] 最新分型軌道：Safari 原影片直接觸控選取/雙指、550ms 長按遮擋選單、暫時置頂完成與匯出、單片段長按跨層/時間、異型拒絕/層間新建、主題 icon 對比。
- [ ] 參考圖補充：正常大預覽及播放列都會捲走、細圖層列仍能選取/修剪/排序，功能及末端選項依序滑動查看。
- [ ] 新工作區：Safari 由預覽空白/未選取畫面及長字卡設定上下滑整頁、面板不另行捲動、13 層完整檢視、橫向捲播放頭與直向捲頁不干擾、編輯工具不遮層、選取框雙指手勢、放大返回位置。
- [ ] 第二輪：左端修剪留白/完整來源還原、時間軸左側圖層直接拖曳、GIF 播放平順、裁切預覽/復原、透明填滿與獨立框線、多格編號/縮圖/整組隱藏刪除。
- [ ] 本次完整流程：GIPHY Key 同瀏覽器保留與實際服務額度/CORS；原音與配樂的 Safari 使用者手勢解鎖；MP4 編碼可用性、相容即時錄製、iPhone 分享/儲存影片與長片記憶體；v2→v3 資料與同裝置字體/收藏保留；720/1080/1920 預覽與描邊觸控。
- [ ] 本次 8 項修正：Safari 首次匯入立即出現預覽、兩指/全螢幕好操作、文字清晰、三/四格多影片解碼與聲音、開場留白。
- [ ] VideoClip_2 新部署：主畫面名稱 Little Moments、所有字體/圖示路徑、與舊 VideoClip 資料互不覆蓋、PWA scope 與離線更新
- [ ] iOS Safari：OPFS 寫入大檔、`storage.persist()`、加入主畫面後資料保留
- [ ] WebCodecs H.264 編碼與 AAC 音訊編碼
- [ ] HDR 素材顏色
- [ ] 觸控手勢（框內雙指縮放/旋轉、時間軸捲動與拖曳不衝突；浮動圓鈕已依最新偏好移除）
- [ ] 大型 CJK 字體在手機上的載入速度與記憶體
- [ ] Google Drive 授權與上傳
- [ ] （Phase 1）iPhone 匯入照片圖庫的 .mov（HEVC）與 .heic：能不能讀長度、縮圖、播放
- [ ] （Phase 1）OPFS 寫入大檔（>500MB）；沒有 createWritable 時退回 IndexedDB 是否可用
- [ ] （Phase 1）預覽跨片段播放時聲音不中斷（第二個 <video> 的解鎖）
- [ ] （Phase 1）時間軸：捲動＝移動播放頭、雙指縮放、長按拖曳排序、修剪把手是否好點、不會誤觸頁面捲動
- [ ] （Phase 3B）字體包下載（基本包約 22 MB）在 iPhone 的速度；Cache Storage 的配額與是否被清掉；載入 3–6 MB 的字體後預覽會不會卡
- [ ] （Phase 3B）首次使用精靈在 iPhone Safari 與「加入主畫面」後的流程；字體選單捲動是否順
- [ ] （Phase 3B）從「檔案」App（含 iCloud、Google Drive）選字體檔匯入
- [ ] （Phase 2）多個影片同時播放（主軌＋2–3 個疊加）：畫面與聲音是否順、會不會有影片黑掉（iOS 同時解碼數量限制）
- [ ] （Phase 2）預覽上雙指縮放/旋轉選取的物件、拖移時吸附會不會太黏
- [ ] （Phase 2）混合模式（色彩加深、濾色、覆蓋、加亮）與圓角、外框在 iPhone 上的顯示
- [ ] （Phase 2）預覽畫面大小是否夠用（底部面板展開時）
- [ ] （Phase 1）重新整理／關掉 Safari 再開，專案與素材還在（含加入主畫面後）
- [ ] 匯出 1 分鐘影片的時間與是否當掉
- [ ] （修正 A）安全區參考線預設看不到；拖移文字/貼圖時才出現，看得懂「IG／抖音按鈕區」；「安全區」按鈕好按
- [ ] （修正 B）匯入影片後預覽沒有白框和 ✕；點預覽空白處不會選到主軌；從時間軸點主軌片段才出現細框
- [ ] （修正 C）iPhone 匯入影片後時間軸有縮圖（Mediabunny/WebCodecs）；沒有的話是否先顯示檔名、播放後自動補上縮圖
- [ ] （修正 D）iPhone 直拍影片（.mov）匯入後，「自動比例」選到 9:16 而不是 16:9（旋轉資訊是否被讀到）

## 8. 使用者要先決定/準備的事
1. ✅ 已決定：repo 已公開，用 GitHub Pages。
2. Google Cloud OAuth Client ID / API key（P6 再做，Sonnet 會帶步驟；只有「存到 Google 雲端」需要，「存在手機檔案」不需要）。
3. 字體清單已整理在 `fonts/manifest.json`。沒有下載網址的 6 款（佮逸體、LINE Seed TW、中規中矩體、星光小熊貓幼兒體、字言字型手繪體、致一宋體）請在 Phase 3 開始時上傳到 Sonnet 的對話（詳見 FONTS.md §4）。
4. Sonnet 工作環境的網路需允許：`raw.githubusercontent.com`、`registry.npmjs.org`（已可用）；若要從 GitHub Release 下載字體還需 `github.com`、`objects.githubusercontent.com`；從 Drive 下載需 `drive.google.com`、`drive.usercontent.google.com`。


本次主題對比與自由分型圖層驗收：262 單元/79 Chromium e2e、80 張截圖通過，PR #3 待使用者自行合併；Safari 真機仍待確認。

最新互動規格補充：主題對比、米色與自由分型圖層見 docs/plans/2026-11-12-flexible-layers-and-contrast.md；取代舊的主軌固定底層/預覽不可直接選取限制。尚未完成的特效/轉場不因新增分型軌道而視為已實作。

2026-11-12 本次裁切筆刷、倒三角多段音訊、六主題對比與時間軸原點已通過 267 單元/91 Chromium e2e；Safari 真機需驗證筆刷、密集標記觸控、來源音訊試聽/匯出、浮動回頂。詳見 refinement-markers-and-readability 規劃。


本次局部裁切與倒三角多段聲音已驗收：程式 3b9de60dc2cb325652b075313e1636d47e00f092 / [Actions 43262467680](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43262467680)：267 單元、91 Chromium e2e 全過；lint/格式/TypeScript/build/Pages/39 字體檢查成功。 107 張截圖保存；PR #4 交使用者自行合併。Safari 真機仍依 §7 驗證筆刷、密集標記觸控與試聽/匯出。


2026-11-12 UTC：使用者 11/13 回報：時間軸預設收合與無頁尾保留區、整組模板縮放、每格獨立選段及黑白補時、明確多組音訊起迄、特效頁籤與展開故事，見 2026-11-13-template-story-workspace 計畫。Safari 真機待驗證整組雙指、格子選段、多組標記、音訊與匯出。


2026-11-12 UTC 本次整組模板/故事驗收：程式 4d706878f81bae6e311cb866fc62c91047f02b3a / [Actions 43284472645](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43284472645)：278 單元、98 Chromium e2e 全過；lint/格式/TypeScript/build/Pages/39 字體檢查成功。 118 張截圖；PR #5 交使用者自行 Merge。§7 仍需 Safari 真機驗證收合/捲動、整組雙指、格子精修、多組聲音與匯出。


2026-11-13 九點子任務見 plans/2026-11-13-advanced-editing.md：多組選段/局部復原、命名/批次/分類收合、線性關鍵幀、A/B 動畫轉場與影片特效、GIPHY Key 設定與主題圓圈。§7 真機待驗收：密集三角/菱形觸控、長按多選/分類、實際 iPhone 效果效能、音訊解鎖與長片匯出。


2026-11-13 九點最終驗收：[Actions 43366595525](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43366595525)：版本 c74dec591b3a9bcf88e425b49dbcfdac494d43d5 的 299 單元、110 Chromium e2e 全過，lint/格式/TypeScript/build/Pages/39 字體檢查成功。 artifact 14010687940，ZIP SHA-256 9cbea2ce6c63b1e2e65c118e40d579994e1a297331a42f66cc55ef01fa0da9cb 已核對；135 張成功畫面保存。 PR #7 交使用者自行 Merge；§7 真機項目仍待 Safari。


2026-11-13 最新 11 點驗收：[Actions 43386450346](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43386450346)：版本 8b61548265b98396fa70d5af4b5e884ff04448b5 的 306 單元、114 Chromium e2e 全數通過；lint/格式/TypeScript/build/Pages/39 字體檢查成功。 artifact 14019456046，ZIP SHA-256 1cd711f8bc09875f2b5299ce722fa440cfb287bba022a05c4e7e42e0941c861b 已核對；140 張成功畫面，其中 playback-refinement/ 新增 5 張。 PR #8 由使用者自行 Merge，§7 真機項目保留。


2026-11-13 最新 10 點：[Actions 43408392208](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43408392208)：版本 86d56ad6e41af714ef7b508ad389539fe1312f2b 的 313 單元、120 Chromium e2e 全過；lint/格式/TypeScript/build/Pages/39 字體檢查成功。 artifact 14028996857，ZIP SHA-256 c5b3dfaa8cbf4f5a11c97dd2ab2ac805cdb02821e79ad92d755bf8daf8aca5f9 已核對；148 張成功畫面，其中 compact-workspace/ 新增 8 張。 PR #9 由使用者自行 Merge；§7 真機項目保留。


全介面字級/框內距最終：[Actions 43415119800](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43415119800)：版本 d2e6e912e29b2b2608590eb828f09a6d1e6e6deb 的313單元、121 Chromium e2e全過；lint/格式/TypeScript/build/Pages/39字體檢查成功。artifact 14031444059，ZIP SHA-256 5103eef54febd04d95d5f0855bdfafd9502f4cf35cf186000317ea73181471cc 已核對；152張成功畫面，其中uniform-type/新增4張。PR #9由使用者自行Merge，Safari待真機。


全頁主題對比/字距最終：[Actions 43420368856](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43420368856)：版本 8fd2969c77b84352a3cd16c7b4f025ae22177792 的313單元、127 Chromium e2e全過；lint/格式/TypeScript/build/Pages/39字體檢查成功。artifact 14033892743，ZIP SHA-256 f9664009e966a03e9b5ce3199610be1a54cb79a4532e0440f944f241e4906127 已核對；158張成功畫面，其中readability/新增6張。PR #9由使用者自行Merge，Safari待真機。


2026-11-13 最新更正：預覽下方的圖層時間軸保留較小字級，刻度、分類與片段名稱11px，群組數及原音9px；其他頁籤、功能、播放列與彈窗仍14px，註解11px。保留收緊字距及44px觸控範圍。


2026-11-13 最新例外：圖層時間軸刻度/分類/標籤11px，計數/原音9px，其他操作介面維持14px。[Actions 43422783991](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43422783991)：版本 fc9d5bb813573aeba69889efe37b1ee98e5786f3 的313單元、127 Chromium e2e全過；lint/格式/TypeScript/build/Pages/39字體檢查成功。artifact 14036880124，ZIP SHA-256 6c1ef4fe7a5b5f2dc4ff8b93335c0138ca2b3a7e3c82b8d16897e19bf15423bb 已核對；159張成功畫面，新增uniform-type/small-timeline-labels.png。Safari待真機。


2026-11-13 新六點規格：見 [版型/單素材動畫/預覽控制](plans/2026-11-13-template-controls.md)，取代先前最底隱藏回頂與各格補時預設全展開。


九點最終驗收：[Actions 43463065085](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43463065085)：版本 6819c42e27914328f4ba183d493842903333f7f7 的321單元、134 Chromium e2e全過，lint/格式/TypeScript/build/Pages/39字體檢查成功。artifact 14058125854，ZIP SHA-256 be6d93e48b635a6ff142f6c6d2c05a8344a57c23b9c2b91a463f582826baad58 已核對；166張成功畫面（template-controls新增7張）。PR #10由使用者自行Merge；Safari待真機。
