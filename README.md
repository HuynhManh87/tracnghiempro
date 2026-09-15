## v4.13 — Answer Grid Lock + OMR Diagnostics

Bản này tự khóa lưới Phần I và Phần II vào tâm vòng tròn thực tế trên ảnh trước khi chấm; bảng kết quả hiển thị điểm mực A/B/C/D và Δ để chẩn đoán.

# OMR Mobile React v4.4 — Live Camera OMR

Bản React/Vite chuyển từ OMR Mobile v3.63.

## Mục tiêu của bản v4.3

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


## v4.3 — Xuất điểm Excel theo lớp / phòng
- Tab Lịch sử có bộ lọc theo kỳ kiểm tra, môn, loại lớp/phòng và lớp/phòng cụ thể.
- Bảng lịch sử hiển thị đúng dữ liệu đang lọc.
- Xuất `.xlsx` theo bộ lọc hiện tại.
- Nếu có nhiều lớp/phòng, workbook tự tạo: `Tong hop`, `Thong ke` và từng sheet `Lop_*` / `Phong_*`.
- Excel có họ tên, lớp/phòng, số hiệu/SBD, kỳ kiểm tra, môn, mã đề, điểm từng phần, điểm OMR, thời gian chấm, trạng thái ảnh và thông tin Auto OMR v2.
- Không thay đổi Firestore Rules và không cần chuyển dữ liệu cũ.


## v4.3 — Nhận diện học sinh bằng Số hiệu / SBD OMR
- Phiếu có thêm khối OMR 3 chữ số cạnh khối TÔ MÃ ĐỀ.
- Thi tại lớp: nhãn tự đổi thành `TÔ SỐ HIỆU`.
- Chia phòng thi: nhãn tự đổi thành `TÔ SBD`.
- Camera đọc đồng thời Số hiệu/SBD và Mã đề bằng đúng tọa độ đã in trên phiếu.
- Tab Lịch sử có quản lý danh sách học sinh từ Excel/CSV.
- File danh sách hỗ trợ: `Họ và tên`, `Lớp`, `Số hiệu`, `Phòng thi`, `SBD`.
- Khi chấm, app dùng Số hiệu hoặc SBD để tự tra Họ tên + Lớp + Phòng.
- Kết quả thi chia phòng vẫn có thể xuất Excel gộp ngược theo lớp gốc.
- Có nút điền lại tên cho các kết quả cũ nếu đã chấm trước khi nhập danh sách.
- Roster được lưu trong state của chính giáo viên và đồng bộ Firebase; không cần sửa Firestore Rules.

### Quy ước
- Số hiệu/SBD dùng 3 chữ số: `1 → 001`, `12 → 012`, `125 → 125`.
- Khi in: A4 dọc, 100% / Actual size, không Fit/Shrink.


## v4.4 — Live Camera OMR
- Mở camera điện thoại trực tiếp bằng `getUserMedia()`.
- Ưu tiên camera sau.
- Liên tục kiểm tra 4 marker góc, marker phụ, phối cảnh và độ ổn định.
- Đạt chuẩn + giữ yên 3 nhịp → tự đóng băng 1 frame → tự chấm.
- Sau khi chấm: kiểm tra kết quả → Lưu → Quét bài tiếp theo.
- Có đổi camera trước/sau.
- Có bật/tắt đèn nếu camera + trình duyệt hỗ trợ `torch`.
- Có rung báo chấm xong nếu thiết bị hỗ trợ.
- Vẫn giữ Chụp/Chọn ảnh làm phương án dự phòng.
- Video chỉ xử lý trên thiết bị, không tải stream lên server.
- Giữ nguyên Auto OMR v2, nhận diện Số hiệu/SBD, Mã đề, tra học sinh, Excel và Firebase.
- Giữ chỉnh sửa Mã đề đầu phiếu dịch phải 26px.

Yêu cầu: website HTTPS (Vercel đáp ứng) và người dùng cho phép quyền Camera.


## v4.4.1 — Sửa nhập đáp án Phần II
- Bỏ dropdown Đ/S quá hẹp.
- Mỗi ý a/b/c/d dùng một nút trạng thái rõ ràng:
  - xanh `Đ` = Đúng
  - đỏ `S` = Sai
- Bấm trực tiếp để đổi `Đ ↔ S`.
- Dữ liệu vẫn lưu vào `tfKey` như trước, nên không ảnh hưởng chấm OMR, import/export đáp án hoặc Firebase.
- Desktop: tối đa 4 câu Phần II mỗi hàng.
- Mobile: tự xuống 2 câu/hàng hoặc 1 câu/hàng.


## v4.4.3 — Quét xa nhưng đọc Mã đề bằng ảnh HD
Vấn đề thực tế: để thấy đủ 4 marker góc của A4, camera phải lùi xa; vùng TÔ MÃ ĐỀ trên preview 1080p có thể quá ít pixel.

Cách xử lý mới:
- Preview chỉ dùng để nhận 4 marker góc, marker phụ và kiểm tra độ ổn định.
- Preview KHÔNG còn bắt buộc phải đọc được Mã đề.
- Sau 3 nhịp ổn định, app tự chụp một ảnh HD:
  - ưu tiên `ImageCapture.takePhoto()` để lấy ảnh tĩnh độ phân giải cảm biến trên trình duyệt hỗ trợ;
  - fallback về frame video native nếu không hỗ trợ.
- Ảnh HD được xử lý tối đa tới cạnh 4600px trước khi đọc Số hiệu/SBD, Mã đề và đáp án.
- Camera yêu cầu độ phân giải lý tưởng 3840×2160 và autofocus liên tục nếu thiết bị hỗ trợ.
- Không cần thay đổi hay in lại mẫu phiếu.


## v4.5 — Grid Lock: bắt lưới OMR thật trên ảnh
Nguyên nhân lỗi cũ:
- engine chỉ biến đổi tọa độ cố định từ template sang ảnh;
- không khóa lại lưới theo các vòng tròn thực tế;
- vùng đo độ đen quá lớn, ăn cả viền vòng tròn nên ô trống cũng có thể bị xem là tối.

Cơ chế mới:
1. Nhận 4 marker chính + marker phụ như trước.
2. Với khối Số hiệu/SBD và Mã đề, tìm độ lệch lưới trong phạm vi ±10 đơn vị sheet bằng viền tròn thật trên ảnh.
3. Dịch lưới nhận dạng tới đúng tâm các vòng tròn trước khi đọc.
4. Độ tô chỉ đo ở **lõi bên trong vòng tròn**, không tính viền in.
5. Ngưỡng chọn ô là thích nghi theo nền của từng cột: so ô đậm nhất với median của 10 ô.
6. Overlay sau khi chấm hiển thị các tâm lưới thật mà engine đang đọc.
7. Ảnh upload giữ tới 3200px cạnh dài để không mất chi tiết.
8. Marker chính chạm mép ảnh bị loại, tránh homography sai vì marker bị cắt.

Với ảnh kiểm thử thực tế có mã 101, cơ chế Grid Lock tìm được độ lệch dọc của khối Mã đề và tách rõ các ô 1-0-1 khỏi các vòng tròn trống.


## v4.6 — Realtime OMR
Mục tiêu: trải nghiệm giống máy chấm realtime — đưa phiếu vào camera là thấy ngay Mã đề, điểm từng phần, tổng điểm và màu từng đáp án.

### Quy ước màu
- Xanh lá: học sinh tô đúng đáp án.
- Đỏ: ô học sinh tô nhưng sai.
- Vàng: đáp án đúng của câu khi học sinh tô sai hoặc bỏ trống.

### Cơ chế
- Camera xử lý liên tục khoảng 3 frame/giây.
- Sau khi nhận 4 marker + marker phụ, engine khóa lưới bằng Grid Lock.
- Đọc Số hiệu/SBD, Mã đề và toàn bộ bubble ngay trên frame hiện tại.
- Điểm I/II/III và Tổng hiện ngay, không chờ ảnh HD.
- Kết quả giống nhau 2 lần liên tiếp mới bật nút `Lưu kết quả`.
- Lưu xong tự reset và sẵn sàng bài tiếp theo, không hiện popup chặn luồng.
- Canvas overlay được đặt trực tiếp trên video camera để giáo viên thấy engine đang đọc ô nào.
- Chế độ Chụp/Chọn ảnh và nút Chấm bài thủ công vẫn giữ nguyên.


## v4.6.1 — Sửa camera điện thoại
- Bỏ ràng buộc độ phân giải tối thiểu 1280×720 có thể làm một số điện thoại từ chối mở camera.
- Tự thử nhiều cấu hình camera từ độ phân giải cao xuống chế độ tương thích.
- Thêm nút `Chụp & chấm ngay` để gọi trực tiếp luồng chụp HD vốn có nhưng trước đây chưa được gắn vào giao diện.
- Thêm kiểm tra HTTPS / `getUserMedia` / kích thước preview và thông báo lỗi rõ hơn.
- Giữ nguyên Realtime OMR v4.6 và chế độ Chụp/Chọn ảnh dự phòng.


## v4.8 — Auto Scan / Auto Grade
- Bật mặc định chế độ **Tự chấm khi ổn định**.
- Camera liên tục nhận 4 marker chính, marker phụ, Mã đề và đáp án.
- Chỉ tự chụp khi phiếu gần như đứng yên và cùng kết quả được xác nhận 3 khung hình liên tiếp.
- Khi đủ 3/3, app tự lấy ảnh HD rồi chấm chính thức, không cần bấm nút chụp.
- Sau khi chấm thành công, camera tạm khóa để tránh chấm trùng cùng một phiếu; dùng **Quét bài tiếp theo** để mở lại.
- Nút **Chụp & chấm ngay** vẫn được giữ làm phương án dự phòng.


## v4.8 Smooth Camera
- Luồng video camera không còn bị canvas OMR phủ bằng ảnh đã xử lý.
- Canvas realtime chỉ vẽ annotation trong suốt.
- Preview ưu tiên 720p/30fps; ảnh chấm cuối vẫn cố lấy HD bằng ImageCapture.
- Phân tích OMR được giảm kích thước và điều chỉnh nhịp theo cấu hình thiết bị.
- Mục tiêu: giảm giật/lag rõ rệt khi đưa phiếu vào camera.


## v4.9 — Smart AutoScan / chống kẹt Giữ yên 0/3
- Sửa lỗi camera đã nhận đủ 4/4 marker, 6/6 marker phụ và đúng Mã đề nhưng bộ đếm Giữ yên vẫn 0/3.
- Tính chuyển động theo trung vị 4 marker + tâm trang, tránh một marker dao động làm reset toàn bộ.
- Ngưỡng ổn định thích nghi theo cấu hình realtime.
- Nếu toàn bộ kết quả OMR giống frame trước, cho phép rung tay nhẹ hơn để vẫn tự chấm.
- Frame rung nhẹ chỉ làm giảm 1 nấc xác nhận thay vì reset ngay về 0.


## v4.11 — Timed AutoScan
- Bỏ điều kiện 3 frame OMR phải giống hệt nhau.
- Bỏ rung marker khỏi điều kiện kích hoạt tự chấm.
- Chỉ cần 4 marker chính, đủ marker phụ và mã đề hợp lệ được duy trì khoảng 0,8 giây.
- Cho phép mất nhận diện ngắn tối đa ~1,25 giây mà không reset toàn bộ tiến trình.
- Ảnh preview chỉ dùng để khóa phiếu/mã đề; ảnh HD mới dùng để chấm chính thức.


## v4.15 – Image History Fix
Lưu snapshot đúng bài chấm, kiểm tra IndexedDB sau khi ghi và hiển thị thumbnail trực tiếp trong Lịch sử.


## v4.15 — Ổn định Phần II Đúng/Sai
- Phần II dùng bộ đọc cặp Đ/S riêng, ưu tiên chênh lệch giữa hai ô thay vì ngưỡng tuyệt đối.
- Grid Lock Đ/S không còn tự nhảy ±4px theo từng câu; nó neo theo median của Phần I rồi chỉ tinh chỉnh nhỏ.
- Phiếu in mới dùng vòng Đ/S 10px (tâm không đổi) để tránh các vòng đứng dính/chồng nhau. Phiếu cũ vẫn có thể quét.
- Debug Phần II vẫn hiển thị hai giá trị OMR và Δ để kiểm tra.


## v4.16 — Phần II dùng vòng tròn giống Phần I
- Vòng Đúng/Sai đổi về 12px, cùng kích thước với vòng A/B/C/D của Phần I.
- Khoảng cách tâm theo chiều dọc đổi từ 12px lên 14px, bằng đúng hàng Phần I.
- Tọa độ OMR Phần II được cập nhật cùng lúc, nên mẫu in mới và engine nhận dạng luôn đồng bộ.
- Các vòng Phần II không còn dính sát theo kiểu cũ.


## v4.17 — Phần III dùng vòng tròn và khoảng cách giống Phần I

- Vòng tròn Phần III dùng kích thước 12 px như Phần I.
- Khoảng cách tâm theo chiều dọc của dấu âm, dấu phẩy và các hàng số dùng bước 14 px.
- Tọa độ in và tọa độ OMR cập nhật đồng bộ.
- Vùng đo độ đậm Phần III dùng cùng bán kính với Phần I để tăng độ ổn định.
- Nên in lại phiếu mới từ v4.17 để Phần III khớp hoàn toàn với engine mới.


## v4.18 — Sửa dứt điểm vòng tròn Phần II bị dính nhau

- Nguyên nhân: `.tfBubble` dùng `box-sizing: content-box`, làm đường kính hiển thị thực tế ~14.5px dù khai báo 12px.
- Sửa thành `box-sizing: border-box`, đúng như Phần I.
- Đường kính hiển thị thực tế Phần II: 12px.
- Khoảng cách tâm theo chiều dọc: 14px.
- Khoảng hở giữa hai vòng liên tiếp: 2px.
- Không đổi tọa độ tâm OMR nên không làm lệch engine nhận dạng.
- Giữ nguyên toàn bộ cải tiến Phần III từ v4.17.


## v4.19 — Lưu song song ảnh gốc và ảnh đã chấm màu
- Khi lưu kết quả, app lưu hai ảnh độc lập: ảnh gốc và ảnh đã chấm.
- Ảnh đã chấm chỉ đóng dấu vòng màu: xanh = đúng, đỏ = học sinh chọn sai, vàng = đáp án đúng khi học sinh sai/bỏ trống.
- Ảnh gốc không bị chỉnh sửa.
- Lịch sử có nút `Đã chấm` và `Ảnh gốc`; trình xem ảnh cũng chuyển được giữa hai bản.
- IndexedDB và Firebase Storage lưu hai bản bằng hai ID/đường dẫn khác nhau.
- Dữ liệu lịch sử cũ chỉ có một ảnh vẫn tương thích.


## v4.20 — Full-screen Free Scan
- Camera quét mở dạng toàn màn hình, không còn khung canh phiếu cố định.
- Engine tự tìm 4 marker góc trên toàn bộ khung camera và vẽ đường viền theo đúng tờ phiếu được phát hiện.
- Khi đủ marker, marker phụ và mã đề hợp lệ trong khoảng 0,8 giây, app tự lấy ảnh HD và chấm; không cần bấm nút chụp.
- Sau khi chấm, kết quả vẫn hiển thị ngay trên camera. Nút Lưu nằm trực tiếp trên giao diện camera toàn màn hình.
- Sau khi lưu, app chờ giáo viên lấy phiếu ra. Khi mất phiếu trong 2 nhịp quét liên tiếp, app tự reset và sẵn sàng bài tiếp theo.
- Giữ nguyên cơ chế lưu ảnh gốc + ảnh đã chấm màu của v4.19.
