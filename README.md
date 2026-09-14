# OMR Mobile React v4.1

Bản React/Vite chuyển từ OMR Mobile v3.63.

## Mục tiêu của bản v4.1

- Giữ nguyên dữ liệu Firebase hiện tại (`teachers`, `access`, `admins`, `sharedAnswerPackages`).
- Giữ nguyên thuật toán OMR, in phiếu, camera, lịch sử, PDF/Excel, Admin và kho đáp án dùng chung.
- Giao diện được đặt dưới React/Vite để có thể tách từng module dần, không còn phát triển tiếp trong một file `index.html` 200KB.
- OMR Engine v3.63 được cô lập thành `public/omr-engine-v4.js` để đảm bảo tương thích trong giai đoạn chuyển đổi.

## Cấu trúc

```
src/
  App.jsx
  components/
    AppHeader.jsx
    AppTabs.jsx
    AuthGate.jsx
    panels/
      TemplatesPanel.jsx
      AnswerKeysPanel.jsx
      PrintPanel.jsx
      CameraPanel.jsx
      HistoryPanel.jsx
      AccountPanel.jsx
      AdminPanel.jsx
  legacy/
    fragments.js
    loadEngine.js
  styles/legacy.css
public/
  omr-engine-v4.js
```

## Chạy local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy Vercel

1. Đưa toàn bộ thư mục này lên GitHub.
2. Import repository vào Vercel.
3. Framework: Vite.
4. Build command: `npm run build`.
5. Output: `dist`.
6. Sau khi có domain mới, thêm domain đó vào Firebase Authentication → Settings → Authorized domains.

Không đổi Firestore collection và không cần di chuyển dữ liệu giáo viên khi chuyển từ v3.63 sang v4.1.

## Nguyên tắc triển khai

Giữ v3.63 đang chạy làm bản production dự phòng. Deploy v4.1 lên một Vercel project/preview URL riêng, kiểm thử đầy đủ rồi mới đổi domain chính.


## v4.1 — Auto OMR v2
- Giữ 4 marker góc chính và thêm 6 marker phụ nhỏ ở hai cạnh (tổng 10 marker).
- Marker phụ nằm trong lề, không chiếm vùng tô đáp án.
- Camera kiểm tra diện tích tờ giấy, độ nghiêng phối cảnh và số marker phụ trước khi chấm.
- Nếu phiếu Auto OMR v2 chỉ nhận 1–3 marker phụ, app không chấm và yêu cầu chụp lại.
- Khi nhận >=4/6 marker phụ, engine nội suy sai lệch theo chiều dọc ở hai mép và hiệu chỉnh cục bộ tọa độ bubble trước khi đọc.
- Overlay camera hiển thị 4 marker chính và A1–A6 marker phụ màu xanh/đỏ.
- Phiếu cũ chỉ có 4 marker vẫn được hỗ trợ ở chế độ tương thích, nhưng app cảnh báo độ ổn định thấp hơn.
- Kết quả lưu thêm `scanMode`, `auxMarkers`, `localCorrection` để truy vết chất lượng lần chấm.

### Lưu ý khi chuyển từ phiếu cũ
Sau khi nâng lên v4.1, nên in lại phiếu để có 6 marker phụ Auto OMR v2. Phiếu cũ 4-marker vẫn chấm được ở chế độ tương thích. Khi in: A4 dọc, 100%/Actual size, không Fit/Shrink.
