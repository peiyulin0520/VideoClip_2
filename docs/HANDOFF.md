# 交接手冊（HANDOFF）

## VideoClip_2 當前交接（優先於以下來源 repo 的歷史紀錄）
- PR #8 第一輪 824dfb7 / Actions 43383883589：306/108 of 114。交接 + 的 44px 目標會擋到短素材與片尾把手；為有交接的影像列在前方分配獨立 44px，按鈕 top=-22，不改素材列 h44/拖曳候選邊界。定格改單一播放列小按鈕，細調在圖層頁；避免多一列造成初始素材低於視窗。手動 mouse reorder 先 scrollIntoView。聲音標記由觸控像素換算，精度驗 0.01 秒，不做浮點完全相等。

- 最新 11 點：PR #7 已使用者合併，main 3ca45e2。本次計畫 playback-refinement；306/114 待驗收。定格控制在 playbar，直接記錄，細調另開；模型不改名。EffectsJoin 存 UI 狀態供交接 + 進正確 A/B，專案重開清除此 UI context。已用效果置頂，防相同 pair/preset，舊重複在 editableProject 去冗餘。Preview 播放/activeTransitions 時不顯示 DOM 選取框（不清除 selectedId）；實際輸出另有像素檢查。鉛筆原固定 5 粒/像素對大筆刷過疏，增加石墨核心與按 size 增粒；brushDynamics 有變動壓力優先、否則速度/頭尾粗細。小音訊畫面與 SourceRanges 同列，移除兩舊捷徑後 e2e 要用手動 markMuteInterval。

- 最新九點最終：[Actions 43366595525](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43366595525)：版本 c74dec591b3a9bcf88e425b49dbcfdac494d43d5 的 299 單元、110 Chromium e2e 全過，lint/格式/TypeScript/build/Pages/39 字體檢查成功。 artifact 14010687940，ZIP SHA-256 9cbea2ce6c63b1e2e65c118e40d579994e1a297331a42f66cc55ef01fa0da9cb 已核對；135 張成功畫面保存。 PR #7 待使用者自行 Merge，未部署。下列首輪 106/108、待 CI 與 PR #6 待合併屬過程/歷史。最後文件/截圖提交保持驗證過的程式與測試；Safari 待真機。

- ce35e66 / Actions 43365555969 是 299/109 of 110：模板內嵌選段軸與 popup 同時存在同名「來源終點標記」，新 e2e shortFirstRange 必須限定 .sheet；這是 strict locator 問題，全部補色/來源像素斷言保留，產品不變。菱形手動往返及其餘 109 已成功。

- 多組 popup/版型內嵌 SourceRanges 共用 item.sourceRanges，sourceEnd 取最後終點；調整不改共同 duration。Timeline onScroll 的 lastSet 必須一次消耗，否則菱形程式 seek 後手動回同秒數會被舊值攔截。兩項既有 e2e 已強化，299/110 待本輪。

- c9719aa / run 43362965472 的 297/108 已全過；補兩個已發現組合問題後再驗收：模板灰區保留補色/框架，A/B 借用來源先檢查來源選段，缺單方則對透明背景淡入/出，不能洩出未選畫面。各有單元與實際像素 e2e，總 299/110。

- 多組來源和模板結合：visibleLayers 必須保留 track.template 的灰區格子，由 buildScene 畫補黑/補白並跳過媒體，避免 cell 背景/整組框架消失。聲音仍依 cellMediaTime 為 null 靜音。新增交叉回歸，總 298/109 待完整 CI。

- 第二輪 f2abcca / run 43361792188：297/107 of 108，批次操作/即時復原都過，唯硬重整未等 IDB 寫入 undo。重開驗收應先確認 savedProject 已有三層與名稱，再 reload 讀回模型及 DOM；不可用 in-memory Project 當作持久化完成。GIPHY 截圖捲到結果。產品程式不改，待第三輪。

- 九點首輪 45cba26 / run 43360577038 為 296/106 of 108（原有 98 全過），兩處新測試需等待 debug/player 重開、精確定位多則 toast。新增歸位走目前關鍵幀與依時間 coalesce，297/check 成功。下一輪 PR #7 待 CI；效果表實際 25 A/B、12 影片特效及原 4 轉場。

- 最新九點 docs/plans/2026-11-13-advanced-editing.md：main b9a5e94（PR #6 使用者已合併），main Actions 43345475628 成功。新 sourceRanges 用來源秒數保留中間空白，mediaSegments 與聲音/匯出共享；popup history 草稿局部，取消不寫專案。關鍵幀 local 秒數/完整 AnimatedValues，layout.keyframes 對整組，幾何/來源/輸出共用；修剪分割取樣邊界避免曲線跳變。A/B renderLayers 額外解碼兩方，播放器借用區間需 pause 並靜音，不能提前播放原音。特效選項共用一個 compositor 畫可見卡片，避免逐格 WebGL context 數量耗盡。batch 同類判定含貼紙 origin，分類收合不能改 z-order。296 單元已成功，108 e2e 待 CI；本次新 PR 待驗收。下列 PR #6 待合併是歷史。

- 最終修復驗收：[Actions #42](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43342981901) 成功，程式/測試 6b031d249513f765babc00b53973d58faeee2eb6：278 單元、98 Chromium e2e 全過，lint/格式/TypeScript/build/Pages/39 字體檢查成功。 PR #6 待使用者自行 Merge，119 張成功畫面（新 usability/polaroid-drift.png）；本次最後文件提交不改驗證過的測試與產品。下列待 CI 為過程紀錄。

- 2026-11-13 優先：PR #5 已使用者合併，main 8c10a55 的 Actions #41（43341355922）check 成功，四格漂移 e2e 失敗導致部署跳過。產品重新套用保持原起點是正確需求；3 秒漂移在 2.7 秒上排已離開舊取樣點。舊 e2e 未明確 seek，讀舊紅幀時可能假成功。改以 0/1.5/2.7 秒黑/紅/藍正向像素與匯出逐一驗證，重套三次保持起點/長度。僅測試修改，待新 PR 完整 CI；不能為測試改回跳時間的產品行為。下列 PR #5 待合併為歷史。

- 本次最終：程式 4d706878f81bae6e311cb866fc62c91047f02b3a / [Actions 43284472645](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43284472645)：278 單元、98 Chromium e2e 全過；lint/格式/TypeScript/build/Pages/39 字體檢查成功。 118 張成功截圖保存（artifact 13973383981 / hash db4ab8d2c6dce9f972561963f4c36d482262643224c6ea4a7e4773a7f180b7a5）。PR #5 待使用者自行 Merge，未部署；Safari 仍待真機。下列「待 CI」與 PR #4 待合併均是過程/歷史。

- 首輪 693515a / run 43282652239：277 單元、97/98 e2e；故事失敗因 ensureFont('system') 回 false，系統字體必須跳過載入，載入的是實際字體。新增 carryTemplateEdits：重新套用匹配的格子保留原來源/色塊等設定與 group transform，不把已套用組移到播放頭；群組長度變更同步草稿 seconds。278/98 待下輪 CI，PR #5 仍 draft。

- 最新子任務 docs/plans/2026-11-13-template-story-workspace.md，PR #4 已使用者合併（main d12b39c）；本次新 PR 待 check/CI。下列 PR #4 待合併與 267/91 是上版歷史。
- Template geometry 由 templateContexts/cellViewport/groupFrame 統一；itemBox 在模板內用 canonical 格位，Preview 手勢與 setTransform 轉到 layout.transform，來源 item.transform 不再被單格手勢改歪。文字/光效及整組暫時置頂也跟群組。每格選取仍以 Item ID 供剪輯使用。
- 新 cell.sourceEnd 是來源秒數、offset/blanks 是群組內秒數；空白暫停來源消耗。mediaSegments、cellMediaTime、sourceTimeAt 與 audibleClips/AudioRenderer 共用。AudioRenderer 每段用自己的 sourceStart 對應時間，不可回到整個 item 的線性公式；來源選段不能重排整組。群組左裁/分割用 sliceCell 重設 offset/blank 對齊。
- Project.effects 獨立於各 Item 型別；buildScene 統一預覽/匯出。故事字體必須在套用/重開/輸出前 ensureFont，不能只靠 CSS 系統替代。時間軸預設折疊，e2e helper 顯式展開；session 依專案保存，隱藏→展開時 viewportWidth 要觸發 syncScroll。
- 取消 has-return 高度縮短，接近頁尾隱藏回頂，不留頁外白帶。點查看圖層先展開時間軸再捲入。

- 本次最終：程式 3b9de60dc2cb325652b075313e1636d47e00f092 / [Actions 43262467680](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43262467680)：267 單元、91 Chromium e2e 全過；lint/格式/TypeScript/build/Pages/39 字體檢查成功。 107 張截圖（artifact 13965235972，ZIP hash abc5fc912058d59aaea8cca8c47ad191fc30a4c37f8b6402933387ba4ff3a07c），PR #4 待使用者自行合併；Safari 待真機。下列「第三輪待 CI」「#3 待合併」均為過程/歷史。最新仕様見 refinement-markers-and-readability 計畫。

- 第二輪 48128ac / run 43260960541：267/91 全過。但 fancy-free 的 preview.png 原圖為白字透明，非選取時四種淺主題仍需 CSS brightness(0)，不能只改 font-row 的 color（PNG 不繼承字色）。dark/mono 與選取深底保留白色。六主題新增 PNG 經 filter 的像素對比回歸，第三輪待 CI。

- 首輪本次 run 43258871988：267 單元、86/91 e2e。Crop keep updater 不可延後讀 SyntheticEvent.currentTarget，要先 point(e) 再 setStrokes；浮動回頂需要獨立底部觸控帶（has-return 高度），不能蓋到工具。來源標記一般同列、密集才 end 上錯位；音訊可細至 0.01 秒，影片最低值 MIN_CLIP_DURATION*speed。PR #4 待下一輪 CI。

- 最新子任務 docs/plans/2026-11-12-refinement-markers-and-readability.md。PR #3 使用者已自行合併，main 5ebd1a1；本次新 PR 待 CI。舊「#3 待合併」為歷史。
- 遮罩 mask.strokes 是來源 UV＋直徑佔來源寬（y 距離須除來源 aspect）；依序 keep/erase、後筆覆蓋前筆。paintMask 用同源像素繪製，Compositor 依 mask/crop/解析度快取 alpha canvas，幀只 destination-in；hit testing 使用 maskContains 同序判斷。不要把筆畫直接畫進原影片，或用 crop 後 UV 保存。
- audioRanges 選填來源秒數保留區間（undefined 全聲，[] 靜音）。Player.syncVideo 原音與 audibleClips 獨立音軌都要套用；AudioRenderer 加入換算後區間邊界再切 chunk，不能僅 chunk 中點取音量。影片時序不改。SourceRanges 上方小倒三角、44px 觸控；純配樂選段預覽暫時 seek 主 Player，關閉還原時間。
- Timeline 原點與 playhead 都在 56px，content width=viewport+total*pps，scrollLeft/pps 仍代表時間；不能只移縮圖或刻度，否則播放頭時間錯位。

- **最新任務**：docs/plans/2026-11-12-flexible-layers-and-contrast.md。PR #3 本次擴充已完成驗收，待使用者自行合併：米色/深底淺前景、原影片預覽點選、550ms 長按遮擋選單、暫時置頂編輯、單片段跨分型軌與時間移動。最新 3aadf4b / run 43228902863 的 262 單元、79 e2e 全過；80 張截圖保存（layer-editing/ 十二張），PR #3 待使用者自行合併，未發布。
- editableProject 只在 Editor 載入啟用 flexibleLayers/freeMain，保留舊 IDs/時間/層次；main kind 只是相容匯入錨點，可位於任意層，UI 與 overlay 一律「影像」。moveLayerItem 先驗證後修改，跨層不移同軌其他物件；模板群組保持同步與框架。
- useUI.liftedId 是短暫狀態，僅 Player 的 buildScene 最後參數使用，匯出不傳；禁止把它存進 Project 或實際 reorder tracks。選另一素材、播放/超出區間、完成/卸載均恢復。左側點選設定，單片段用 Timeline 長按拖曳，灰/紅提示不可混放/碰撞。
- **前次參考圖基線**：docs/plans/2026-11-12-reference-page-flow.md。使用者要正常大預覽、細圖層，再一路往下到功能與選項。預覽改 60dvh/280–600px，播放列取消 sticky，只頁首 sticky；片段可見 32/36px，44/48px 觸控列、2px 間距、8px 可見把手。
- PR #2 已由使用者合併（main daef8ca）；本次另建 PR。既有 246/73 是基線，程式 1c00aeb / run 43214593485 的 246 單元與 74 e2e 全過；68 張截圖（四張 reference-* 連續畫面）已更新，PR #3 待使用者自行合併。下方「精簡預覽」「PR #2 待合併」屬歷史，不能當成最新要求。
- **目前任務**：docs/plans/2026-11-12-single-page-settings.md。PR #1 已由使用者合併且部署成功（main a1b455b / run 43201177854，公開 JS hash 相符）；下方「PR #1 未合併」是歷史。最新截圖未見導航，可能開舊頁籤。
- 新補充：.editor .panel/.panel.tall max-height:none / overflow:visible，設定也隨整頁展開；取消內部 sticky-tabs。保留對話框、字體 picker 等真正彈出框捲動，時間軸仍按層展開。8194f79 / run 43206542321：246 單元與 73 e2e 全過；64 張截圖已更新（workspace/single-page-controls 新增）。PR #2 https://github.com/peiyulin0520/VideoClip_2/pull/2 待使用者自行合併，未開 auto-merge，Safari 真機仍待確認。
- **工作區最新驗收**：c6f196c / run 43186969560 的 246 單元、72 e2e 全過，63 張截圖（workspace/ 4 張）。PR #1 https://github.com/peiyulin0520/VideoClip_2/pull/1 已涵蓋精簡預覽、完整圖層列表、整頁捲動及續用儲存競態修正；已由使用者自行合併並部署；PR #2 為本次待合併補充。以下「待 CI」是過程紀錄，最新快照見 PROGRESS。
- 工作區第二輪 run 43186048643 的三項新驗收全過，僅舊續用重開測試抓到競態。appStore.init 現共用 initializing Promise；update 序列化、等 saveAppState 完成才 set，避免畫面已完成但 IDB 尚未持久化與重複初始化蓋狀態。新增 2 單元，總 246；歡迎頁 e2e 等完成畫面再做後續操作，不用 sleep。
- 工作區首輪 run 43185102894 為 244/71 of 72，原有 69 全過。最後工具輸入框 bottom 比 viewport 多 1.36px，已補 editor 底部 16px/safe area 與 scroll padding；測試仍要求輸入框完全可視，不放寬像素斷言。下一個成功 run 及 PR 狀態見 PROGRESS。
- 最新工作區回饋：docs/plans/2026-11-12-scrollable-editor-workspace.md。Editor 垂直整頁捲動，Preview 預設 24dvh/140–240px，Timeline height 隨 contentH 展開全部層、tl-scroll 僅橫向。工具欄正常文流，頁首和播放條 sticky；預覽/圖層/工具捷徑以 scrollIntoView/scrollTo 操作。
- Touch 未選取舞台可 pan-y，selbox touch-action:none 保留編輯；先點選後移動，避免滑頁誤動物件。Timeline 取消每次內容更新自動拉回選取列，圖層拖曳的邊緣捲動改用 .editor。
- 本機 244/check 成功，72 e2e 待 CI；目前更新既有尚未合併的 PR #1（draft），不能直接發布或代使用者合併。
- **最新發布規則（2026-11-12）**：使用者明確要求「之後要建立 PR，給我連結，讓我自己點入去按 Merge pull request」。助手完成修改、適當測試、推送功能分支與建立 PR，回覆必附 PR 網址；由使用者合併，助手不得代合併、開 auto-merge 或直接推 main，包含文件更新。舊 fast-forward 直接發布紀錄只是歷史，不能沿用。
- 首輪本輪 run 43165347867 為 244/66 of 69，已修正真實 touch 拖圖層的過早自動捲動、框線新建預設值和舊測試標籤。compositor continuity 僅保留相同軌道換片的舊畫面；不能因另一軌解碼未完成，就留下已刪版型/貼圖（有慢解碼回歸）。後續成功 run 以 PROGRESS 為準。
- 本輪優先：docs/plans/2026-11-12-timeline-and-template-feedback.md，第二輪七點正在驗收；工作分支 4a004e8 / run 43166533551 已 244 單元/69 e2e 全過，59 張截圖，main run 43167202348 的 244/69 與 Pages 發布成功，公開主程式 hash 與本機已驗證建置相符；下方 237/60 是前一正式版。
- 版型現在是一個 Track.template 含多個同時 Item；visibleLayers 對 template 回傳全部 active items。Track.layout 帶獨立框架/動態/時間，Project.layout 保留舊版及目前選擇相容；複製/分割整組，不能只複製一格。舊每格一軌且無 Track.layout 的版型 load 時 mergeLegacyTemplate，不變更 media IDs/原檔。時間軸只畫群組首個片段，畫面仍可選格子調位置。
- 手勢修剪統一 trimStartFree/trimEndFree + setTimelineItems；主軌只在使用修剪後轉 freeMain，保持既有位置/前方空隙。完整來源選區 TrimEditor 可還原。groupTiming 統一同步群組時間與限制來源範圍；框架跟著整組滑入滑出、隱藏/刪除。
- 小 GIF 暫存貼圖上限為來源尺寸，避免 120px 被擴成 1080px 每幀上傳；最多 4M 總像素的 GIF 重用合成影格，解碼狀態以 Item ID 分開，預覽量化時間以 floor(t*fps) 而非 t > last + step，避免 RAF phase 造成不均勻節奏。Safari pool opacity 0.01 與 1px video 避免完全不可見節流；真機效果仍待確認。
- 字塊 box.opacity 現可為 0；stroke.opacity 選填預設 1，填色透明不再連帶使框線消失。裁切增加結果預覽與上一筆輪廓復原。
- 最新子任務：docs/plans/2026-11-12-editor-completion.md，程式 8489d1c，工作分支 run 43148943226 與 main run 43149637879 已 237 單元/60 e2e 全過，53 張截圖；Pages 已發布且公開 JS hash 與驗證建置一致，詳見 PROGRESS。以下 227/50 是先前正式版。使用步驟見 docs/USAGE.md。
- 新資料：DB v3 library（獨立 Blob/裁切設定）；GIPHY Key 僅 meta:giphyKey，絕不可加入 Project/原始碼/日誌/分享檔。Asset.kind 加 audio，VideoItem.type 加 audio，音軌共用 Item 時間/修剪但 buildScene 跳過；Project.freeMain 選填，main 操作須改用 free 函式以保留空隙。
- 新檔案：engine/materials（色塊/匯入/音訊分離）、audio（預覽音量規則/AudioBus）、gif（時間驅動 GIF）、exportVideo/exportAudio/exportRealtime（完整輸出）、storage/library、store/preferences；UI Assets/Audio/Blank/Crop/Drawing/Export 各有 editor 元件。
- 遮罩 points 是未裁切來源的 0–1 座標，在 Compositor 裁切後的固定媒體暫存 canvas 以 destination-in 套用，與素材一起旋轉；mask/GIF stamp 要算入貼圖快取鍵。逐格輸出使用 CanvasSink 的 Canvas/OffscreenCanvas，不能誤當成 HTMLVideoElement 讀 dataset。
- 預覽品質預設 1080，720/1920 可選；文字獨立高密度。AudioBus 的 AudioContext 必須由播放手勢 resume；音訊-only 素材的 priming 不能等永遠不會來的 video frame callback。
- 逐格音訊用每 10 秒 chunk 混音避免整支音訊留在記憶體；相容匯出則先在按鈕手勢建立/解鎖 AudioContext，傳進獨立 Player。暫不把 MP4 視為所有瀏覽器都能輸出，格式在完成後明示。

- 前次驗收：程式 c9709ed，工作分支 run 43130792200 與 main run 43131468570 均 227 單元/50 e2e 全過；Pages 已發布並核對公開主程式 SHA-256。45 張新截圖。Safari 真機限制見 PROGRESS 交接快照。
- 最新工作：iPhone 實測 8 項修正，規劃/驗收見 docs/plans/2026-11-11-mobile-editor-feedback.md。最新偏好取消浮動圓鈕，用框上兩指手勢，與來源的右上角按鈕規格不同。
- 新資料欄位皆選填：Project.mainOffset/background/layout、Track.template、VideoItem.slot、Decoration.offset、CardBox.softness/depth。主軌 store 寫回時必須重新套用 offset；itemAt 在第一個 start 之前回 null，不能提前畫原片。
- 多格共用 buildScene/Compositor：固定視窗遮罩獨立於素材旋轉，素材可在格內拖移縮放；第一格音軌、其他格靜音，文字保留在版型上層。預覽提高至 1920；文字的物理 canvas 尺寸與邏輯 w/h 分離，不能拿 canvas.width 當選取框尺寸。

- 來源 main `78b178343409c46c7ba353ef3a6db6f279a7bde6`，PR #3 在來源庫已合併；來源快照「等合併」已過時。
- 目標 `peiyulin0520/VideoClip_2`、工作分支 `codex/establish-little-moments`、名稱 Little Moments、Pages base `/VideoClip_2/`。此明確子任務只建立已完成版本；不把尚未做的功能標為完成。
- 新舊路徑在同一個 origin，所以另命名 IndexedDB、OPFS、字體快取與 localStorage；不改動原 VideoClip 資料。新增隔離測試覆蓋相同專案/素材 ID 的讀寫刪除。
- 本機實際通過的項目看 PROGRESS.md。來源的 42 e2e 和 screenshot 是來源紀錄，不是本次跑過；GitHub CI 已安排 e2e，成功前不要聲稱已驗證瀏覽器。
- GitHub 授權、推送和 Pages 發布已完成。正式 URL https://peiyulin0520.github.io/VideoClip_2/；已部署程式 af14c795cbecb09c1d286ab1fcd6e9168b24cae5，main CI 43061662930 的 220 單元/42 e2e/部署全過，38 張可讀繁中驗收圖在 docs/screenshots。文件/驗收圖的後續 [skip ci] 提交不改已部署程式。
- 下一個功能子任務仍是 Phase 3A-4 後半貼圖 icon；素材庫需求另記為 PLAN R22。


給接手的 AI／工程師。先讀 `AGENTS.md`（規則）和 `docs/PROGRESS.md`（目前狀態），這份補上「為什麼這樣做」和「程式在哪裡」。
**接手時可以直接對 ChatGPT 等說：**
> 請先讀 repo 根目錄的 AGENTS.md，再讀 docs/PROGRESS.md 最上面的「交接快照」和 docs/HANDOFF.md，然後從「下一步」繼續。每做完一步都要照 AGENTS.md 的「紀錄規則」更新紀錄、commit 並 push。

## 1. 使用者與合作方式
- 繁體中文（台灣）使用者，用 iPhone Safari／加入主畫面。**不寫程式，只審核**：看截圖、在手機上實測後回報。
- 偏好：回覆短、白話、一次一件事；結尾給 A/B/C 選項讓他一個字決定；要看得到的東西（截圖、對照圖）。
- 非商業使用、不改版字體；資源盡量用免費開源。
- 他要的是「像剪映／CapCut 那種手機剪輯」＋可愛多樣的字卡。參考素材（別人的作品，只參考效果、不放進 repo）在原始對話裡：字卡模板截圖、雲朵字、Vlog 標題、書法電影感標題、4 段示範錄影（轉場、手繪塗鴉、摳像貼紙、逐筆寫字）。拆解結果在 `docs/EFFECTS.md §8`、模板整理在 `docs/TEXT_CARDS.md §6`。
- 他曾回報過「icon 沒有反應」→ 所有按鈕都要有 e2e 點擊測試。

## 2. 使用者原始需求（完整清單在 `docs/PLAN.md §1`，R1–R21）與後續決定（時間順序）
1. 公開網址、免登入、**每台裝置的專案互相看不到**（做法：沒有後端，資料全在裝置）。→ GitHub Pages，repo 已公開（使用者自己改的）。
2. 多專案、多影片拼接、**多圖層（同一秒可疊多支影片）**、字卡/icon 右上角縮放鈕、字體下拉選單放字卡分頁、字塊內距可調、尾端圈圈（照參考圖）、雲朵字（不必蓬鬆）、Office 圖形當字塊、繪畫＋筆刷＋橡皮擦、字卡出現方式（逐字等）、轉場特效、調色（做在 App 裡）、IG 音源推薦。
3. **VLOG 人頭 O 效果**：底層完整影片 → 中層文字 V L G → 上層同一支影片只留人頭（使用者**自己用套索描邊/橡皮擦剪**，不是自動去背）。
4. 字體：下載好看且支援繁體的免費字體；Zizi app 的（饅頭黑體、中規中矩體、星光手體、一致宋體）；佮逸體；日文字體也行。**首次使用自動下載清單，之後從快取讀**。
5. 雲端：使用者給了 Drive 資料夾 `1fLGtxMS4oRFIOqpyn-jnBtifCRCclF2l`。我們說明：公開連結可讀字體（要 API key）、不登入無法寫入、專案備份資料夾要保持私人。→ **決定**：首次使用就讓每個人選備份位置（手機檔案／Google 雲端〔可貼資料夾網址或登入後選〕／先不要）。備份功能本身排在 Phase 6。
6. 使用者上傳字體清單 JSON 與字體檔，並說明它們都是開源、非商業。→ 我們仍讀字型檔授權：3 款不放進網站（見 FONTS.md）。
7. 使用者找到 max32002/pop-gothic（含注音）→ 已加入。問能否下載到手機「檔案」App → 網頁做不到，改用「匯入字體檔」。
8. **使用者要求每次進度都記錄成檔案，方便換 ChatGPT 等接手** → 本文件與 AGENTS.md 的「紀錄規則」。

## 3. 架構地圖

```
src/
  model/types.ts, defaults.ts     資料模型（Project / Track / Item …）與建立函式
  engine/
    timeline.ts                   純函式：主軌 relayout/split/trim/speed、疊加軌自由放置（不重疊）、visibleLayers/layersAt
    geometry.ts                   itemBox（物件在畫面的方框）、hit-test、吸附（中心線/邊緣/平台安全區）
    scene.ts                      buildScene：專案＋時間 t → 要畫的圖層清單（預覽與匯出共用）
    compositor.ts                 PixiJS 合成器（每個影片/照片圖層用 canvas 暫存畫面 → CanvasSource；遮罩圓角、外框、混合模式）
    player.ts / mediaPool.ts      預覽播放：時鐘驅動、<video> 池（6 個）、下一個/1 秒內的素材預載
    exportFrame.ts                單格輸出（輸出解析度 PNG）；之後整支匯出沿用 buildScene+Compositor
    textRender.ts                 字卡畫成 canvas（目前是最小版，Phase 3A 要換成完整排版）
    probe.ts / importMedia.ts / assetUrls.ts   匯入、讀影片資訊（Mediabunny）、縮圖、object URL
    debug.ts                      window.__videoclip（vc-debug=1 才有）
  store/
    projectStore.ts               目前專案＋復原/重做（immer，上限 100，coalesce 合併拖曳）＋ setMainItems/setTrackItems
    actions.ts                    編輯動作（任何軌道的物件：改、刪、分割、複製、加疊加/文字、軌道操作…）
    autosave.ts                   變更後 立即寫入並合併進行中修改；flush 等最新版本完成
    appStore.ts / uiStore.ts      精靈與備份設定／toast、busy、目前 player
  storage/
    db.ts                         IndexedDB 'little-moments-videoclip-2' v3：projects, blobs, meta, userFonts, library
    media.ts                      素材檔：OPFS（projects/<id>/media/<assetId>），不支援就退回 IndexedDB blobs
    projects.ts                   專案 CRUD；**寫入排隊、讀取等寫入完成**（修過首頁讀到舊資料的 bug）
    appState.ts                   appState（onboarded、備份模式、Drive 網址解析）
  fonts/                          catalog（讀 catalog.generated.json）、fontStore（下載/快取/載入/匯入）、sfnt（讀字體名稱）
  app/
    App.tsx（HashRouter）, Welcome.tsx（首次使用精靈）, pages/{Home,Editor,Settings}.tsx
    editor/{Preview,Timeline,Toolbar}.tsx   預覽（canvas＋選取框＋手勢）、多軌時間軸、底部分頁（剪輯/疊加/文字/圖層）
    fonts/{FontSelect,usePackInstall}
scripts/   fetch-fonts.mjs, build-fonts.py, make-icons.py
fonts/     manifest.json（字體主清單）, OFL-1.1.txt
public/fonts/<key>/   成品（woff2、授權檔、preview）— 已 commit
e2e/       helpers.ts（含 debug hook 的包裝）、phase1/phase2/phase3b 規格
tests/fixtures/   ffmpeg 產生的測試素材（WebM；純色影片用來取樣驗證圖層順序）、mini-font.ttf
docs/      PLAN / TEXT_CARDS / EFFECTS / FONTS / PROGRESS / HANDOFF / font-coverage / screenshots/phase* / reference/
```

### 資料流
`Project`（Zustand + immer，可復原）→ `visibleLayers(project, t)`（軌道順序＝圖層由下到上；主軌用 `itemAt`）→ `buildScene`（算每層的方框、透明度、混合、圓角、外框、裁切；字卡用 `renderText`）→ `Compositor.render`（Pixi）→ canvas。
`Player` 管時鐘與 `<video>`：每格 render 時替「正在顯示」的影片物件找一個 `<video>`（沿用同一個元素，不重設 src）、同步時間/速度/音量，預載即將出現的素材。
單格匯出：`exportFrame.renderFrame` 另開 Compositor（輸出解析度）、用獨立 `<video>` 精準 seek，**與預覽用同一套 buildScene**，e2e 驗證兩者在取樣點顏色一致。

### 座標與單位
- `transform.x/y`：物件中心，佔畫面寬/高的比例（0–1）；`scale`：乘上「填滿(cover)/完整(contain)」算出的基本大小；`rotation`：度，順時針。
- 專案座標＝專案解析度（9:16 為 1080×1920）；預覽 canvas 長邊預設 1080，可選 720/1920。字卡字級以 1080 寬為基準，畫的時候乘 `canvasW/1080`。
- 圖層順序＝`project.tracks` 陣列順序；舊 main 僅為相容匯入錨點、位置不固定（用 kind 尋找，不能假設 tracks[0]）；每條軌依影像/字卡/音效分型，非模板同軌不能重疊。

### 儲存位置
IndexedDB `videoclip`（專案 JSON、`meta.appState`、`meta.installedFonts`、`userFonts`）；OPFS（素材原檔）；Cache Storage `vc-fonts-v1`（官方字體）；localStorage 只放小旗標（安全區開關、iOS 提示已關閉、測試旗標）。

## 4. 決策與原因
| 決策 | 原因 |
| 影像取消固定主軌，單片段分型跨軌，暫時置頂僅改預覽 | 使用者要求每一層影像一樣可編輯，移動單片而非整層；完成編輯後須回到原堆疊，不能影響匯出與儲存 |
| 正常大預覽＋播放列正常文流，圖層可見較細但觸控維持 44px | 使用者連續參考圖要求預覽→全部圖層→功能→選項，上一版預覽太小且播放列仍卡住 |
|---|---|
| 純前端、無後端，資料在裝置 | 使用者要求「不同裝置互相看不到專案」「免登入」；也避免上傳影片的隱私問題 |
| GitHub Pages ＋ HashRouter | 免費、使用者已公開 repo；子路徑 `/VideoClip/` 用 `#/` 路由才不會 404 |
| PixiJS 合成（不是 Canvas2D filter 或 DOM 疊 video） | 預覽與匯出要同一套；Safari 的 Canvas2D `ctx.filter` 不可靠；之後調色/轉場/遮罩都要 shader |
| 影片/照片圖層先畫進固定大小的暫存 canvas 再當貼圖 | 避開 Pixi VideoSource 會自己 play/load 的副作用；裁切、圓角用同一條路；縮放手勢不會一直重建貼圖 |
| 字體裁切成繁體常用字集 woff2 | 單檔 10–30 MB 太大；Big5 5401＋7652 字夠用；之後可補 `unicode-range` 第二檔放罕用字 |
| 官方字體存 Cache Storage、使用者字體存 IndexedDB | iPhone 網頁不能自動寫「檔案」App；瀏覽器儲存較可靠 |
| 儲存層「寫入排隊、讀取等寫入」 | 離開編輯器的存檔可能比首頁讀取晚，會顯示舊資料 |
| 最小版文字（Phase 2）先做 | 只為了驗收「3 影片＋1 字卡」；完整字卡引擎是 Phase 3A |
| 不放進網站的 3 款字體 | 授權：All rights reserved／禁止散布／無授權說明（見 FONTS.md） |
| TypeScript 5.9 | typescript-eslint 不支援 ≥ 6.1 |
| 新專案比例預設「自動：跟主軌第一個素材」，編輯器頂列可隨時改（可復原）；比例多加 3:4、4:3 | 使用者 2026-11-11 選 A；位置/大小本來就是「佔畫面比例」，改比例不用搬資料 |
| 字卡大小/外框粗細跟畫面短邊走（`uiScale = min(w,h)/1080`） | 改成橫式時字不會被放大 1.78 倍；9:16、3:4、1:1 不受影響 |
| 安全區參考線預設關（localStorage `vc-safe-zone-v2`），只在拖移時自動出現；拖移一律吸附安全區邊界 | 使用者誤以為粉紅斜線是背景 |
| 影像：匯入不自動選，預覽可直接點選/拖移/雙指；長按選遮擋物件暫時置頂 | 使用者最新要求取代舊主軌不可直接選取規則，無固定底層 |
| 縮圖：Mediabunny `CanvasSink` 優先 → `<video>` → 預覽播放器拿到畫面後 `setAssetThumbs`（不進復原歷史，歷史快照一併更新） | iPhone 隱藏 `<video>` 常不觸發 `loadeddata` |

## 5. 踩過的坑（避免再踩）
- 分型自由時間軸的「插入留白」須在游標切開並推後同軌，而非 findFreeStart；insertVisualClip 保留既有空隙/來源 trim/speed。整片拖曳則不推其他片段，兩種語意分開。
- data-item-id 同時用於 pool video 和時間軸；原生拖曳測試必須限制 .clip。radio 選取會卸載 popover，改真實 tap 並斷言新的編輯模式與畫面，不對已卸載元素等 checked。
- main/overlay 統一後模板不自動隱藏底層，動畫隔離測試須用 UI 主動隱藏；刪模板的慢解碼回歸看既有底層藍畫面，不期待黑底；仍不能保留刪掉的模板框架。
- 細把手從 16px 改 8px 後，right:-4 的中心恰在相鄰片段邊界，下一片段會蓋住；選取片段需 z-index 4，且左右把手放回片段內側（0）。觸控延伸區仍保留。
- 真實 touch swipe 有慣性；測 scrollTop 與元素位移應同一 evaluate/frame 取樣，不能分次 await 後將移動中的值相減。仍保留精確位移斷言。
- Autosave 現改為立即寫入、寫入期間合併最後狀態，不能恢復 800ms debounce：收藏素材重用後立即重整會丟最後一筆。每個儲存迴圈要綁 projectId，避免舊頁 cleanup 時讀到新專案。
- Sheet 必須 portal 到 body，並設 max-height/overflow:auto；Crop 包含畫布與四個 slider 時超出可視高度，原本底對齊會把頂端按鈕推出 viewport。
- MediaRecorder.isTypeSupported('video/mp4') 不保證產物可被當前 VideoDecoder 解碼；相容匯出指定 codec、檢查解碼/原生播放能力、偶數 canvas，不能只選 generic MP4。

- GitHub runner 無硬體 GPU；多個高解析度 WebGL 瀏覽器會爭用 CPU。CI 以 workers=1 執行；原五手勢修剪驗收拆成片頭界限/片尾界限/單步復原三個獨立情境，保留所有斷言與 30 秒時限；多格綜合流程亦拆成拍貼/膠卷與四格動態兩項（合計 50 e2e）。

- 修剪會同時觸發 store refresh 和 peek；兩者必須合併同一 RAF，否則每次 pointermove 重畫兩個高解析度畫面。Player.previewTime 保留邊緣時間給解碼事件，refresh/seek/play 清除後回播放頭；不能用延長測試逾時掩蓋重複繪製。

- 高解析度預覽不能在每次字卡/位置變更時重繪並上傳未改變的媒體影格；Compositor 以來源、時間、解碼幀數、frameStamp、裁切快取。首格事件與 decoded callback 必須增加 frameStamp，避免同時間的未解碼畫面被快取。
- 持續觸控手勢可能因渲染/中途停頓超過 800ms；每個 `gesture:` 唯一 key 跨停頓合併為一個復原步驟，下一次手勢用新 key。一般輸入/滑桿仍套用 800ms。

- **iPhone Safari 沒辦法在沙盒測**：OPFS 寫入、Cache Storage、同時多個 `<video>` 解碼/自動播放解鎖、混合模式、手勢，全部在 `PLAN.md §7` 待真機驗證。
- 沙盒的 Playwright Chromium **沒有 H.264**：測試素材用 WebM；ffmpeg 的 `color=c=green` 是 (0,128,0)，要純綠用 `0x00ff00`。
- Pixi v8：stroke `alignment: 1` ＝**內側**（0＝外側）；`extract.canvas` 不指定 `frame` 時尺寸會差 1px、內容超出畫面還會位移 → 一律明確給 `Rectangle(0,0,w,h)`。
- 底部面板開關會改變預覽大小 → e2e 點擊預覽時要**每次重新量舞台位置**。
- 很短的片段上，修剪把手的觸控範圍會蓋住片段中間（長按拖曳按不到）→ `.clip.short` 縮小把手範圍。
- 自動儲存 800ms：編輯後 <0.8 秒就重新整理會丟最後一步（測試要等 1.2 秒）。
- React lint（react-hooks v7）禁止在 effect 裡同步 setState、在 render 中重新賦值變數；全形空白 `　` 會被 `no-irregular-whitespace` 擋 → 用一般空白。
- `noUncheckedIndexedAccess` 開著：陣列索引要 `!` 或判斷。
- Prettier 會把長行重排，用字串取代改程式碼前先看現況（用 Edit 工具或先 `prettier --write`）。
- 隱藏軌道的物件要仍能在圖層面板列出（`layersAt(…, includeHidden=true)`），不然沒辦法再打開。
- 字體：`new FontFace(…, ArrayBuffer)` 一次只該載「用到的」；預覽字樣用幾 KB 的 `preview.woff2`；OFL 裁切後內部名稱要加 `VC Subset`。
- `npm audit` 有 1 個 moderate（vite-plugin-pwa → workbox-build → deepmerge），只在建置階段，不進網站，等上游。

> 坑（2026-11-11）：Pixi `Application.destroy` 後不能在**同一個 `<canvas>`** 上重建 WebGL（頁面會卡死）。改比例要重建預覽時，`Preview.tsx` 用 `key={width x height}` 換新的 canvas。
> 坑：e2e 裡 `window.__videoclip` 要等預覽引擎建好才有，進編輯器後先等它再讀 `project()`。

## 6. 現況與下一步
**已完成**（細節與驗證看 PROGRESS.md 日誌）：Phase 0（骨架/PWA/部署）、Phase 1（專案管理＋多影片拼接）、Phase 2（多圖層＋選取框手勢＋圖層屬性）、Phase 3B（字體管線＋首次使用精靈＋設定頁＋字體選單＋匯入字體）。
**已合併並上線**（PR #2，2026-11-11；GitHub Actions 部署成功）。之後的工作在 `claude/zen-tesla-v3brj5`，要上線一樣：開 PR → 使用者 merge → 部署。PR 合併後分支對齊 main 用 `git merge --ff-only origin/main`（不要 force push）。

### 先做：使用者實測回報的修正
照 `docs/plans/2026-11-11-safe-zone-and-selection.md`（安全區參考線、主軌選取框、iPhone 縮圖）。之後的修改規劃也放在 `docs/plans/`，檔名用日期開頭。

### 再做：Phase 3A 字卡引擎（規格 `docs/TEXT_CARDS.md`，驗收見 `docs/PLAN.md` Phase 3）
建議拆成可各自驗證的小步（每步都更新 PROGRESS.md、commit）：
1. **型別與排版引擎**：把 `TextCard/TextRun/CardBox/Decoration` 擴充到 TEXT_CARDS.md §1 的完整版（`src/model/types.ts`），`engine/textRender.ts` 改成「逐字排版 → 墨跡邊界（`measureText().actualBoundingBox*`）→ 字塊尺寸＝墨跡＋四邊內距」（修正「字上方色塊多、下方貼底」）。單元測試：3 款字體的上下內距對稱。
2. **字塊與內距 UI**：字卡分頁加字塊（形狀、顏色、透明度、四邊內距＋連動鎖、垂直微調）、字距、行距、寬度、對齊、粗體（描邊模擬）、斜體、描邊、陰影。
3. **尾端圈圈與裝飾**：`tail-loop` 照 §3.1 路徑；其他裝飾（波浪、虛線、螢光筆、手繪圈住、箭頭、星星、愛心…）。風格選單用「即時渲染縮圖」。**驗收：與 `docs/reference/tail-loop-underline.jpg` 疊圖對照截圖**。
4. **圖形庫**（Office 風格：方塊、雲朵、對話框、星形、緞帶、箭頭…）當字塊/貼圖；貼圖 icon（Fluent Emoji 子集，MIT）。
5. **雲朵字**（TEXT_CARDS.md §5）。
6. **模板**（約 50 個，TEXT_CARDS.md §6）＋模板縮圖總覽頁 `docs/screenshots/templates/index.html`。
7. 動畫（逐字出現等）屬 Phase 4。

### 待使用者提供/決定
見 `docs/PROGRESS.md`「等使用者的事」（缺檔字體：LINE Seed 繁中、致一宋體、佮逸體；iPhone 實測回報；是否把 Phase 1–3B 合併上線）。

## 7. 怎麼驗證現在是好的
```
npm ci
npm run check                      # lint + 227 個單元測試 + build + Pages 路徑檢查
npm run e2e -- --trace off         # 50 個 e2e（iPhone 13 尺寸、Chromium）
```
e2e 會產生 `docs/screenshots/phase*/` 截圖（給使用者審核用，也會被 commit）。

> VideoClip_2 CI（2026-11-11）：Ubuntu apt mirrors 曾 DNS 解析失敗，`playwright install --with-deps` 因補裝額外字型卡住。runner 既有圖形函式庫已在日誌確認；CI 僅下載 pinned Chromium headless shell，設置 timeout，不能用反覆等待解決 apt DNS。上傳 screenshots 前必須清空舊生成圖；測試未執行就不產 artifact，避免誤用來源庫畫面。

> VideoClip_2 截圖（2026-11-11）：CI 43059345131 的 42 e2e 成功，但人工檢視截圖時看到 UI 中文 tofu。去掉 apt 依賴安裝後，runner 沒有 CJK 系統字型；改從 repo 現有 Noto Sans TC WOFF2 註冊至 fontconfig。iPhone 本身有 PingFang TC；此修正只為 CI 可讀截圖，不把有方框的 artifact 當成最終視覺驗收。

> CI fontconfig 的預設設定未採用放入 user fonts 目錄的 WOFF2（43060505717 的 fc-match 仍是 DejaVu Sans）；隔離 FONTCONFIG_FILE 下的 fc-scan 成功不能代表預設設定可用。已用同源 OFL Noto Sans TC 轉成 tests/fixtures/ui-noto-sans-tc.ttf，測試預設 fontconfig + XDG 目錄並加 CI fc-match 斷言，不能只看測試成功就聲稱截圖可讀。
