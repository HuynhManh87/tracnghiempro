const tabs = [
  ['templates','1. Mẫu phiếu'],
  ['key','2. Mã đề & đáp án'],
  ['print','3. In phiếu'],
  ['scan','4. Chấm bằng camera'],
  ['history','5. Lịch sử'],
  ['account','6. Tài khoản & cá nhân hóa'],
];

export default function AppTabs() {
  return (
    <div className="tabs noPrint">
      {tabs.map(([id,label],i)=><button key={id} data-tab={id} className={i===0?'active':''}>{label}</button>)}
      <button data-tab="admin" id="adminTabBtn" className="adminOnly">7. Quản trị hệ thống</button>
    </div>
  );
}
