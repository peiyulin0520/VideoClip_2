# 11/16版型、文字動效與播放驗收

產品/測試來源e92d6bda0024741ebf1f5808441d39e051089edb / Actions43937100642；最後文件/截圖commit不改程式、測試、build或workflow。PR14由使用者Merge；本分支沒有發布Pages。

## 範圍

1. 空框架1:1/1:2/1:3/1:4與自訂列欄，外框/內線粗細、色彩、透明度，兩種獨立拖曳視窗、X取消。唯一cells幾何用於holes、source viewport和handles；改格/框不新增第二個frame。
2. 同步/依序、格序與靜音停留/補色/透明。影片在格內保留原始來源，局部平移/縮放，不永久crop。時間軸群組收合、內分類/格號/多列，圖層當秒收合且跨類型z序。新增文字/素材/音訊可選群組/格子目的地，主要頁籤編輯；舊v1相容工具只明確開啟時掛載。
3. 64種參考動態文字、4基本樣式、可改副標、循環/完整文字停留、整段持續動效。MIT授權保留。固定canvas/CanvasSource更新，主播放暫停選項卡動畫。
4. 自由裁切編輯完整底圖/結果分離；音訊列表緊湊，三種寬度不溢出。原始容器fps/bitrate、最高來源解析度/影格率、舊素材metadata補讀，原檔匯出。混合輸出重新編碼，低規格素材會放大/重複影格，不宣稱無損。
5. 設定showPerf、低頻合成fps/耗時/慢格/硬seek/解碼drop/轉場。轉場暖B容差防重seek；資源預留依同秒峰值與hold格計算，不按所有序列片數。原音包絡/EOF/削峰門檻保留。

## 最終驗證結果

- source `e92d6bda0024741ebf1f5808441d39e051089edb` / [Actions 43937100642](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43937100642)。519單元／47檔與eslint/Prettier/TypeScript/build/Pages/PWA/39字體授權檢查成功；194完整Chromium成功，全部快速6/6/1/1/13/14/33/2/29/5/9/23成功（含三輪音訊）。
- 固定304×540預覽、自製短片轉場：合成29.79fps；scene 0.220ms、compositor 0.502ms、最長單次繪製 3.200ms；轉場18格，慢格0、播放硬seek 0。這是此runner短片量測，不是使用者長片或Safari保證。
- 來源160×284/24fps，實際影片匯出解碼同尺寸/24fps，audio=True、RMS=0.089410。4K60混1080p30的profile純測試通過，真機實際4K/HEVC編碼仍待驗。
- 三輪原生備援每次63張來源圖全部對齊；三輪live maxJump 0.004004/0.003954/0.003954，原限制<0.08不變；offline/limiter/full資料保留在[量測JSON](nov16-measurements.json)。動態文字及特效播放期間新增貼圖/濾鏡0的斷言通過。
- fast artifact14260978659，6711676bytes，SHA-256 `e3c0eccdab2e4f17aa7225d10316eb8a910a86946dbc3fd5ed7acbcb5f34e6ca` 下載核對成功；10張新PNG均來自本source成功測試，沒有提交使用者錄影。完整artifact僅遠端紀錄，沒有另行下載核SHA。

## 驗收畫面

[格子分界popup](../screenshots/nov16/framework-boundary-editor.png) · [自訂框架](../screenshots/nov16/framework-custom.png) · [群組分類與圖層](../screenshots/nov16/framework-layers.png) · [播放順序](../screenshots/nov16/framework-playback-order.png) · [依序與空檔](../screenshots/nov16/framework-sequential.png)

[自由裁切完整底圖](../screenshots/nov16/crop-source-visible.png) · [緊湊音訊](../screenshots/nov16/compact-audio.png) · [文字完整停留](../screenshots/nov16/text-hold-controls.png) · [原始規格匯出](../screenshots/nov16/native-export-options.png) · [播放效能](../screenshots/nov16/playback-performance.png)

## 失敗記錄與修正

- A421/check過，完整183/184：音訊測試使用無音軌solid-red，改有音軌timing-video；原181無退步。
- B503/check過，完整187/188：新增native測試錯用aria「匯出」，修為「匯出影片」，尺寸/fps內容斷言保留。64真Canvas/逐鈕、副標保存、完整停留與動態文字零新增貼圖已過。
- C514/check過，完整182/192、快速10/11：透明case透出原底層紅片是正確，改UI隱藏base後驗；舊新UI display:none仍被getByLabel匹配改互斥掛載；六主題summary固定#777改theme fg；相容「新增另一組」選null不應重掛外層丟mode，移除外層key（內Legacy仍按group key）；新刪除保存先poll IndexedDB最新快照再reload，不以延長sleep掩蓋競速。
- code review補offline frame anchor略過、v2子特效目標不fallback第一、先依序後加格的時間、動畫位置調框避免重加base、解碼容量16格+底層、靜態示意圖色彩透明度。對應新純測試與真實影片匯出、格序/全框架鈕/色彩像素測試。
- 原參考 /tmp/videoclip-reference-20261116 18d775f與/workspace/references/VideoClip均clean，只讀；使用者兩段真人錄影只於/tmp抽樣檢視，不進repo。

- C2 c78726b / 43873673041：新13、特效14通過；完整193/194、快速33中32，唯一故事選取實際成拍貼。新三段aria-pressed斷言將失敗縮到第一次觸控、匯入之前，排除解碼與匯入。
- 診斷8ab0122 / 43920200369：pointerdown/up/click都到了回頂浮鈕(x331.5,y509.1)，panel節點沒重掛；原生直接click可選故事，診斷後仍throw原斷言。真正問題是捲動後才出現的浮鈕攔走觸控，改回頂到BottomBar最底的正常排版控制列，保留44px、平滑返回與無footer空白；臨時trace已移除，三階段pressed與所有原圖像/字體/暖光/二格斷言仍保留。

- 710e624 C5：前target1＋13/14/33/2/29/5/9全過，最後22/23唯一320×568回頂列捲到底後才掛出，按鈕底619.4>568；將回頂列改為從開啟起即固定存在的正常最後功能列，移除showTop及scroll事件React更新。新source先驗5手機尺寸target及故事target，都已通過；後續主題配色修正與本頁最終source的194完整／全部快速已成功。

- C7 05ebc86 / 43926305156：完整193/194，六主題與快速136全部成功，唯一原生備援縮圖RGB差32超原24限；修首格在load前註冊presentation回呼、其餘每格在相符時間回呼內立即取圖，避免loadeddata/seeked之外的空白surface競速。新純測試模擬回呼後surface變空，必須仍得到0/2/4秒；快測最先連續三次原生備援，63個不同來源圖與原色差門檻不變，失敗附來源時間/RGB。

- C8 2e5089e / 43929471782：完整193/194、快速138/139唯一clip-a原生備援片尾未補；先前63張長片三輪全部過。實際容器音訊2.008秒、最後影片packet1.933秒，改EncodedPacketSink header-only查目標packet並seek其內側，影片/音訊EOF分開；保留matching presentation擷取，不能退回loadeddata直接取空白首格。新純測試重現2.008/1.933；快速先兩種原生備援各三輪，共6次，完整194及原139其餘斷言保留。

- C9 4b4b41d / 43933078273：快速142全部過，完整193/194唯一1fps長片原生備援偶發未填齊。改從packet邊界+.001定位至已知影格區間中間，snapshot仍核對packet原timestamp；缺圖允許fresh video一次重試，不重取已成功來源。單元模擬seek取整落前幀與第一次load error，原519/check及9項縮圖專項全部過。原63不同圖／RGB24／45秒檢查保留，失敗才記last128回呼與缺圖秒數，不用重跑挑綠或放寬斷言。

C10最終結果：上述修正於source `e92d6bda0024741ebf1f5808441d39e051089edb` / Actions43937100642通過519單元、194完整與142快速回歸；沒有省略原測試或放寬RGB／時間／聲音門檻。

## 實機限制

Chromium使用iPhone13尺寸/觸控與真Canvas/WebGL/解碼/PCM，自製測試素材；不是iPhone Safari。原片4K60/HEVC、多格記憶體、觸控拖曳精度、原音聽感/靜音鍵及長片轉場FPS仍見PLAN §7；沒有宣稱已在使用者手機驗證或網站已更新。


最後主題配色修正：回頂utility明確control/fg，避免normal chip全域底色覆寫accent底色後留下accent-ink而低對比；未放寬原4.5對比門檻。最終六主題全流程成功。
