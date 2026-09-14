export default function AppHeader() {
  return (
    <header>
      <div>
        <h1>OMR Mobile v4.9</h1>
        <small>Auto OMR v2 • Tự đọc Số hiệu/SBD + Mã đề • 4 marker chính + 6 marker phụ</small>
      </div>
      <div className="accountHeader">
        <span className="reactVersionTag">React</span>
        <span className="badge">Auto OMR</span>
        <span className="accountChip" id="headerAccountChip">
          <span className="accountDot" id="headerAccountDot"></span>
          <span id="headerAccountText">Đang xác thực...</span>
        </span>
        <button className="headerLogoutBtn" id="headerLogoutBtn">Đăng xuất</button>
      </div>
    </header>
  );
}
