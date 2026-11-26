# 寶寶紅包袋 Baby Red Packet Studio：上線版

媽媽上傳照片、選款式後，用 LINE Pay 付款。付款成功後，你在後台下載印刷檔，上傳 7-11 ibon 取得列印碼，再透過 LINE 傳給客人。

## 檔案結構

```
index.html               媽媽用的製作頁（前台）
admin.html               店家後台（要輸入密碼）
api/orders.js            建立訂單（價格由伺服器決定）
api/order-page.js        上傳每一頁印刷檔（A4、300 dpi JPEG）
api/pay.js               呼叫 LINE Pay Request API，回傳付款網址
api/linepay-confirm.js   LINE Pay 付款完成後導回這裡，呼叫 Confirm API 請款
api/linepay-cancel.js    客人在 LINE Pay 頁面按取消
api/admin.js             後台 API：訂單列表、讀取印刷檔、填列印碼、刪除檔案
lib/shared.js            LINE Pay 簽章、訂單存取、共用工具
```

## 部署到 Vercel（約 15 分鐘）

1. **建立專案**：把這個資料夾推到 GitHub，在 Vercel 選 Add New → Project 匯入。Framework 選 **Other**，不需要 build 指令。
2. **建立私有儲存空間**：進入專案的 **Storage** 分頁 → Create Storage → **Blob** → 存取權限選 **Private**，然後連結到這個專案。Vercel 會自動加好存取憑證。
3. **設定環境變數**（Settings → Environment Variables）：

   | 名稱 | 值 |
   |---|---|
   | `LINE_PAY_CHANNEL_ID` | LINE Pay 商家後台的 Channel ID |
   | `LINE_PAY_CHANNEL_SECRET` | LINE Pay 的 Channel Secret Key（**只放這裡，絕不放進前端**） |
   | `LINE_PAY_ENV` | 先填 `sandbox`，正式上線改成 `production` |
   | `ADMIN_PASSWORD` | 後台密碼，至少 8 碼 |
   | `PUBLIC_BASE_URL` | 選填。用自己的網域時填，例如 `https://redpacket.example.com` |

4. **重新部署**（Deployments → Redeploy），讓環境變數生效。

## 用 sandbox 測試

1. 打開網站，做一組紅包袋，按「前往付款（LINE Pay）」。
2. 會跳到 LINE Pay sandbox 付款頁，完成付款後回到網站，看到「付款完成」。
3. 打開 `/admin.html` 輸入密碼，應該能看到這筆訂單，狀態是「已付款・待上傳 ibon」。
4. 下載 PDF，印一張確認尺寸、顏色和裁切線。

## 正式上線

1. 把 `LINE_PAY_ENV` 改成 `production`，Channel ID／Secret 換成正式商店的，然後 Redeploy。
2. 自己先實際付一筆，確認錢有進到 LINE Pay 商家後台。退款可以在商家後台直接處理。

## 已經處理好的細節

- **金額由伺服器決定**（`lib/shared.js` 的 `PRICE = 199`），前端改不了。
- **transactionId 不會失真**：LINE Pay 的交易編號有 19 位數，超過 JavaScript 數字能精確表示的範圍，程式已改成以字串保存。
- **重複導回也不會重複請款**：付款完成頁被重新整理、或 LINE Pay 重送 callback，都不會再請款一次。
- **照片和印刷檔都是私有的**，只有輸入後台密碼才拿得到。
- 每頁印刷檔分開上傳，避開 Vercel 單次 4.5 MB 的上傳上限。超過時會自動降低 JPEG 品質。

## 營運提醒

- 提供列印碼 30 天後，在後台按「刪除照片檔」。這是付款頁上對媽媽的承諾。
- 想改價格，修改 `lib/shared.js` 的 `PRICE`，並同步修改 `index.html` 上顯示的金額。
