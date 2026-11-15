# 預覽播放與匯入驗收

PR：https://github.com/peiyulin0520/VideoClip_2/pull/14

使用者已確認參考原版VideoClip網站。本輪只對齊其可用的音訊授權／原生解碼／非阻塞準備策略，保留本專案的色調、定格、多版型與匯出。

## 修改與斷言

| 回報／風險 | 修改與驗證 |
| --- | --- |
| 首次播放無聲 | play前在同一手勢prime，分離原音亦授權；測首次實際WebAudio能量與native音軌PCM輸出，不只看按鈕 |
| 舊iOS靜音 | 無AudioSession走native預聽；測play當下unmuted、有音軌/PCM，音量精調仍存專案供匯出 |
| 切畫質後無聲 | 重建沿用context；測畫質切換仍有聲、只建一次context。取消舊初始化不得關掉共用context；已closed的context在下次手勢重建 |
| 一格格播放 | 暫時缺frame不全域pause/reset clock；注入350ms readiness缺口，驗native未被pause、時間持續前進及之後有音訊 |
| 匯入等待過久 | metadata與目前畫面先就緒，worker永久不完成仍可進入編輯/播放；播放即終止optionalworker，pause後恢復 |
| 播放受背景處理影響 | 提示固定於預覽內不推動版面；主預覽、來源預聽、畫布/裁切/範圍/時間軸手勢讓出資源；只有暫停後序列做轉檔/縮圖，完成URL不在播放中換入 |
| 後段縮圖錯位 | 真實每2秒時間戳、部分保存後接續缺圖；原有126秒63個各不相同畫面／58/60/112/124秒與trim/speed斷言保留 |
| 爆音／特效卡頓回歸 | 原音訊邊界波形、即時maxJump<0.08、三輪與GPU貼圖/配置/seek斷言不放寬 |

## 狀態

- 本機：412單元／41檔與npm run check通過（lint、格式、TypeScript、build、Pages/PWA/39字體授權）。
- 最終source `bffd168bfde821aaa1e8d92bb74ae352b64a5a6f`，[Actions43675152122](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43675152122)：174完整Chromium（12.1分鐘）通過；快速33／2載入／29編輯／5色調／9三輪音訊／30生命週期全部通過。
- 音訊三輪live maxJump為0.004138112、0.004171133、0.004067361；完整0.004067361，原門檻0.08不改。原始量測與排程事件在[playback-import-audio.json](playback-import-audio.json)。
- fast artifact14146372790／2,631,919 bytes，下載SHA-256核對b66e52499260b2c47217f8865d17df19b72faeccb71cfddfd7f88b5d61579672。兩張成功圖已人工檢視，提示不推動版面／不遮右側按鈕；完整artifact14146492590未另下載。最後只文件/量測/PNG，程式/測試/workflow保持已測source。
- 第一版source9f5ff60 / Actions43674079537，新增4＋載入2＋編輯29＋色調5＋音訊三輪9已過；為追加context生命週期補強啟動新版驗收，初版不當作最終版本證據。
- 僅使用自行生成的影片/音訊素材，不上傳或提交使用者錄影。

初版完整跑到取消前有3失敗（advanced選段／feedback跨層／story補色後seek），artifact14146380206的error-context已讀。第二版快速ABC也有seek4.5回到6秒、完整GIPHY seek0.4回到0.1的同類競態。修復Player.refresh同時間通知與提示列高變動，補同一事件scrollLeft→refresh的確定性回歸；原像素/時間斷言不放寬，失敗不當作完成。

## 限制

Safari／iPhone原片、靜音鍵與背景回來、長片實際FPS/聽感仍待真機；Chromium的iPhone尺寸/UA與能力模擬不代表Safari實測。首次proxy尚未建立前使用原檔，540畫布上限不等於已經降低原檔解碼負擔；背景完成後才在暫停換入真正proxy。較舊iOS的native預聽細部音量受瀏覽器限制，匯出保留完整音量設定。實作計畫見 ../plans/2026-11-15-playback-import-reliability.md。


## 成功畫面

- [背景尚未完成已能編輯](../screenshots/playback-import/edit-before-background-ready.png)：自製10秒測試片，刻意永久阻塞背景worker，主預覽/播放已可使用；不能把這張的空縮圖說成已完成建圖。
- [切畫質、回零後重播](../screenshots/playback-import/replay-with-original-sound.png)：自製變色測試片、真正音訊能量及context數量已斷言。截圖本身不能證明聲音／FPS，這些依實際PCM/播放測試。
