# 定格、裁切與版型驗收（2026-11-14）

本輪 PR：[#12](https://github.com/peiyulin0520/VideoClip_2/pull/12)。原始使用者錄影只在工作環境暫存，所有公開截圖與測試影片均為合成素材。

## 驗收來源

產品程式：`b5f83655a567a0a713fb9f56d104085a55a0b01e`。本機 `npm run check` 成功：387 單元、38 測試檔、lint/格式/TypeScript/build/Pages/PWA、39 字體與授權檢查。

[Actions 43662869767](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43662869767)：快速29編輯／5色調動作／9音訊（連跑三輪）／30生命週期全過。完整167項全部成功（8.0分鐘）。最後提交只含文件、量測與成功截圖；產品、測試與workflow與上述驗收source一致。

## 需求對照

| 使用者要求 | 實作及驗收依據 |
| --- | --- |
| 定位改定格、暫停菱形白底橘框、編輯所選不新增、明確近鄰新增/刪除 | keyframes、Timeline、KeyframeControl；editing-refinements 定格 case、editingRefinements 單元 |
| 震/彈/晃/跳、時間與力道、所有視覺素材 | keyframeMotion 解析 transform，scene 預覽/匯出共用；tone-grading 播放及 template-editing Pop 資源測試 |
| 全頁用自訂素材名、原音繼承/分離另命名 | itemName、Timeline/Toolbar/AudioPanel/來源popup；refinement 與 template-editing、單元 |
| 固定預覽基地、框內比例、自訂四邊/角 | Preview、ProjectPreview；editing-refinements 自訂比例與 X 草稿 |
| 四個獨立裁切工具同列、不閃爍、縮放仍保留來源位置 | CropEditor stable canvas、MediaMask.base；裁切舊回歸及 CDP 雙指/匯出像素 |
| undo/redo、播放右側操作、X 不保存、無多餘取消/reset | useDraftHistory、Sheet、Crop/Trim/AudioRange/TemplateCellEditor；各來源popup草稿測試 |
| 真正灰色文字placeholder、上下居中/左右留白 | TextPanel、createTextItem、scene；refinement、uniform-type |
| 圓角統一、表單無黑框棕箭頭、標籤間隔與左對齊 | canonical表單12px、colour-field/effect-name；anchored-playback 六主題、contrast 測試 |
| 小示意同步調色與透明 | 靜態96px ToneThumbnail及RGBA框架；template-editing 黑白/透明像素驗收 |
| 點格子開有聲選段、起點依長度連終點、局部名稱/速度/補色與文字 | TemplateCellEditor、SourceRanges.linkedDuration、templateTiming；template-editing source popup |
| 移除重複整組預覽與inline進階區 | TemplatePanel/TemplateCells只留compact來源入口，進階放局部popup；refinement回歸 |
| 輪序播完停最後幀、群組預設收合/展開、同時分列/輪序同列、順序/長度/色塊 | templatePlayback、visibleLayers、scene、mediaSegments、Timeline；template-editing native frame/像素/匯出 |
| 音訊片段範圍、有聲找素材、未選秒數也能聽 | AudioRangeEditor 原音預設、selectionOnly選項、同列秒數；editing-refinements audition test |
| 多版型互不覆寫、選既有編輯或另新增 | TemplatePanel不fallback第一組、carryTemplateEdits保留ID；template-editing 多組及重新開啟回歸 |
| 下方頁籤再次點擊不關閉 | Toolbar switchTab；compact/tone/refinement |
| A/B/C刪B接A/C後調轉場不回復B | stable item/source binding、seek mapping防舊回呼；editing-refinements 資料與native C來源秒數 |
| 特效流暢度及原音爆音回歸 | 既有audio-continuity波形門檻維持；tone+shake零貼圖/濾鏡配置，模板Pop固定取樣尺寸 |

## 裁切圖示與導航追加

四種單色SVG位於文字左側：空心四邊/四角圓點、不規則形、尖頭毛筆、橡皮擦。工具模式有獨立框區與標題，播放/undo/redo/檢查/套用另分區。320、390、430px驗同列不溢出、無填色SVG與44px觸控；功能頁籤computed radius為0、底線2px，再次點選不收合。圓角12px仍用於操作與表單，不套在底部導航。

## 片尾聲音排程

原生聲音的結束時間可能比媒體/AudioContext推算提早一小段。已排好的淡出不可被late pause/seek延長；只在真正原檔EOF前提早12ms完成淡出，內部選段截止與離線匯出的既有包絡不變。新增6單元驗視窗關閉/暫停/seek不延長deadline，以及正常/變速EOF與內部選段的差異。

|階段／來源|最大相鄰PCM跳變|
|---|---:|
|修正前，43661477158|0.092916（原門檻0.08失敗）|
|只保留截止，43662176453三輪|0.003908、0.061215、0.004082|
|加原檔EOF緩衝，43662869767三輪|0.004184、0.004109、0.003958|

三輪各168960取樣，峰值約0.7715；原live<0.08門檻維持。保留所有輪次，包含中間尚有較小突波的一輪。這是同組合成PCM測試的修整紀錄，不能推算所有素材或手機的改善幅度。

[修正前](editing-audio-fade-before.json) · [截止修正中間三輪](editing-audio-deadline-only-probes.json) · [最新三輪原始量測](editing-audio-repeated-probes.json)

## 動作資源

|相同source實際播放|色調＋柔焦＋顆粒＋震動|版型彈一下|
|---|---:|---:|
|取樣間隔|865.1ms|927.2ms|
|新增媒體貼圖配置|0|0|
|保留buffer|2|3|
|新增色調濾鏡|0|0|
|畫面持續更新|影片呈現回呼+26、uniform+24、上傳+36|畫面hash 1156392831→2411762418|
|額外seek|0|—（靜態影像）|
|原音energy|0.112007|—（靜態影像）|

色調使用單pass並重用uniform；Pop只改transform，不因模板放大縮小而重建來源貼圖。這是Chromium軟體renderer資源證據，不能作為iPhone FPS或所有素材零掉幀保證。

[色調與震動原始量測](editing-tone-motion-metrics.json) · [版型彈動原始量測](template-pop-metrics.json) · [完整回歸聲音量測](editing-audio-wave-metrics.json)（live maxJump0.003908）

## 成功截圖與來源核對

下載兩份完整成功artifact並核SHA-256，只取PNG及量測，未複製failure context。201張成功截圖全部來自此run，editing新增10張。已人工檢視本輪裁切、直線導航、來源popup、示意黑白/透明4張；其他案例由UI/像素/native來源秒數/匯出斷言驗證。

|artifact|bytes|SHA-256|
|---|---:|---|
|14140903796 browser-checks|30193323|ff86dac1d83b15e24089cf8a18d2092d35d60fc68d0c2bc18aa8e7dd8704f735|
|14140619551 browser-refinement|4607248|faf5d5d1f67f938bde30f15567e65284da09fd4ca8e12119fc72b395bc3e6549|

- [四工具圖示、分區與縮放](../screenshots/editing/crop-tools-zoom.png)
- [直線導航](../screenshots/editing/straight-navigation-tabs.png)
- [版型有聲來源popup](../screenshots/editing/template-source-popup.png)
- [示意同步黑白/透明](../screenshots/editing/template-miniature-tone-opacity.png)
- [輪序播完停格](../screenshots/editing/template-sequential-hold.png)
- [展開群組子素材時間軸](../screenshots/editing/template-sequential-timeline.png)
- [選取的定格](../screenshots/editing/selected-keyframe.png)
- [自訂輸出框](../screenshots/editing/custom-aspect-fixed-base.png)

## 真機界線

Chromium 回歸可驗證操作、來源秒數、像素/匯出一致、音訊能量與資源配置，不代表 iPhone Safari 真實 FPS 或硬體爆音已測。Safari 原音解鎖、長片多模板、觸控縮放/筆刷、seek 後播放與背景切回仍在 PLAN §7 待真機。
