# Kế hoạch chuyển đổi v3.63 → React v4.0

## Đã thực hiện trong v4.0
- React/Vite quản lý application shell.
- Tách Header, Tabs, Login và 7 panel thành component riêng.
- Tách CSS ra khỏi `index.html`.
- Tách toàn bộ engine nghiệp vụ/OMR ra `public/omr-engine-v4.js`.
- Giữ nguyên ID DOM và contract cũ để không làm sai camera/in phiếu/Firebase trong lần chuyển kiến trúc đầu tiên.
- Giữ nguyên Firebase project, Authentication, Firestore, Storage và dữ liệu hiện có.

## Các bước refactor tiếp theo sau khi v4.0 kiểm thử ổn định
1. Chuyển Auth/Firebase từ legacy engine thành React services/context.
2. Chuyển Mẫu phiếu thành state/component React thuần.
3. Chuyển Mã đề & đáp án + kho dùng chung.
4. Tách Print renderer.
5. Tách Camera/OMR engine thành module độc lập.
6. Chuyển History/Admin sang hooks/services.

Cách này tránh viết lại toàn bộ trong một lần và giảm nguy cơ làm hỏng thuật toán OMR đã ổn định.


## Auto OMR v2 (v4.1)
- 4 corner markers remain the global homography anchors.
- 6 auxiliary side markers (3 rows × 2 sides) are printed at fixed canonical coordinates.
- Local marker offsets are detected after the global homography and interpolated vertically on the left/right edges, then blended horizontally for each bubble coordinate.
- Scan quality gate blocks grading on insufficient page coverage, extreme perspective, or partially detected v2 side markers.
- Legacy four-marker sheets remain readable in compatibility mode.


## v4.2 — History Excel export
Tính năng xuất điểm Excel được bổ sung ở tab Lịch sử mà không thay đổi schema Firebase. Dữ liệu lịch sử v3.63/v4.0/v4.1 hiện có tiếp tục được dùng. Những lịch sử cũ thiếu template hiện tại vẫn xuất tổng điểm; điểm Phần I/III có thể để trống nếu không còn đủ cấu hình mẫu để tính lại.


## v4.3
Bổ sung nhận diện học sinh OMR và danh sách học sinh. Không đổi cấu trúc Authentication, Firestore Rules hay Storage Rules. Dữ liệu `roster` được lưu bên trong `teachers/{uid}/app/state.stateJson`.

## v4.20 — Full-screen Free Scan
- Chế độ camera realtime chuyển sang lớp camera toàn màn hình, không còn khung canh giấy cố định.
- Nếu 4 marker không nằm trong 4 ROI góc của khung hình, engine có fallback tìm marker chính trên toàn frame rồi chọn tứ giác phiếu phù hợp.
- Overlay nối 4 marker thành viền xanh theo đúng vị trí phiếu thật.
- Sau khi tự chấm, camera không đóng. Kết quả và nút Lưu hiển thị ngay trên camera.
- Sau khi lưu, khi phiếu rời camera 2 nhịp quét liên tiếp, app tự reset để nhận bài tiếp theo.
