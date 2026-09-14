export default function AuthGate() {
  return (
    <div id="authGate" className="open">
      <div className="authGateCard">
        <div className="authGateBrand">
          <h1>OMR Mobile</h1>
          <p>Hệ thống chấm trắc nghiệm và quản lý dữ liệu giáo viên</p>
        </div>
        <h2>Đăng nhập hệ thống</h2>
        <div className="help">Vui lòng đăng nhập bằng tài khoản do Super Admin cấp để vào ứng dụng.</div>
        <label>Email</label>
        <input id="gateEmail" type="email" autoComplete="username" placeholder="giaovien@truong.edu.vn" />
        <label>Mật khẩu</label>
        <input id="gatePassword" type="password" autoComplete="current-password" placeholder="Nhập mật khẩu" />
        <button className="btn primary loginPrimary" id="gateLogin">Đăng nhập</button>
        <div className="accountActions" style={{justifyContent:'center'}}>
          <button className="btn secondary" id="gateForgotPassword" style={{width:'auto'}}>Quên mật khẩu?</button>
        </div>
        <div id="gateStatus" className="help" style={{marginTop:8,textAlign:'center'}}></div>
        <div className="authGateHint">Không có chế độ bỏ qua đăng nhập. Liên hệ Super Admin nếu tài khoản chưa được kích hoạt.</div>
      </div>
    </div>
  );
}
