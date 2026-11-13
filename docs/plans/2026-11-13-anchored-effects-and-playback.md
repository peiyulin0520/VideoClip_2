# 特效標記、固定單素材邊界、圓角表單與穩定播放

最新使用者更正優先於上一輪任意單素材時窗：
- 銜接在接點顯示代表字；單素材在實際特效起點標記，藍綠/棕色區分。收合分類也可見，點字開對應設定，小圓視覺/44px觸控。
- 單素材只能開頭B進場／結尾A退場。進場起固定0，只1迄，可調迄/時長；退場迄固定片尾，只1起，起=片長-時長。舊任意多組單素材依原duration靠邊界，空設定仍停用。一般畫面特效/兩片銜接/來源仍多組。
- 全站文字/數字/搜尋/下拉/textarea淺棕無黑框深字圓角膠囊，select棕色自訂下箭頭；range/checkbox/color/file不改。14px操作/11px註解及較小時間軸、44px觸控保留。

播放追加：未按播放卻自動播、0秒/捲頁/popup後頓、分離聲音略好但爆音；同意100%載入後編輯。使用者指定參考VideoClip main。
- 已讀VideoClip player/mediaPool/audio/proxy/proxyQueue/assetUrls/previewQuality：有本機960 proxy、獨立audio元素、iOS禁速率微調、按手勢lazy WebAudio及音訊會話。新版先前只縮畫布、仍解碼4K/HEVC，每幀重設速率及gain零→原值。
- 實作：背景worker逐支做proxy，尺寸跟540/720/1080/1920，H264優先VP9備援、HDR轉SDR、保留音訊。OPFS快取；urlFor一直原檔、previewUrlFor只預覽，所有匯出不能用proxy。不能跨repo搬使用者資料。
- 讀專案→素材→proxy→可畫首幀的真實進度，背景編輯inert，100%後啟用；不是把整支每幀解碼放記憶體。失敗有重試/略過/返回，離開取消worker。
- 每幀不重設相同playbackRate、iOS禁速率微調、seek中不重複seek/硬校正限頻；載入時停時鐘及聲音、訂閱立即同步按鈕；非播放意圖/晚到promise的pause guard。VideoClip式同步解鎖play/pause；meta prime最多350ms且檢查item/asset。
- 分離聲音audio pool；WebAudio按手勢lazy建立/只接有聲元素、gain有變才8ms漸變、limiter防混音削波、AudioSession=playback。主影片播放時停示意，原生來源試播前停主播放器，切背景暫停不自動續。

匯入時不重建主播放器：新增影片用獨立、可取消的proxy準備流程；完成後以當下播放頭prepare，不覆蓋匯入後定位。原player/compositor保持存活。比例或品質改變才重建；所有已destroy的player操作與晚到frame通知都忽略。訂閱通知走快照，避免同一emit因React重新訂閱而重複走訪。

參考來源：[VideoClip](https://github.com/peiyulin0520/VideoClip)，主要比對src/engine/player.ts、mediaPool.ts、audio.ts、proxy.ts、proxyQueue.ts、assetUrls.ts、previewQuality.ts；保留VideoClip_2獨立資料庫/OPFS命名。

## 驗證
- source 2877465c1d905d39ce54170f0aac642f7596b5bf；本機check343單元、lint/格式/TypeScript/build/Pages/39字體成功。
- [Actions 43519974884](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43519974884)：快速6/6成功；完整140/144，四個版型helper未等載入閘就fill，已補等待真正就緒，保留原斷言，待重驗144及成功截圖。
- 快速包括：新增影像/追加主軌後仍可操作、維持新播放位置與返回首頁；同秒不同scope的時間軸代表字；六主題膠囊表單；真實readyState載入閘/inert/無自動播、0秒重播/速率與seek次數/popup/聲音能量；分離音訊只1個audio及1個video；native 540→720尺寸、重開無新增worker及原檔細線匯出。
- 先前43513918905有92過/26失敗/25未跑，20分鐘時限結束；b7673f5及7c196c0快速5/6。均屬失敗過程，不作最終證據。c51d72e保留player後快速6/6成功，再補主軌定位/通知快照。
- PR #10仍open未合併，由使用者自行Merge才發布。Safari長片/HEVC/HDR、低記憶體、背景返回與真實聲音仍待真機，不保證所有手機4K順暢。預覽失敗時會提示原檔備援，匯出永遠不取proxy。
