# 預覽有聲播放與匯入等待

使用者確認參考的是原版 [VideoClip](https://github.com/peiyulin0520/VideoClip)，不是把本專案改成另一個版本。比對原版 audio / player / mediaPool / proxyQueue / videoSync：原版在手勢內啟用聲音、舊 iOS 無 AudioSession 使用 native 音訊、proxy/縮圖不阻擋進入、避免頻繁全域暫停與速率微調。

## 本輪實作

- AudioBus 在 play 前接靜音 gain 並取消 native mute；分離音訊也在同一手勢授權。iOS 無 AudioSession 使用原生預聽；細部音量仍保留於專案及匯出，舊 iOS 的原生預聽音量受瀏覽器限制。
- 畫質／比例重建保留同一 AudioContext；離開專案關閉，不因非手勢回呼新建 context 丟失授權。interrupted 狀態可在手勢 resume。
- 暫時缺畫格繼續 native 解碼，不逐次 pause 全部來源／重設時間，超時仍報錯；來源尾端不反覆重播。UI 播放時間訂閱搬到獨立播放列，主編輯器及預覽選取框不跟時鐘重繪。
- 匯入先讀 metadata、保存原檔及準備當前畫面；100%代表這個畫面可用，不再等待整片轉檔／全片縮圖。既有完成的 proxy 開啟時還原；未驗聲音的舊 proxy 先查音軌，不存在則只捨棄衍生 metadata，原檔保留。
- 暫停500ms後依序準備 proxy 與每2秒真實縮圖；播放／來源視窗預聽／畫布操作即取消，暫停後續做。縮圖保留部分成功時間戳，不複製首幀、不拿overview冒充；記憶體直接沿用本機 Blob，不再 fetch blob URL 複製。
- proxy URL 僅暫停時換入。背景進度與載入閘分開顯示，optional 失敗本次不忙迴圈重試，下次開啟再嘗試。

## 驗證

- 本機 npm run check；單元涵蓋音訊手勢／native模式／context重用、背景取消及恢復、舊無音proxy、縮圖斷點接續。
- GitHub Actions 才執行 Chromium：新增首次原音、native實際音軌、切畫質／零秒重播、阻塞背景worker仍可操作、暫缺frame不全域pause；原音訊波形門檻與既有完整回歸保持。
- Safari真機、原使用者長片及音訊聽感未驗。參考相同策略不代表可保證任意手機負載皆流暢；540畫布與真正proxy是不同層，proxy未好前先用原檔。
