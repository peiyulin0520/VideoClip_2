# 色調驗收

來源：[Actions43588524060](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43588524060)，source `89872488fe0b866eae873799feca7235a9d4496d`，artifact14111758046。369單元、156 Chromium與5+3+30快速全部成功；tone-playback-metrics.json從成功完整CI原樣複製。

|播放量測（1029.8ms）|結果|
|---|---:|
|影片呈現回呼增加|25|
|色調uniform更新增加|25|
|貼圖上傳增加（影片＋12fps顆粒）|37|
|新媒體貼圖配置|0|
|新色調濾鏡配置|0|
|額外seek|0|
|同時色調pass|1|
|影格buffer（影片＋顆粒）|2|
|聲音RMS energy（後段快照）|0.111540|

使用自行生成的8秒320×180 VP8/Opus色票時間碼影片，色調以兩菱形由電影風漸變鮮豔，柔焦與顆粒於0秒加入並實際啟用。先等待播放進入0.5秒後取樣，再於1.6秒後取第二快照。這是Chromium軟體渲染runner的資源與更新證據，不是手機實際FPS、未調色跑分對比或所有影片的零掉幀保證；iPhone真機見PLAN §7。

另以RGBA色票PNG驗證全13預設、10滑桿的GPU像素（容差4）、透明格保持透明、冷暖定格首末／中點與單格匯出、局部重設、保存重開、復原／刪除。完整影片匯出於0.25／1／1.75秒解碼比對曝光／黑白插值（壓縮容差14），原片長3秒不變。六主題實際捲到色調控制檢查對比，320／430尺寸檢字級／44px觸控／無水平溢位。

- [原始播放量測](tone-playback-metrics.json)
- [預設與細調畫面](../screenshots/tone/presets-and-adjustments.png)
- [兩個定格](../screenshots/tone/keyframe-midpoint.png)
- [啟用中的柔焦顆粒與色調](../screenshots/tone/graded-effects-preview.png)
- [影片匯出](../screenshots/tone/graded-video-export.png)

四張圖已人工檢視；最終修正tone-record被舊chip底色覆蓋造成的淺底白字，以主題accent/ink配對並增強CSS特異性。沒有用未入viewport的控制或未啟用FX當作通過證據。
