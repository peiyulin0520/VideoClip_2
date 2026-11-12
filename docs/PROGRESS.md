# 進度（給接手的人／AI：先讀這份最上面的「交接快照」）

規則：每完成一個有意義的步驟，就在同一個 commit 裡 **覆寫「交接快照」** 並 **在「日誌」最上面新增一筆**（規則全文見 `AGENTS.md`「紀錄規則」，背景與架構見 `docs/HANDOFF.md`）。

## 交接快照（VideoClip_2 最新狀態）
- **日期**：2026-11-12
- **目標儲存庫**：`https://github.com/peiyulin0520/VideoClip_2`
- **工作分支**：`codex/establish-little-moments`；main 原有初始 commit `2f8bdf9` 保留。最新本機程式 commit 見 `git log -1`；推送狀態見下方。
- **來源**：`peiyulin0520/VideoClip` main `78b178343409c46c7ba353ef3a6db6f279a7bde6`（PR #3 已合併）。以下舊日誌屬來源 repo 的歷史，不代表 VideoClip_2 的部署/瀏覽器驗收。
- **本次明確子任務**：新一批完整剪輯流程：自由色塊/間隔、GIPHY 裝置 Key、跨專案自己的素材/畫作、手動描邊與 crop、同裝置續用、主題/色輪/裝飾長度透明度、播放效能、原音/配樂、完整影片輸出。見 docs/plans/2026-11-12-editor-completion.md；目前開發中，舊正式站尚未更新。
- **已驗證**：本次本機 237 單元、lint、TypeScript、build、Pages 檔案/39 字型授權檢查全過。瀏覽器共 60 個情境（新增 10 個，含完整影片/音訊解碼驗收），首輪 run 43146355291 為 235 單元/57 of 60 e2e 成功；已修正 3 項失敗，待第二輪 CI。上一正式版驗收 227/50 保留歷史紀錄，不能當成新功能已驗證。
- **瀏覽器驗證**：Playwright 1.63 / Chromium 153、iPhone 13 畫面尺寸；45 張本次生成截圖已更新至 docs/screenshots（含 usability/ 7 張），來源工作分支 run 43130792200 / artifact 13904869854。已人工檢視四格相紙、字塊、全畫面預覽及白底開場，繁中可讀、選取框不跨格。iPhone Safari 仍需真機測試。
- **階段**：本次已寫好自由色塊/時間軸、自己的素材庫與手繪、GIPHY、手動遮罩/crop、音訊/配樂、完整逐格及相容影片匯出、主題/色輪/裝飾；尚待新 CI/真機。完整雲朵字、動畫轉場、調色、備份/Drive、IG 音源等其餘規劃未實作。
- **發布狀態**：本次 8 項編輯體驗更新已正式發布：https://peiyulin0520.github.io/VideoClip_2/ 。部署程式 c9709edbb07e8a2488ce10d31e049ccae7f094b5；Actions https://github.com/peiyulin0520/VideoClip_2/actions/runs/43131468570 成功。公開 HTML/manifest/JavaScript HTTP 200，index-D1Rss_6p.js 的 SHA-256 與本機驗證建置完全一致，並含新功能標記。後續 [skip ci] 提交只更新交接文件及驗收圖，不代表另一次程式部署。
- **下一步**：新功能工作分支 CI 60 情境及截圖 → 修正實際失敗 → main 發布 → iPhone Safari 真機音訊/匯出/儲存與效能驗證。
- **等使用者**：目前不需再做帳號授權；程式及 Pages 設定已可存取。發布後再請使用者進行 PLAN §7 的 iPhone Safari 實測。

## 日誌格式（新增一筆時照這個）
```
- YYYY-MM-DD <一句話標題>（分支/commit）
  - 做了什麼：…
  - 動了哪些檔：…（重點檔案/資料夾）
  - 驗證：✅ …（測試/截圖路徑）  🟡 只在 Chromium：…  🔴 沒做/做不到：…
  - 使用者的決定/回饋：…（原話或精準摘要）
  - 踩到的坑：…（同步補到 docs/HANDOFF.md §5）
  - 下一步：…
```

## 使用者已確認的偏好
- 2026-11-12 新回饋：留白像素材可拖到任何段落；可以主軌插入、色塊圖層與自由時間軸。自己的貼圖/畫作可選擇收藏，GIPHY 不入共用素材庫。
- GIPHY API Key 由裝置自己輸入/儲存，不能寫進公開程式碼、日誌或專案。使用者在聊天提供過 Key，此文件不抄錄。說明要連 GIPHY 申請，應用名稱 LittleMoments / Web。
- 同手機同瀏覽器繼續使用保留字體、收藏與未完成專案；首次流程提供明確的續用選項。
- 需要可調主題、彈出色輪/RGB、裝飾長度與透明度及更大範圍；播放要順暢，影片原音/配樂可操作，完整影片匯出為必要功能。

- 最新實測（本次）：**移除預覽內浮動縮放/刪除圓鈕**，點選框後兩指直接縮放，取代先前右上角圓鈕需求。希望預覽更大、文字清楚、自訂任意顏色，裝飾可離文字遠近，輪廓可調柔和/凹槽。
- 最新實測：要拍貼/膠卷多格影片與滑動效果；第一支影片可延後出現，以黑/白/自訂底色做文字首圖。

- 2026-11-11：指定新 repo `peiyulin0520/VideoClip_2`，要求先依 `peiyulin0520/VideoClip` 的內容和指示建立網頁；沿用先前確認的名稱 Little Moments。
- 2026-11-11：Icon、自己畫的東西與疊加素材要有選擇儲存、供其他影片重用的素材庫（PLAN R22）；星光手體即星光小熊貓幼兒體，檔案僅本機匯入。
- 新專案比例預設「自動：跟第一支影片一樣」，但之後可以調整修改（2026-11-11 使用者選 A：「跟第一支影片一樣，但保留之後影片可以調整修改」；先前誤記為 B）
- **每次的進度都要記錄成檔案，之後可以用 ChatGPT 等其他 AI 直接讀檔無縫接手**（2026-11-11 使用者要求）→ 見 AGENTS.md「紀錄規則」
- 字體選擇用下拉式選單，放在字卡頁籤
- 字卡/icon 選取時右上角有縮放（調大小）鈕，可拖移位置
- 字塊內距上下左右可分開調（修正字上方色塊多、下方貼底）
- 尾端圈圈參考圖 docs/reference/tail-loop-underline.jpg 只是**示意圖**（2026-11-11 使用者說明）：形狀神韻像即可，不必逐像素重合
- 雲朵字不必很蓬鬆，有那個效果即可
- VLOG 效果：底層完整影片 → 中層文字 V L G → 上層只保留人頭的影片（使用者自己描邊剪裁/擦除），不是自動去背
- Office 圖案指方塊、雲朵、對話框等素材，可當字卡底塊
- 調色功能做在 App 裡
- 佮逸體可放字庫（非商業使用）
- 要更多可愛字卡設計
- 網站放免費 GitHub Pages，repo 已改為公開（2026-11-11）
- 字體用使用者提供的清單（fonts/manifest.json）；使用者表示都是開源資源，非商業使用、不改版
- 「星光手體」＝星光小熊貓幼兒體；「中規中矩體」＝Proper Script；Zizi「一致宋體」＝致一宋體
- 首次使用就讓每個人選專案備份位置：「存在手機檔案」或「存到 Google 雲端」（可貼 Drive 資料夾網址，或登入後在選擇器裡找資料夾）；之後可在設定頁改（2026-11-11 使用者確認：照 PLAN.md 的流程做）
- 備份資料夾保持私人；只貼網址不登入無法寫入（Google 限制），已向使用者說明

## 使用者的修正紀錄（時間順序）
- 2026-11-11 iPhone 實測回報：「預覽畫面中會有粉色斜底區塊，不懂那個意思，是因為我前面選了尺寸 9:16？但不是應該影片要直接 match 整個黑框比較好嗎，多了一個粉底還需要手動縮小調整很麻煩」→ 原因是平台安全區參考線（預設開）＋主軌被選取時的選取框；修改規劃見 docs/plans/2026-11-11-safe-zone-and-selection.md。另從截圖看到：iPhone 上時間軸片段沒有縮圖
- 2026-11-11 要求把每次進度都記錄下來，供其他 AI（如 ChatGPT）銜接 → 新增 AGENTS.md、docs/HANDOFF.md、交接快照與日誌格式
- 2026-11-11 選 B：先做字體下載＋首次使用精靈，再做字卡引擎
- 2026-11-11 找到新字體來源 max32002/pop-gothic（大波浪圓體，含注音）→ 已加入手寫可愛包。問「能不能直接下載到我的 files 下載資料夾」→ 答：網頁在 iPhone 不能自動寫進「檔案」App 資料夾；官方字體存在瀏覽器裡，自己的字體用「匯入字體檔」從檔案 App 選

## 日誌（最新在最上面）
- 2026-11-12 首輪影片/音訊驗收通過，修正續存與彈出面板/相容格式
  - run 43146355291：235 單元、57/60 e2e 成功。真正匯出的文字/原音、延後配樂、透明 GIF 與下載通過；預覽音量分析證實原音開關有作用；GIPHY Key 隔離/重開、自己的畫作、自由間隔與既有 50 情境全過。
  - 收藏重用後立刻重整仍在 800ms debounce 視窗會丟專案最後一筆；Autosave 改立即寫入、執行中的修改合併最新 immutable snapshot，綁定 projectId 避免切專案的舊迴圈寫到新專案。新增 2 個回歸單元（總 237），素材加入完成前等待 flush。
  - Crop Sheet 內容高於手機可視範圍，按鈕在畫面外；所有 Sheet 改 portal 到 body、限制高度且可捲動。繪圖畫布也固定正確比例，避免被 max-height 擠扁。
  - 相容錄製原只看 MediaRecorder 支援，generic MP4 可能選到無法再解碼的格式；改指定 AVC/VP9/VP8 並檢查 VideoDecoder 或原生播放能力，輸出 canvas 用偶數尺寸/所選 fps。
  - 加入 GIPHY 官方 API attribution 標誌（官方提供 zip，原樣保留，public/branding/GIPHY-SOURCE.txt）。Key 沒有加入程式或文件。照片 blob URL 留到輸出完成才撤銷。
  - 首輪 screenshot 人工檢視暖棕設定與完成匯出（WebM），新畫面繁中可讀；正式站仍保持舊版，待修正後完整 CI。

- 2026-11-12 完整剪輯流程首輪實作（待瀏覽器 CI）
  - 新增素材/音訊分頁；主軌可插色塊、色塊可當自由圖層、freeMain 保留間隔；本機收藏與畫作可重用；GIPHY 個人 Key 只在 meta 儲存，搜尋不進收藏、選用 GIF 隨專案保留。
  - 字卡色輪/亮度/RGB、裝飾長度透明度與大範圍；五種主題；同裝置續用不重設。DB v2→v3 新 library，遷移測試確認字體與專案保留。
  - 手動套索與四邊/角落 crop；同一合成器預覽/單格/完整影片皆套用透明遮罩。gifuct-js 2.1.2（MIT，public/licenses）按專案時間解碼 GIF。
  - 預覽預設 1080，可選 720/1920；媒體貼圖只上傳預覽需要的尺寸/解碼格，文字另用超取樣，降低 React 更新頻率。AudioBus 由使用者播放解鎖，共用原音/配樂輸出，可分離、移除、修剪、調音量。
  - 完整影片：Mediabunny/WebCodecs 逐格合成，音訊每 10 秒 OfflineAudioContext 混合；可用時 MP4/H.264/AAC，其他環境 WebM。相容 MediaRecorder 即時匯出另列選項，進度/取消/下載/分享皆有介面。指定字體載入失敗會提示，不默默改字體。
  - 驗收：235 單元及完整 check 成功，新增 10 e2e（總 60），含真正輸出影格/音訊/延後音樂、GIF、相容匯出、儲存/Key隔離。新匯出情境有明確 90/120 秒預算；既有測試仍 30 秒。CI browser job 為新增影片編碼驗收延長至 20 分鐘，序列執行。
  - 公開網站仍是前一部署，待本次 CI 成功後更新。沒有把使用者實際 Key、影片或參考圖提交至儲存庫。

- 2026-11-12 八項 iPhone 編輯體驗更新正式上線
  - 部署 c9709edbb07e8a2488ce10d31e049ccae7f094b5，main run 43131468570：227 單元/50 e2e 全過、Pages deploy 成功。程式內容最後變動為 af131aa；其後拆分驗收情境與設定序列 CI，沒有降低解析度或跳過斷言。
  - 公開 HTML/manifest/JavaScript 均 HTTP 200；主程式 index-D1Rss_6p.js 的 SHA-256 與本機驗證建置完全一致，確認包含開場留白/多格/形狀輪廓/放大預覽等新功能。網址 https://peiyulin0520.github.io/VideoClip_2/。
  - 45 張最新驗收圖取自同程式工作分支 run 43130792200 / artifact 13904869854，已人工檢視新版四格；本提交只同步交接及截圖，使用 [skip ci]。下一步是 iPhone Safari 真機確認，未把 Chromium 模擬當成真機通過。

- 2026-11-12 227 單元與 50 瀏覽器驗收全部通過，正式部署中
  - 最終程式 c9709edbb07e8a2488ce10d31e049ccae7f094b5，工作分支 run 43130792200：227 單元與 50/50 e2e 全過（3.9 分鐘）；片尾/片頭/復原 5.9/5.5/4.2 秒，拍貼膠卷 10.7 秒、四格動態 11.3 秒。全部原斷言/截圖保留，沒有提高單項時限或新增重試。
  - 45 張新圖更新至 docs/screenshots，來源 artifact 13904869854。main 一般 fast-forward 到同一 SHA，部署 run 43131468570 進行中。資料在原裝置、舊專案不重設；Safari/HEVC/HDR/真機多格效能仍待使用者實測。

- 2026-11-12 修剪驗收通過；拆分多格的綜合驗收
  - run 43129673834：227 單元與 48/49 e2e 成功；片尾/片頭/復原分別 9.2/8.8/6.3 秒通過。剩多格單項一次匯入四素材、三次套版、PNG 輸出、三張截圖、兩種動畫，總時限在第三張截圖時逾時；沒有像素/資料斷言失敗。
  - 將原多格單項拆成拍貼/膠卷（含不同素材與輸出取樣）及四格動態（含 slide/drift 取樣及移除）兩個獨立情境，保留全部斷言、截圖、原 30 秒時限，總共 50 e2e。網站程式不再變更。

- 2026-11-12 拆分長修剪驗收，序列執行瀏覽器以免軟體 WebGL 爭用
  - run 43128729462：227 單元/46 e2e 成功，修剪從舊版第三個拖曳推進到第五個拖曳後才超過整項 30 秒。其他流程普遍比 11-11 慢 1.5–2 倍；同一 608c7d0 先前分支成功、main 運行慢而逾時，顯示 runner 效能有差異。
  - 保留片頭/片尾素材邊界與單手勢復原的全部斷言，拆為 3 個獨立測試（總數 49），不用一個 30 秒預算塞五次手勢；CI browsers 改 workers=1，避免同時高解析度軟體 WebGL/解碼爭用 CPU。不加重試、不延長單項逾時、不跳過測試。程式仍是已補強排程的 af131aa。

- 2026-11-12 正式分支效能回歸：合併修剪邊緣預覽重畫
  - main run 43127717473：226 單元成功，46/47 e2e 成功；五次連續拖修剪把手在 30 秒總時限逾時，沒有發布新版。其餘新功能全部成功；同一程式工作分支原已 47/47 成功（2.6 分鐘）。
  - 根因：每個 trim move 同時引發 store refresh 的排程重畫與 peek 的同步重畫；改為同一 RAF 僅畫最後的邊緣時間，解碼通知也沿用該時間，放開後回播放頭。每次修剪用唯一 gesture key，跨停頓仍只一步復原，不合併前後不同手勢。
  - 驗收：不提高測試逾時、不跳過測試；新增 Player 排程回歸測試，目前本機 227 單元與完整 check 通過；待修正版完整 CI。公開站目前仍是前一正式版本。

- 2026-11-12 八項 iPhone 編輯體驗回歸驗收完成，發布中
  - 程式 608c7d0f947287ad3459fbd8f07d5370c804136b；工作分支 run 43076680996：226 單元與 47/47 e2e 全過（2.6 分鐘），沒有放寬逾時或跳過失敗測試。多格版型驗收包含實際像素滑入/漂移與輸出單格。
  - 45 張 CI 截圖更新至 docs/screenshots，新增 usability/ 7 張；人工檢視四格相紙、字塊控制、全畫面文字預覽。素材均為合成色塊/圖，沒有使用者影片或第三方參考圖。
  - main 已一般 fast-forward 到同一程式，正式發布 run 43127717473 進行中。iPhone Safari、HEVC/HDR 與多格真機效能尚未驗證。

- 2026-11-11 修正首輪瀏覽器回歸的效能與手勢歷史
  - 首輪 run 43073904802：225 單元成功，39/47 e2e 成功；8 失敗包含操作逾時及一次拖曳拆成多次復原。首格、自由顏色、開場底色/保存等新驗收已通過，公開 main 尚未更新。
  - 高解析度畫面只在解碼影格、來源/裁切或尺寸變動時上傳媒體貼圖，暫停的文字/位置編輯合併每幀重畫；首格 frameStamp 保證不沿用未解碼快取。唯一 gesture key 不再受 800ms 中途停頓限制，滑桿仍用原時間窗。
  - 多格選取框改為格子的固定範圍；新增長停頓手勢復原單元與滑入/漂移實際畫面斷言。已人工檢視首輪拍貼與放大預覽截圖（自製色塊素材）；等第二輪完整驗收。

- 2026-11-11 iPhone 編輯實測 8 項修正（待 CI）
  - 實作：首格解碼 priming/事件補強；移除畫面圓鈕，雙指及放大預覽；完整 HEX/picker；裝飾距離；輪廓柔和/凹槽；拍貼/膠卷/四格相紙三版型與滑動；1920 預覽/高密度文字；開場 offset/畫布底色。
  - 檔案：engine/{mediaPool,player,compositor,scene,layouts,textRender,shapes,decorations,timeline,geometry}.ts、model、store、app/editor、ColorPicker、e2e/usability 與既有手勢驗收。
  - 驗證：225 單元、lint、TS、build 成功；新增 5 e2e（共 47）等待 CI。尚未驗證 Safari 真機、HEVC/HDR、多格同時解碼的手機效能。
  - 進度：只更新工作分支，main/上線狀態以後續部署紀錄為準。所有專案新欄位選填，舊資料不重設；舊字卡陰影保留。

- 2026-11-11 完成 GitHub Pages 發布與可讀手機截圖驗收
  - 最終程式 af14c795cbecb09c1d286ab1fcd6e9168b24cae5，main Actions 43061662930：220 單元/42 e2e/Pages 部署成功。
  - 38 張新截圖（artifact 13872658901）更新至 docs/screenshots，人工確認首頁中文可讀；TTF 與家族別名已解決 runner 的中文方框問題。相關截圖只含自製合成素材，沒有使用者影片。
  - 正式網址：https://peiyulin0520.github.io/VideoClip_2/；程式與 PWA 使用 /VideoClip_2/，各使用者資料在本機，與原 VideoClip 命名隔離。網站使用不需要 Codex 常駐。
  - 此提交只整理文件與驗收圖，使用 [skip ci] 避免重跑完全相同的生產程式；已部署程式的 SHA 與 CI 如上，不把文件提交當成另一次部署。
  - 下一步：使用者 iPhone Safari 真機實測；依既定次序再做 P3A 貼圖，不自動擴大到其他 Phase。

- 2026-11-11 修正 CI 系統中文字型封裝格式
  - CI 43060505717 已再度通過 220 單元/42 e2e 並部署，但人工檢視 home.png 的 SHA 和先前方框版本相同；日誌 fc-match 輸出 DejaVu Sans，證明 WOFF2 未被 runner 預設字型設定採用。
  - 將現有 OFL Noto Sans TC VC Subset 僅轉換容器為 TTF，放 tests/fixtures 並附同一 OFL。CI 安裝該 TTF，加入 Noto Sans TC→Noto Sans TC VC Subset 的 fontconfig 家族別名，並新增 fc-match（中字）必須包含 Noto Sans TC 的斷言。網站 public 字型與生產程式不改。
  - 本機以預設 fontconfig + 獨立 XDG 字型/別名設定，確認原 CSS 家族 Noto Sans TC 的中字能選到 TTF。最終截圖仍需以本修正之後的 CI 為準。

- 2026-11-11 首次正式 GitHub Pages 上線
  - main 已一般 fast-forward 至 49f3bd79ca516067827dde6d4dba37e67bee242f，Actions run 43059868070 的 build、42 e2e、Pages deploy 全部成功。
  - 正式網址 https://peiyulin0520.github.io/VideoClip_2/；HTTP 檢查確認 HTML 200、Little Moments title、manifest scope=/VideoClip_2/、主 JavaScript 200/MIME 正確。
  - iPhone Safari 尚未真機驗證。程式碼與資料模型沿用參考庫目前完成的階段，未實作的繪畫/完整影片匯出/素材庫仍屬後續工作。

- 2026-11-11 瀏覽器驗收通過，補齊截圖用繁中字型
  - CI 43059345131：220 單元、lint、build、Pages 靜態檢查、42 e2e 全過（Chromium 153，Playwright 1.63）。main 以一般 fast-forward 更新至 49f3bd79ca516067827dde6d4dba37e67bee242f，Pages run 43059868070 進行中。
  - 實際下載並檢視 artifact 13873910247 的首頁圖：品牌正確，但 runner 沒有系統 CJK 字型，UI 出現 tofu 方框；功能斷言通過不能代表截圖可讀。
  - 修正 CI：從 public/fonts 取現有 OFL Noto Sans TC 到 runner 使用者字型目錄並 fc-cache，不依賴 apt 或新增網路下載。這是測試環境修正，不改使用者字體設定；以後的驗收圖只用補齊字體後的 run。

- 2026-11-11 修正首次 CI 的瀏覽器準備環境
  - 證據：run 43057394524 / job 130650406213 的 npm ci/check 成功；安裝依賴超過八分鐘，取消後日誌顯示 archive.ubuntu.com、security.ubuntu.com、azure.archive.ubuntu.com DNS 失敗。既有系統圖形函式庫皆已安裝，卡在補裝額外字型。
  - 修正：移除 Playwright --with-deps，僅安裝鎖定的 Chromium headless shell；瀏覽器安裝限五分鐘、測試限十分鐘。CI 先清除來源 repo 的舊 screenshots，只有瀏覽器測試實際執行後才上傳 artifact，避免把來源截圖當成新驗收。
  - 未修改任何剪輯功能；下一步等待修正版 CI 的 42 e2e，再發布 main。

- 2026-11-11 GitHub 授權完成、首次推送與 CI（目前進行中）
  - 已驗證 GitHub App installation 可用；普通 git push 成功，遠端工作分支為 3f6b98ef90adf2de98c54c277a3599583c98f6c4。
  - Pages 已設定 workflow，網址為 https://peiyulin0520.github.io/VideoClip_2/；目前 main 仍是初始 commit，不能當成新版已上線。
  - CI：https://github.com/peiyulin0520/VideoClip_2/actions/runs/43057394524。npm ci 和 npm run check 成功，正在安裝 Chromium；42 個 e2e 尚未開始。
  - 下一步：確認 CI 結果、必要時修正，再 fast-forward main 發布。沒有開 PR，也未 force push。

- 2026-11-11 釐清 GitHub 帳號連線與 repository 安裝授權狀態（只有文件）
  - 使用者回覆「已連接」；已驗證 GitHub 外掛 installed=true、CLI user 為 peiyulin0520、目標 repo metadata 可讀。
  - 推送 dry-run 回 403；connector create_branch 回 Resource not accessible by integration。沒有建立遠端分支或其他遠端修改。
  - list_installations 與 list_installed_accounts 皆為空。透過 GitHub Apps API 驗證官方 app slug 為 chatgpt-codex-connector、owner=openai，permissions 包含 contents/workflows/actions write。
  - 已提供該 App 的官方 installation URL，請使用者選擇 VideoClip_2。下一步等實際安裝完成後再驗證，不把帳號的 admin=true 當成 integration 已取得寫入權限。

- 2026-11-11 VideoClip_2：依參考庫建立 Little Moments（codex/establish-little-moments）
  - 做了什麼：保留新 repo 原始 main 歷史，匯入來源已追蹤的程式/規格/可再散布字體；改名稱、Pages 路徑、PWA scope/id/start_url；隔離 IndexedDB/OPFS/字體快取/偏好。原來源和 Sites 未修改。
  - 動了哪些檔：vite.config.ts、index.html、src/app、src/storage、src/fonts/fontStore.ts、e2e、scripts/verify-pages.mjs、.github/workflows/deploy.yml、README、AGENTS 和交接文件。
  - 驗證：✅ 來源 npm ci、check（218 單元）；✅ 新版 check（220 單元，包含舊 DB/OPFS 相同 ID 讀寫刪除隔離）；✅ Pages 靜態檢查（39 字體/授權/PWA/資源）。42 個 e2e 僅列出；未執行瀏覽器或產生新版截圖。來源截圖保留但不當作本次證據。GitHub CI 新增 Chromium e2e 和 artifact。
  - 使用者決定：使用 VideoClip_2，不再新建 little-moments repo；先遵循 VideoClip 文件建立。
  - 踩坑：同一個 github.io 網域下不同路徑仍共用 browser origin，因此儲存名稱必須獨立；現有 GitHub 憑證驗證失敗，公開 clone 成功不代表可推送。
  - 下一步：連接 GitHub 後先驗證 CI 再部署；P3A 下一子任務仍是貼圖 icon。

- 2026-11-11 Phase 3A 第 4 步前半：圖形庫（分支 claude/zen-tesla-v3brj5，Sonnet）
  - 做了什麼：新 `engine/shapes.ts`：**33 種 Office 風格圖形**（自己用路徑畫，沒用任何現成圖檔）。基本：方形、圓角、膠囊、橢圓、三角形、菱形、斜切色塊、梯形、五邊形、六邊形、八邊形、十字、剪角、愛心、雲朵、圓柱。對話框：方／圓角／橢圓對話框（尾巴可選左下／右下）、思考泡泡、爆炸對話框。星形：4／5／6／8 角星、爆炸、波浪印章。標籤箭頭：橫幅、標籤、粗箭頭、V 形、步驟條、文件。當**字塊**用：外框大小＝文字區×`inset`（每個圖形一組，橢圓／星形／愛心可放文字的範圍比外框小），文字區在圖形裡置中。字塊新增**外框**（顏色、粗細）、尾巴方向。**獨立圖形**（貼圖用）：沒有文字的字卡，「＋新增圖形」，大小用內距調，時間軸顯示「圖形」。字塊分頁：4 個分類＋縮圖格（縮圖用同一套路徑函式畫的）
  - 動了哪些檔：src/engine/{shapes,shapes.test,cardLayout,textRender}.ts、src/model/{types,defaults}.ts、src/store/actions.ts、src/app/editor/{ShapeThumb,TextPanel,Toolbar,Timeline}.tsx、styles.css、e2e/phase3a-shapes.spec.ts、docs/TEXT_CARDS.md
  - 驗證：✅ 單元測試 134 個（每個圖形：座標有限、主體在範圍內、**文字區（外框÷inset）在 3 種長寬比下四角和四邊中點都落在圖形內**、尾巴往下超出且左右方向不同）；✅ e2e：4 個分類、**每個圖形都點過**且資料對得上、縮圖有畫、尾巴方向、外框、換星形後預覽有粉紅和白字、獨立圖形新增/改愛心/加第二個；截圖 docs/screenshots/phase3a/（shapes-sheet 33 種放字總覽、speech-bubble、shape-picker-stars、standalone-heart）；218 單元＋42 e2e 全過，連跑 2 次穩定  🟡 只在 Chromium  🔴 沒做：貼圖 icon（Fluent Emoji）、手繪感、漸層填色、虛線外框、閃電/月亮/太陽/笑臉/緞帶/捲軸/流程圖/線條類圖形
  - 踩到的坑：bezier 控制點會超出曲線，量圖形範圍的測試要用曲線上的點（`flatten`）；`inset` 不能只調一組數字——先寫「文字區放得進圖形」的測試，再用掃描找最小值；星形四角、閃電的可放文字區太小，已拿掉閃電、四角星 inset 4.1
  - 下一步：貼圖 icon，或先請使用者看圖形總覽
- 2026-11-11 Phase 3A 第 3 步：字卡裝飾（分支 claude/zen-tesla-v3brj5，Sonnet）
  - 做了什麼：新 `engine/decorations.ts`（純計算：墨跡矩形 → 繪圖指令，可單元測試）。13 種：尾端圈圈（照規格路徑）、波浪底線、虛線、點點線、雙底線、螢光筆、手繪圈住（頭尾不閉合）、彎箭頭、星星、愛心、斜線、打勾、角括號。`TextCard.decorations`（可疊多個，各自顏色、粗細＝佔字高比例）。畫在字後面；畫布四周依裝飾範圍自動多留邊。文字面板新分頁「**裝飾**」：3 欄格子，**每格縮圖是用範例字「好看」真的畫出來的**；點一下加、再點拿掉；已加的每個有顏色和粗細，可「移除」。尾端圈圈：字很長時圈圈固定大小貼字右緣（不被拉扁）
  - 動了哪些檔：src/engine/{decorations,decorations.test,textRender,debug}.ts、src/model/types.ts、src/app/editor/{DecoThumb,TextPanel}.tsx、styles.css、e2e/phase3a-deco.spec.ts、e2e/helpers.ts、docs/TEXT_CARDS.md、AGENTS.md
  - 驗證：✅ 19 個裝飾單元測試（尾端圈圈位置/超出比例/長字不拉扁）；✅ e2e：13 格縮圖都有畫東西、每一種都點得動（加／拿掉）、改顏色粗細後預覽像素變化、疊兩個、移除、復原；截圖 docs/screenshots/phase3a/（decorations-sheet 13 種總覽、tail-loop-short/long、deco-picker、deco-two）；84 單元＋39 e2e 全過，整套連跑 5 次穩定  🟡 只在 Chromium  🔴 沒做：裝飾動畫（drawOn，Phase 4）、tail-loop-double、dot-line、number-badge、cloud/speech-frame（等圖形庫）、裝飾位置微調
  - 使用者的決定/回饋：「A，然後我給你的參考圖只是示意圖」→ 尾端圈圈不必疊圖到逐像素重合（已改 TEXT_CARDS §3.1、AGENTS 規則 9、偏好）
  - 踩到的坑：e2e 的 `project()` 要等 `window.__videoclip` 出現（機器忙時預覽引擎晚建好），整套平行跑偶爾失敗 → helpers 裡統一等待
  - 下一步：第 4 步圖形庫
- 2026-11-11 Phase 3A 第 2 步：字卡面板（分支 claude/zen-tesla-v3brj5，Sonnet）
  - 做了什麼：文字分頁改成 4 個子頁。**文字**：內容、字體、大小、顏色、粗體、斜體。**版面**：字距、行距、寬度（依文字／固定寬度滑桿）、對齊。**字塊**：無／方形／圓角／膠囊、顏色、透明度、圓角、**內距上下左右四個滑桿＋四邊連動鎖**、文字上下微調。**描邊陰影**：外層／內層兩層描邊（顏色＋粗細）、陰影開關與模糊。「＋新增」放在分頁列上；字卡面板比其他面板高（34dvh）、分頁列捲動時固定、控制項縮小（≥38px，滑桿 44px）
  - 動了哪些檔：src/app/editor/TextPanel.tsx（新）、src/ui/Slider.tsx（新，從 Toolbar 抽出）、Toolbar.tsx、textRender.ts（描邊厚度 0 的層略過）、styles.css、e2e/phase3a-panel.spec.ts
  - 驗證：✅ e2e 逐一點過每個按鈕／滑桿並檢查專案資料與預覽像素（字塊顏色出現在預覽）；截圖 docs/screenshots/phase3a/（box-default、box-padding-separate、stroke-two-layers）；65 單元＋37 e2e 全過  🟡 只在 Chromium；🔴 iPhone 觸控手感、滑桿好不好拖未驗證  🔴 尚未做：漸層、發光、直排、多段文字（面板只編輯第一段）、字塊的尾巴／斜切／描邊
  - 踩到的坑：字卡面板太高會把預覽擠很小（iPhone 13 尺寸下預覽只剩約 200px 高）→ 控制項縮小、分頁列固定；需要大預覽時點底部「文字」分頁可收合面板。flex 容器裡的圓形色票會被壓成橢圓，要 `flex:none` 加 `min-height`
  - 順手修：`fix-thumbs` 的「有縮圖」測試在機器忙（整套平行跑）時偶爾失敗（縮圖晚到）→ 改成輪詢；整套連跑 2 次 37/37 過
  - 下一步：第 3 步尾端圈圈與裝飾
- 2026-11-11 Phase 3A 第 1 步：字卡型別擴充＋逐字排版引擎（分支 claude/zen-tesla-v3brj5，Sonnet）
  - 做了什麼：`TextRun` 加 `italic/strokes/shadow`、`TextCard` 加 `width/box`、新 `CardBox`（形狀 rect/roundRect/pill、顏色、透明度、四邊內距、垂直微調、圓角）——全是選填，舊字卡不用轉換。新 `engine/cardLayout.ts`（純計算、量字器可注入）：逐字排、字距（em）、固定寬度自動換行（中文逐字、英文在單字邊界、太長硬斷、避頭尾）、對齊、字塊尺寸＝墨跡邊界＋四邊內距。`textRender.ts` 改成用它畫：字塊→多層描邊（由外到內）→陰影→文字，斜體用斜切。新字卡預設帶陰影（舊字卡不再有預設陰影）
  - 動了哪些檔：src/model/{types,defaults}.ts、src/engine/{cardLayout,cardLayout.test,textRender,debug}.ts、e2e/phase3a-layout.spec.ts
  - 驗證：✅ 12 個排版單元測試（假量字器）；✅ e2e 在真的 Chromium 用真字體（粉圓、饅頭黑體、霞鶩文楷）量像素：字上下左右內距跟設定一致（±2px），上 10／下 60 分開調也對  🔴 還沒有介面可以設字塊（第 2 步）；粗體用字型本身的 700（沒有用描邊模擬）；直排、漸層、發光未做
  - 踩到的坑：量字器的 `right` 要從 pen 起算（`actualBoundingBoxRight`），不是從字寬末端
  - 下一步：第 2 步字塊與內距 UI
- 2026-11-11 實作 4 項實測修正 A/B/C/D（分支 claude/zen-tesla-v3brj5，Sonnet）
  - 做了什麼：
    - D 自動比例：新專案預設「自動（跟第一支影片）」；比例多 3:4、4:3；編輯器頂列「畫面比例」按鈕（可復原、可切回自動）；空白專案第一次匯入主軌時自動決定；字卡大小/外框改跟短邊（`uiScale`）；改比例時預覽重建並回到原播放時間
    - A 安全區：預設關（新 key `vc-safe-zone-v2`）、拖移/縮放時自動出現、虛線＋標籤「IG／抖音按鈕區」、按鈕有「安全區」字、打開時 toast 說明
    - B 主軌：匯入後不自動選、預覽單點不選不拖、從時間軸選才有細框、沒有 ✕、保留縮放鈕；疊加物件照舊
    - C 縮圖：匯入用 Mediabunny `CanvasSink`，失敗退回 `<video>`，再失敗由預覽播放器拿到畫面後補一張（`setAssetThumbs`，不進復原）；沒縮圖時時間軸顯示檔名
  - 動了哪些檔：src/model/{types,defaults}.ts（+defaults.test.ts）、src/store/{actions,projectStore}.ts、src/engine/{probe,player,scene,compositor,textRender,geometry}.ts、src/app/editor/{Preview,Timeline}.tsx、src/app/pages/{Home,Editor}.tsx、styles.css、e2e/{fix-aspect,fix-safe-zone,fix-thumbs}.spec.ts、phase2.spec.ts（點角落改成不選取）
  - 驗證：✅ 53 單元＋33 e2e 全過；截圖在 docs/screenshots/fix-safe-zone/；✅ 模擬「iPhone 行為」（沒有 VideoDecoder、probe 的 `<video>` 聽不到 loadeddata）時，播放器會補上縮圖，重新整理後仍在；✅ Chromium 下 Mediabunny 路徑有效（匯入 0.4 秒完成，沒有等 8 秒）  🟡 Chromium：以上全部  🔴 沒驗證：iPhone Safari 的 WebCodecs/HEVC 解碼、直拍 .mov 的自動比例、觸控手感（列進 PLAN §7）
  - 使用者的決定/回饋：選 A（4 項一起做）；比例「A 跟第一支影片一樣，但保留之後可以調整」
  - 踩到的坑：Pixi destroy 後不能在同一個 canvas 重建 WebGL（頁面卡死）→ 比例改變用 `key` 換新 canvas；e2e 要等 `__videoclip` 出現；模擬 iOS 時要用 `webkit-playsinline` 屬性區分「探測用 video」與「影片池 video」
  - 下一步：使用者決定是否合併到 main 以便 iPhone 重測；之後 Phase 3A
- 2026-11-11 補完自動比例（§2-D）的實作規劃＋存草稿 patch（分支 claude/zen-tesla-v3brj5，只有文件）
  - 做了什麼：中斷前寫好的 D 程式草稿存成 （草稿 patch 已套用並刪除），程式還原（使用者要的是規劃，實作交給 Sonnet）。規劃 §2-D 加「實作細節」：草稿涵蓋範圍、還缺的 3 件事、e2e 清單、已知行為
  - 動了哪些檔：docs/plans/2026-11-11-safe-zone-and-selection.md、docs/plans/2026-11-11-aspect-auto-draft.patch（新）、docs/PLAN.md §7、docs/HANDOFF.md §4
  - 驗證：✅ 草稿 `tsc -b` 通過、`defaults.test.ts` 12 個單元測試通過  🔴 草稿沒跑 lint／e2e
  - 使用者的決定/回饋：「A跟第一支影片一樣，但保留之後影片可以調整修改，根據這個做相關規劃」
  - 踩到的坑：字卡大小現在用「畫面寬 ÷ 1080」，改成 16:9 時字會放大 1.78 倍 → 規劃建議改用短邊
  - 下一步：照規劃實作 D → A → B → C
- 2026-11-11 更正：新專案比例使用者選 A（自動跟第一支影片，之後可改）。先前因為使用者誤解選項而記成 B（不做）；已更新規劃 §2-D 與偏好。程式未改。
- 2026-11-11 使用者回覆修改規劃 §2-D：選 B（不做自動比例）。已更新規劃與偏好；程式未改。下一步不變：照規劃實作 A→B→C
- 2026-11-11 寫修改規劃：粉紅安全區、主軌選取框、iPhone 縮圖（分支 claude/zen-tesla-v3brj5，只有文件）
  - 做了什麼：依使用者實測截圖查程式，確認粉紅斜線是預設開啟的「平台安全區參考線」（Preview.tsx 的 readSafe 預設開）、白框與 ✕ 是主軌選取框（匯入後自動選取＋點預覽一定打到主軌）、灰色片段是 iPhone 上 `<video>` 沒觸發 loadeddata 所以 probe 沒產生縮圖。寫成可照做的規劃（原因表、要改的事、檔案、驗收、要調整的既有測試、回覆使用者的話）。
  - 動了哪些檔：新增 docs/plans/2026-11-11-safe-zone-and-selection.md；docs/PROGRESS.md
  - 驗證：只有文件；程式未改
  - 使用者的決定/回饋：要求先寫規劃，之後用 Sonnet 實作
  - 下一步：照規劃實作（A 安全區 → B 主軌選取 → C 縮圖）；D 自動比例要做（使用者選 A，細節在規劃 §2-D）
- 2026-11-11 Phase 1–3B 合併上線（PR #2，分支 claude/zen-tesla-v3brj5 → main）
  - 做了什麼：開 PR #2；GitHub 上的 build 檢查成功；使用者合併；`main` 的 CI & Deploy（run #8）成功，GitHub Pages 已部署；取消 PR 訂閱；分支用 fast-forward 對齊 main。
  - 驗證：✅ 部署流程第一次在 main 跑成功（PLAN.md §7 原本的「部署尚未實際執行」已解除）；🟡 網站在 iPhone 上的實際表現還沒人測
  - 使用者的決定/回饋：選 A（合併上線）、訂閱 PR
  - 踩到的坑：自動模式會擋 `git push --force`；PR 合併後要對齊 main 時，用 `git merge --ff-only origin/main` 再一般 push 就好，不用強制推送
  - 下一步：等使用者手機實測回報；沒有回報前可以先做 Phase 3A（字卡引擎）
- 2026-11-11 建立交接文件，讓其他 AI 只讀檔案就能接手（分支 claude/zen-tesla-v3brj5）
  - 做了什麼：新增 `AGENTS.md`（所有 AI 共用的規則、指令、紀錄規則）、`docs/HANDOFF.md`（使用者與合作方式、需求與決定的時間順序、架構地圖、資料流、決策與原因、踩過的坑、Phase 3A 的具體拆法、驗證方式）；`CLAUDE.md` 改成指向 AGENTS.md ＋ 沙盒補充；`docs/PROGRESS.md` 加「交接快照」（每次覆寫）和「日誌格式」；`package.json` 加 `npm run check`（lint＋測試＋build）。
  - 動了哪些檔：AGENTS.md、CLAUDE.md、README.md、docs/HANDOFF.md、docs/PROGRESS.md、package.json
  - 驗證：✅ `npm run check` 通過（只動文件與一行 script，程式沒變）
  - 使用者的決定/回饋：要求每次進度都記成檔案，供 ChatGPT 等接手
  - 下一步：等使用者選（合併上線／繼續 Phase 3A／補字體檔）
- 2026-11-11 Phase 3B（字體）完成：
  - ✅ 字體管線：fetch（下載/核對 sha256/使用者提供的檔案）→ build（裁切成繁體常用字集 woff2、授權檔、預覽字樣、覆蓋率）；39 個字體約 130 MB 進 public/fonts。
  - ✅ 授權把關：讀字型檔 name table。Proper Script（All rights reserved）、星光小熊貓（禁止上傳散布）、851 手書き雜（無授權說明）→ 不放網站，只能自己匯入；字言手繪體（不可改作）→ 原檔照放；其他 OFL → 裁切並改內部名稱。
  - ✅ 首次使用精靈 3 步（第一次嗎／備份位置／下載字體包）；設定頁（字體包下載移除、我的字體、授權與來源、備份位置、儲存空間）；字卡分頁字體選單（用各自字形顯示、標示大小/缺字）；匯入自己的字體；首頁「還沒下載字體」提醒。
  - ✅ 測試：catalog 檢查（檔案存在/大小/授權）、sfnt 名稱讀取、Drive 網址解析；5 個 e2e（精靈全流程＋重新整理不再問、設定頁、換字體畫面真的變、匯入字體、首頁提醒）。截圖 docs/screenshots/phase3b/。
  - 🟡 只在 Chromium 驗證：Cache Storage 在 iPhone Safari 的行為與配額；`new FontFace(ArrayBuffer)` 載入 3–6 MB 的 CJK 字體在手機的速度與記憶體（用到才載、預覽字樣只有幾 KB）。
  - 🔴 未做：備份/還原本身（精靈只記下選擇，Phase 6 做）；罕用字（閩南語/客語）未收進網站；匯入字體沒算繁體覆蓋率；單線手寫（Hershey）動畫。
  - 測試時抓到：編輯後立刻重新整理（<0.8 秒）會丟掉最後一步（自動儲存 800ms）→ 測試改成等 1.2 秒；真實使用中離開頁面有 pagehide/visibilitychange 立刻存，但瀏覽器在重新整理時不保證 IndexedDB 寫入完成。
- 2026-11-11 Phase 2 完成（分支 claude/zen-tesla-v3brj5）：
  - ✅ 渲染改用 PixiJS 合成器（預覽與單格匯出共用 buildScene + Compositor）；每個影片物件各用一個 <video>（池 6 個，下一個片段/1 秒內要出現的疊加影片會預載）。
  - ✅ 多軌：主軌＋疊加軌＋文字軌；同一秒可疊多支影片（各佔一條軌道）；軌道順序＝圖層順序；軌道選單（隱藏、鎖定、靜音、上下移、刪除）。
  - ✅ 預覽選取框：點選最上層物件、拖移（吸附中心線/畫面邊緣/平台安全區）、右上角圓鈕縮放＋旋轉（轉到 45° 倍數會吸附）、左上角刪除鈕；雙指縮放旋轉（程式寫好）；安全區參考線可開關。
  - ✅ 圖層分頁：列出這一秒的圖層（含隱藏的）、顯示/隱藏/鎖定/上下移；選取圖層的透明度、混合模式（正常、色彩加深、濾色、覆蓋、加亮）、圓角、外框、裁切；位置大小歸位。
  - ✅ 疊加素材：長按左右拖曳移動時間（吸附播放頭與其他物件邊緣、不會和同軌重疊）、修剪頭尾。
  - ✅ 最小版文字（只有一段文字、顏色、大小、系統字體）：為了驗收「3 支影片＋1 個字卡」。完整字卡在 Phase 3。
  - ✅ 驗收：3 支純色影片＋1 個文字疊在同一秒，換順序後預覽顏色正確；匯出單格（1080×1920 PNG）與預覽在 5 個取樣點顏色一致；17 個 e2e、32 個單元測試、lint、build 都過。截圖在 docs/screenshots/phase2/。
  - 測試用除錯掛鉤：localStorage 的 vc-debug 設成 1 才會有 window.__videoclip（取樣預覽顏色、讀專案 JSON、匯出單格）。正常使用者看不到。
  - 修掉的真 bug：圖層分頁一開始不列出隱藏軌道的物件，隱藏後就沒辦法再打開 → 改成列出全部；Pixi 單格輸出尺寸會差 1px 且內容超出畫面時會位移 → 明確指定輸出範圍；外框 alignment 方向（1＝內側）。
  - 🟡 只在 Chromium 驗證：雙指縮放/旋轉預覽物件；時間軸雙指縮放；多個 <video> 同時播放（iOS 對同時解碼的影片數量與播放解鎖有限制，池子大小 6 可能要降）；混合模式在 Safari 的效果；Pixi 在 iPhone 的效能與記憶體。
  - 🔴/未做（刻意留到之後）：文字完整功能（字體、字塊、裝飾、動畫）→ Phase 3；疊加素材在不同軌道間垂直拖曳（現在只能在同一軌左右移動，換軌用圖層面板的上下移動作用在整條軌道）；拖曳排序/移動到畫面邊緣時不會自動捲動；點兩下文字直接編輯；關鍵影格；匯出整支影片。
  - 版面：iPhone 13 尺寸（高 664px）下，展開底部面板時預覽畫面偏小 → 點目前的分頁可收合面板；真機高度較高會好一些，請使用者回報是否還太擠。
- 2026-11-11 Phase 1 完成（分支 claude/zen-tesla-v3brj5）：
  - ✅ 專案管理（新增選比例、改名、複製、刪除）、多影片/照片匯入（OPFS，無法寫入時退回 IndexedDB）、主軌拼接、點選/修剪頭尾/分割/複製/刪除/前後移/長按拖曳排序/變速 0.25–4x/音量/填滿↔完整、復原重做（上限 100，拖滑桿合併成一步）、自動儲存（800ms；離開編輯器立即存）、預覽雙 <video> 預載跨片段播放。
  - ✅ lint、14 個單元測試（時間軸函式、復原堆疊）、10 個 e2e（iPhone 13 模擬，Chromium，WebM 測試素材）通過。截圖在 docs/screenshots/phase1/。e2e 抓到並修掉一個真 bug：離開編輯器時的存檔可能比首頁讀取晚，首頁會顯示舊資料 → 儲存層改成「寫入排隊、讀取等寫入」。
  - 🟡 只在 Chromium 驗證：雙指縮放時間軸（程式寫好，e2e 沒測）、iOS 播放解鎖第二個 <video>、HEVC/H.264（沙盒 Chromium 沒有 H.264，測試用 WebM）。
  - 🔴/未做（刻意留到之後）：拖曳排序時靠近邊緣不會自動捲動（片段很多時請先縮小時間軸）；修剪時預覽畫格用 peek（沒移動播放頭）；匯出（Phase 2 後）；點預覽畫面不會暫停/播放；專案 .zip 匯出（Phase 6）。
  - 套件：npm audit 有 1 個 moderate（vite-plugin-pwa → workbox-build → deepmerge），只在建置階段，不會進到網站；等上游更新。
- 2026-11-11 Phase 0 完成：Vite 8 + React 18 + TS 5.9（typescript-eslint 不支援 TS 6.1 以上，故不用 TS 7）+ Vitest 5 + Playwright 1.63（要與沙盒 Chromium 版本一致）。✅ lint、2 個單元測試、build（含 PWA）、2 個 e2e（iPhone 13 模擬，Chromium）通過；截圖 docs/screenshots/phase0/home.png。🟡 iPhone Safari 與「加入主畫面」沒測（沙盒沒有 WebKit）。deploy.yml 寫好但尚未實際跑過（要 merge 到 main 才會觸發）。
- 2026-11-11 整理使用者的字體下載紀錄成 fonts/manifest.json（78 檔，52 檔放進網站），更新 FONTS.md
- 2026-11-11 加入「首次使用選備份位置」到 PLAN.md（Phase 3 精靈、Phase 6）
- 2026-11-11 完成規劃文件；尾端圈圈路徑已與參考圖疊圖校準（docs/reference/tail-loop-calibration.png）
