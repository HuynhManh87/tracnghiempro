window.OMR_REACT_VERSION='4.9.0';

const $=s=>document.querySelector(s), SHORT_SYMS=['-','0','1','2','3','4','5','6','7','8','9',','];
const DEFAULT_FIREBASE_CONFIG={
  apiKey:'AIzaSyD8k2NT7IJHw6jNUSXFcVWFC0AQg_qwsgk',
  authDomain:'chamdiemtracnghiem-ea4ce.firebaseapp.com',
  projectId:'chamdiemtracnghiem-ea4ce',
  storageBucket:'chamdiemtracnghiem-ea4ce.firebasestorage.app',
  messagingSenderId:'944038528926',
  appId:'1:944038528926:web:f459ff47eb84c4e0d4788f'
};
const LS_TPL='omr_templates_v3',LS_HIS='omr_history_v3',LS_ASSIGN='omr_assignments_v1',LS_ROSTER='omr_student_roster_v1',LS_IMG_MODE='omr_image_mode_v1',LS_IMG_RET='omr_image_retention_v1',LS_PROFILE='omr_teacher_profile_v1',LS_FB_CONFIG='omr_firebase_config_v1',IMG_DB='omr_mobile_images_v1',IMG_STORE='gradeImages',FIREBASE_SDK='12.18.0';
const AUTO_OMR_V2={version:'2.0',cornerCenters:[{x:31,y:31},{x:763,y:31},{x:763,y:1092},{x:31,y:1092}],auxRows:[340,640,940],auxX:[31,763],auxSize:10,auxMinDark:.34,auxSearch:16,auxRequired:4,minPageAreaRatio:.18,maxOppositeEdgeRatio:1.9};
let templates=[],assignments={},studentRoster=[],imgState=null,pendingGradeImage=null,pendingGradeAnnotation=null,pendingAnnotatedGradeImage=null,historyThumbUrls=[],markerPoints=[],manualMode=false,lastGrade=null,H=null,imageDbPromise=null,currentViewerImageId=null,currentViewerUrl=null,currentViewerKind='graded',currentViewerResultId='',currentUser=null,currentProfile={},firebaseCtx=null,firebaseModules=null,cloudSyncTimer=null,cloudLoading=false,deviceModeForced=false,currentIsAdmin=false,adminTeacherCache=[],adminSecondaryApp=null,adminDetailUid=null,adminSubjectStatsCache=[],adminClassStatsCache=[],sharedKeyCache=[],auxMarkerObservations=[],scanQuality=null,localCorrection=null,liveStream=null,liveTimer=null,liveRunning=false,liveBusy=false,livePaused=false,liveStableFrames=0,livePrevMarkers=null,liveFacingMode='environment',liveTorchOn=false,liveExamCode='',liveExamStable=0,liveAutoScan=true,liveAutoCooldownUntil=0,gridLockState=null,answerGridLockState=null,realtimeSignature='',realtimeStableCount=0,realtimeLast=null,realtimeBuzzSignature='',liveReadySince=0,liveReadyLastSeen=0,liveReadyExam='',liveReadyHits=0,liveReadyRequiredMs=780,liveReadyGraceMs=1250,liveAwaitRemoval=false,liveRemovalMisses=0,liveCurrentSaved=false,liveResultLocked=false,liveResultLockUntil=0,liveResultHoldMs=4000,liveRemovalSince=0,liveRemovalRequiredMs=1200;
function uid(){return 't'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function scopeId(){return currentUser?.uid||'device'}
function nsKey(base,sid=scopeId()){return `${base}::${sid}`}
function getScoped(base,fallback=null){const v=localStorage.getItem(nsKey(base));return v===null?fallback:v}
function setScoped(base,value){localStorage.setItem(nsKey(base),value)}
function parseJson(s,fallback){try{return JSON.parse(s??'')??fallback}catch(e){return fallback}}
function cur(id){return templates.find(t=>t.id===id)}
function saveAll(){setScoped(LS_TPL,JSON.stringify(templates));queueCloudSync()}


function getLocalProfile(){return parseJson(getScoped(LS_PROFILE,'{}'),{})||{}}
function saveLocalProfile(p){currentProfile={...currentProfile,...p};setScoped(LS_PROFILE,JSON.stringify(currentProfile));queueCloudSync();renderAccountState()}
function sanitizeFirestore(v){return JSON.parse(JSON.stringify(v))}
function parseFirebaseConfig(raw){
  raw=String(raw||'').trim();
  if(!raw)return null;
  try{const j=JSON.parse(raw);if(j&&j.apiKey&&j.projectId)return j}catch(e){}
  const keys=['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId','measurementId'],o={};
  for(const k of keys){
    const m=raw.match(new RegExp(k+"\\s*:\\s*[\"']([^\"']+)[\"']"));
    if(m)o[k]=m[1];
  }
  return o.apiKey&&o.projectId?o:null;
}
async function loadFirebaseModules(){
  if(firebaseModules)return firebaseModules;
  const base=`https://www.gstatic.com/firebasejs/${FIREBASE_SDK}`;
  const [app,auth,firestore,storage]=await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
    import(`${base}/firebase-storage.js`)
  ]);
  firebaseModules={app,auth,firestore,storage};return firebaseModules;
}
async function initFirebaseFromSaved(){
  const cfg=parseJson(localStorage.getItem(LS_FB_CONFIG)||'null',null)||DEFAULT_FIREBASE_CONFIG;
  try{
    const m=await loadFirebaseModules();
    const app=m.app.getApps().length?m.app.getApps()[0]:m.app.initializeApp(cfg);
    const auth=m.auth.getAuth(app),db=m.firestore.getFirestore(app),storage=m.storage.getStorage(app);
    try{await m.auth.setPersistence(auth,m.auth.browserLocalPersistence)}catch(e){}
    firebaseCtx={app,auth,db,storage,config:cfg};
    setFirebaseStatus('Đã kết nối Firebase. Đang kiểm tra tài khoản…','ok');
    m.auth.onAuthStateChanged(auth,async user=>{
      if(user)await activateTeacher(user);
      else{
        currentUser=null;currentIsAdmin=false;currentProfile={};
        renderAccountState();
        lockAppToLogin();
      }
    });
    return true;
  }catch(e){
    console.error(e);firebaseCtx=null;
    setFirebaseStatus('Không kết nối được Firebase: '+friendlyFirebaseError(e),'err');
    return false;
  }
}
function friendlyFirebaseError(e){
  const code=e?.code||'';
  const map={
    'auth/invalid-credential':'Sai email hoặc mật khẩu.',
    'auth/invalid-email':'Email không hợp lệ.',
    'auth/email-already-in-use':'Email này đã có tài khoản.',
    'auth/weak-password':'Mật khẩu quá yếu.',
    'auth/network-request-failed':'Không kết nối được mạng.',
    'auth/too-many-requests':'Thử đăng nhập quá nhiều lần. Hãy chờ một lúc.'
  };
  return map[code]||e?.message||String(e||'Lỗi không xác định');
}
function setFirebaseStatus(msg,type='warn'){const el=$('#firebaseStatus');if(el){el.textContent=msg;el.className='firebaseStatus '+type}}
function renderAccountState(){
  const name=currentProfile?.name||currentUser?.email||'Chưa đăng nhập';
  if($('#headerAccountText'))$('#headerAccountText').textContent=currentUser?name:'Chưa đăng nhập';
  if($('#headerAccountDot'))$('#headerAccountDot').className='accountDot '+(currentUser?'online':'warn');
  if($('#headerLogoutBtn'))$('#headerLogoutBtn').style.display=currentUser?'inline-block':'none';
  if($('#scopeBanner'))$('#scopeBanner').innerHTML=currentUser
    ?`Đang sử dụng tài khoản: <b>${esc(name)}</b>${currentIsAdmin?' <span class="adminBadge">ADMIN</span>':''}`
    :'Chưa đăng nhập.';
  if($('#accountEmailText'))$('#accountEmailText').textContent=currentUser?.email||currentProfile?.email||'—';
  if($('#accountNameText'))$('#accountNameText').textContent=currentProfile?.name||'—';
  if($('#accountCodeText'))$('#accountCodeText').textContent=currentProfile?.code||'—';
  if($('#accountRoleText'))$('#accountRoleText').textContent=currentIsAdmin?'Super Admin':'Giáo viên';
  if($('#importLegacyToTeacher'))$('#importLegacyToTeacher').disabled=!currentUser;
  if($('#syncCloudNow'))$('#syncCloudNow').disabled=!currentUser||!firebaseCtx;
  if($('#adminTabBtn'))$('#adminTabBtn').style.display=currentIsAdmin?'inline-block':'none';
  const chip=$('#headerAccountText');
  if(chip&&currentIsAdmin)chip.innerHTML=`${esc(name)} <span class="adminBadge">ADMIN</span>`;
  fillProfileForm();
}
function collectProfileForm(){
  return{
    name:$('#profileName').value.trim(),code:$('#profileCode').value.trim(),school:$('#profileSchool').value.trim(),
    department:$('#profileDepartment').value.trim(),subject:$('#profileSubject').value,classes:$('#profileClasses').value.trim(),
    cutMode:$('#profileCutMode').value,examinerCount:+$('#profileExaminer').value||1,imageMode:$('#profileImageMode').value,
    retention:+$('#profileRetention').value||0,email:currentUser?.email||currentProfile?.email||''
  };
}
function fillProfileForm(){
  const p=currentProfile||{},vals={
    profileName:p.name||'',profileCode:p.code||'',profileSchool:p.school||'',profileDepartment:p.department||'',
    profileSubject:p.subject||'Toán',profileClasses:p.classes||'',profileCutMode:p.cutMode||'normal',
    profileExaminer:String(p.examinerCount||1),profileImageMode:p.imageMode||getImageMode(),
    profileRetention:String(Number.isFinite(+p.retention)?+p.retention:getImageRetention())
  };
  Object.entries(vals).forEach(([id,v])=>{const el=$('#'+id);if(el)el.value=String(v)});
}
function applyProfileDefaults(){
  const p=currentProfile||{};
  if(p.school)$('#schoolName').value=p.school;
  if(p.subject)$('#subject').value=p.subject;
  if(p.cutMode)$('#cutMode').value=p.cutMode;
  if(p.examinerCount)$('#examinerCount').value=String(p.examinerCount);
  if(p.imageMode){setScoped(LS_IMG_MODE,p.imageMode);if($('#imageSaveMode'))$('#imageSaveMode').value=p.imageMode}
  if(Number.isFinite(+p.retention)){setScoped(LS_IMG_RET,String(+p.retention));if($('#imageRetention'))$('#imageRetention').value=String(+p.retention)}
  updateImageStorageInfo();
}
function hasScopedData(sid=scopeId()){return !!(parseJson(localStorage.getItem(nsKey(LS_TPL,sid))||'[]',[])||[]).length}
function loadScopedStateOnly(){
  templates=parseJson(getScoped(LS_TPL,'[]'),[])||[];
  assignments=parseJson(getScoped(LS_ASSIGN,'{}'),{})||{};
  studentRoster=parseJson(getScoped(LS_ROSTER,'[]'),[])||[];
  currentProfile=getLocalProfile();
  if(!templates.length)templates=defaultTemplates();
  templates.forEach(normalizeTemplate);cleanupAssignments();
}
function writeScopedStateLocal(){
  setScoped(LS_TPL,JSON.stringify(templates));setScoped(LS_ASSIGN,JSON.stringify(assignments));setScoped(LS_ROSTER,JSON.stringify(studentRoster));setScoped(LS_PROFILE,JSON.stringify(currentProfile||{}));
}

async function checkAdminRole(uid){
  if(!firebaseCtx||!uid)return false;
  try{
    const s=await firebaseModules.firestore.getDoc(firebaseModules.firestore.doc(firebaseCtx.db,'admins',uid));
    return s.exists();
  }catch(e){console.warn('Không kiểm tra được quyền Admin',e);return false}
}
async function checkAccessRole(uid){
  if(!firebaseCtx||!uid)return false;
  try{
    const s=await firebaseModules.firestore.getDoc(firebaseModules.firestore.doc(firebaseCtx.db,'access',uid));
    return s.exists()&&s.data()?.active===true;
  }catch(e){console.warn('Không kiểm tra được access',e);return false}
}
async function createTeacherProfileDocs(uid,data={}){
  const m=firebaseModules.firestore,now=new Date().toISOString();
  await Promise.all([
    m.setDoc(m.doc(firebaseCtx.db,'teachers',uid),{
      email:data.email||'',name:data.name||'',code:data.code||'',department:data.department||'',
      subject:data.subject||'',school:data.school||'',createdAt:data.createdAt||now,updatedAt:now
    },{merge:true}),
    m.setDoc(m.doc(firebaseCtx.db,'access',uid),{active:true,updatedAt:now,updatedBy:currentUser?.uid||''},{merge:true})
  ]);
}
async function createTeacherAuthByAdmin(){
  if(!currentIsAdmin||!firebaseCtx){alert('Chỉ Super Admin được tạo giáo viên.');return}
  const email=$('#adminCreateEmail').value.trim(),password=$('#adminCreatePassword').value,
        name=$('#adminCreateName').value.trim(),code=$('#adminCreateCode').value.trim(),
        department=$('#adminCreateDepartment').value.trim(),subject=$('#adminCreateSubject').value.trim();
  if(!email||password.length<6){alert('Nhập email và mật khẩu tối thiểu 6 ký tự.');return}
  const btn=$('#adminCreateTeacher');btn.disabled=true;
  try{
    const appName='adminCreator_'+Date.now();
    const secApp=firebaseModules.app.initializeApp(firebaseCtx.config,appName);
    const secAuth=firebaseModules.auth.getAuth(secApp);
    let cred;
    try{cred=await firebaseModules.auth.createUserWithEmailAndPassword(secAuth,email,password)}
    finally{
      try{await firebaseModules.auth.signOut(secAuth)}catch(e){}
      try{await firebaseModules.app.deleteApp(secApp)}catch(e){}
    }
    const uid=cred.user.uid;
    await createTeacherProfileDocs(uid,{email,name,code,department,subject});
    alert(`Đã tạo giáo viên ${email}\nUID: ${uid}`);
    ['adminCreateEmail','adminCreatePassword','adminCreateName','adminCreateCode','adminCreateDepartment','adminCreateSubject'].forEach(id=>$('#'+id).value='');
    await loadAdminDashboard();
  }catch(e){alert('Không tạo được tài khoản: '+friendlyFirebaseError(e))}
  finally{btn.disabled=false}
}
async function activateExistingTeacher(){
  if(!currentIsAdmin)return;
  const uid=$('#adminExistingUid').value.trim(),email=$('#adminExistingEmail').value.trim(),name=$('#adminExistingName').value.trim();
  if(!uid){alert('Cần Firebase UID.');return}
  try{
    await createTeacherProfileDocs(uid,{email,name});
    alert('Đã kích hoạt UID này.');
    await loadAdminDashboard();
  }catch(e){alert('Không kích hoạt được: '+friendlyFirebaseError(e))}
}
async function setTeacherAccess(uid,active){
  if(!currentIsAdmin||uid===currentUser?.uid&&active===false){alert('Không thể tự khóa tài khoản Admin đang đăng nhập.');return}
  const m=firebaseModules.firestore;
  await m.setDoc(m.doc(firebaseCtx.db,'access',uid),{active,updatedAt:new Date().toISOString(),updatedBy:currentUser.uid},{merge:true});
  await loadAdminDashboard();
}
async function setTeacherAdmin(uid,makeAdmin){
  if(!currentIsAdmin)return;
  if(uid===currentUser?.uid&&!makeAdmin){alert('Không thể tự thu quyền Admin của chính mình trong app.');return}
  const m=firebaseModules.firestore,ref=m.doc(firebaseCtx.db,'admins',uid);
  if(makeAdmin)await m.setDoc(ref,{role:'superadmin',createdAt:new Date().toISOString(),createdBy:currentUser.uid},{merge:true});
  else await m.deleteDoc(ref);
  await loadAdminDashboard();
}
async function downloadTeacherBackup(uid){
  if(!currentIsAdmin)return;
  try{
    const m=firebaseModules.firestore;
    const [p,s,a]=await Promise.all([
      m.getDoc(m.doc(firebaseCtx.db,'teachers',uid)),
      m.getDoc(m.doc(firebaseCtx.db,'teachers',uid,'app','state')),
      m.getDoc(m.doc(firebaseCtx.db,'access',uid))
    ]);
    const payload={uid,profile:p.exists()?p.data():null,access:a.exists()?a.data():null,state:s.exists()?s.data():null,exportedAt:new Date().toISOString()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=u;link.download=`OMR_Backup_${safeFilePart(payload.profile?.name||payload.profile?.email||uid)}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
  }catch(e){alert('Không tải được backup: '+friendlyFirebaseError(e))}
}
async function clearTeacherOmrData(uid){
  if(!currentIsAdmin||uid===currentUser?.uid){alert('Không xóa dữ liệu của tài khoản Admin đang sử dụng bằng nút này.');return}
  const t=adminTeacherCache.find(x=>x.uid===uid),name=t?.profile?.name||t?.profile?.email||uid;
  const code=prompt(`Xóa toàn bộ mẫu, đáp án và lịch sử chấm của ${name}?\nNhập XOA để xác nhận:`);
  if(code!=='XOA')return;
  try{
    await firebaseModules.firestore.deleteDoc(firebaseModules.firestore.doc(firebaseCtx.db,'teachers',uid,'app','state'));
    alert('Đã xóa dữ liệu OMR. Hồ sơ và tài khoản đăng nhập vẫn được giữ.');
    await loadAdminDashboard();
  }catch(e){alert('Không xóa được: '+friendlyFirebaseError(e))}
}
function parseAdminState(docData){
  if(!docData)return{};
  if(typeof docData.stateJson==='string'){try{return JSON.parse(docData.stateJson)}catch(e){return{}}}
  return docData;
}

function scoreOnTen(h){
  const s=Number(h?.score),m=Number(h?.max);
  if(!Number.isFinite(s))return null;
  if(Number.isFinite(m)&&m>0)return Math.max(0,Math.min(10,s/m*10));
  return Math.max(0,Math.min(10,s));
}
function aggregateAdminHistory(fieldFn,filterFn=null){
  const mp=new Map();
  adminTeacherCache.forEach(t=>{
    const his=Array.isArray(t.state?.history)?t.state.history:[];
    his.forEach(h=>{
      if(filterFn&&!filterFn(h,t))return;
      const key=String(fieldFn(h,t)||'').trim();
      if(!key)return;
      if(!mp.has(key))mp.set(key,{name:key,count:0,sum:0,scoreCount:0,high:null,low:null});
      const a=mp.get(key);a.count++;
      const sc=scoreOnTen(h);
      if(sc!==null){
        a.sum+=sc;a.scoreCount++;
        a.high=a.high===null?sc:Math.max(a.high,sc);
        a.low=a.low===null?sc:Math.min(a.low,sc);
      }
    });
  });
  return [...mp.values()].map(a=>({...a,avg:a.scoreCount?a.sum/a.scoreCount:null}))
    .sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'vi'));
}
function fmtStatScore(v){return v===null||!Number.isFinite(v)?'—':Number(v).toFixed(2)}
function renderAdminAnalytics(){
  adminSubjectStatsCache=aggregateAdminHistory((h,t)=>h.subject||t.profile?.subject||'Chưa xác định');
  adminClassStatsCache=aggregateAdminHistory(
    h=>h.targetType==='class'?h.target:'',
    h=>h.targetType==='class'&&h.target
  );
  $('#adminSubjectStats').innerHTML=adminSubjectStatsCache.length?adminSubjectStatsCache.map(a=>`<tr><td>${esc(a.name)}</td><td>${a.count}</td><td>${fmtStatScore(a.avg)}</td><td>${fmtStatScore(a.high)}</td><td>${fmtStatScore(a.low)}</td></tr>`).join(''):'<tr><td colspan="5">Chưa có dữ liệu.</td></tr>';
  $('#adminClassStats').innerHTML=adminClassStatsCache.length?adminClassStatsCache.map(a=>`<tr><td>${esc(a.name)}</td><td>${a.count}</td><td>${fmtStatScore(a.avg)}</td><td>${fmtStatScore(a.high)}</td><td>${fmtStatScore(a.low)}</td></tr>`).join(''):'<tr><td colspan="5">Chưa có dữ liệu theo lớp.</td></tr>';
}
async function sendTeacherPasswordReset(uid){
  if(!currentIsAdmin||!firebaseCtx)return;
  const t=adminTeacherCache.find(x=>x.uid===uid),email=t?.profile?.email||'';
  if(!email){alert('Giáo viên này chưa có email trong hồ sơ.');return}
  if(!confirm(`Gửi email đặt lại mật khẩu đến:\n${email}?`))return;
  try{
    await firebaseModules.auth.sendPasswordResetEmail(firebaseCtx.auth,email);
    alert(`Đã yêu cầu Firebase gửi email đặt lại mật khẩu đến ${email}.`);
  }catch(e){alert('Không gửi được email đặt lại mật khẩu: '+friendlyFirebaseError(e))}
}
function getAdminDetailTeacher(){return adminTeacherCache.find(x=>x.uid===adminDetailUid)||null}
function fillAdminDetailFilters(t){
  const his=Array.isArray(t?.state?.history)?t.state.history:[];
  const subjects=[...new Set(his.map(h=>h.subject||t.profile?.subject||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
  const targets=[...new Set(his.map(h=>h.target?(h.targetType==='class'?`Lớp ${h.target}`:`Phòng ${h.target}`):'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
  $('#detailSubjectFilter').innerHTML='<option value="">Tất cả môn</option>'+subjects.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  $('#detailTargetFilter').innerHTML='<option value="">Tất cả</option>'+targets.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
}
function renderAdminDetailHistory(){
  const t=getAdminDetailTeacher();if(!t)return;
  const subject=$('#detailSubjectFilter').value,target=$('#detailTargetFilter').value;
  let his=Array.isArray(t.state?.history)?[...t.state.history]:[];
  if(subject)his=his.filter(h=>(h.subject||t.profile?.subject||'')===subject);
  if(target)his=his.filter(h=>(h.target?(h.targetType==='class'?`Lớp ${h.target}`:`Phòng ${h.target}`):'')===target);
  his.sort((a,b)=>new Date(b.time)-new Date(a.time));
  $('#adminDetailHistoryBody').innerHTML=his.length?his.map(h=>`<tr>
    <td>${esc(fmtHistoryTime(h.time))}</td><td>${esc(h.student||'')}</td>
    <td>${esc(h.target?(h.targetType==='class'?'Lớp ':'Phòng ')+h.target:'')}</td>
    <td>${esc(h.testName||'')}</td><td>${esc(h.subject||t.profile?.subject||'')}</td>
    <td>${esc(h.examCode||'')}</td><td>${esc(h.templateName||'')}</td>
    <td><b>${esc(h.score??'')}/${esc(h.max??'')}</b></td><td>${(h.imageId||h.originalImageId)?'Có':'Không'}</td>
  </tr>`).join(''):'<tr><td colspan="9">Không có lịch sử phù hợp bộ lọc.</td></tr>';
}
function openAdminTeacherDetail(uid){
  if(!currentIsAdmin)return;
  adminDetailUid=uid;const t=getAdminDetailTeacher();if(!t)return;
  const p=t.profile||{},his=Array.isArray(t.state?.history)?t.state.history:[],scores=his.map(scoreOnTen).filter(v=>v!==null);
  $('#adminDetailTitle').textContent=p.name||p.email||'Chi tiết giáo viên';
  $('#adminDetailSub').textContent=`${p.email||''}${p.code?' • '+p.code:''}${p.department?' • '+p.department:''}${p.subject?' • '+p.subject:''}`;
  $('#detailTemplateCount').textContent=t.templateCount;
  $('#detailGradeCount').textContent=his.length;
  $('#detailAverage').textContent=scores.length?(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2):'—';
  $('#detailClassCount').textContent=new Set(his.filter(h=>h.targetType==='class'&&h.target).map(h=>h.target)).size;
  $('#detailImageCount').textContent=his.filter(h=>h.imageId||h.originalImageId).length;
  fillAdminDetailFilters(t);renderAdminDetailHistory();$('#adminTeacherDetail').classList.add('open');
}
function closeAdminTeacherDetail(){adminDetailUid=null;$('#adminTeacherDetail').classList.remove('open')}
function xmlEscape(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function excelXmlSheet(name,rows){
  const body=rows.map(r=>'<Row>'+r.map(v=>`<Cell><Data ss:Type="${typeof v==='number'&&Number.isFinite(v)?'Number':'String'}">${xmlEscape(v)}</Data></Cell>`).join('')+'</Row>').join('');
  return `<Worksheet ss:Name="${xmlEscape(String(name).slice(0,31))}"><Table>${body}</Table></Worksheet>`;
}
function buildExcelFallbackXml(sheets){
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheets.map(s=>excelXmlSheet(s.name,s.rows)).join('')}</Workbook>`;
}
function collectSchoolExportData(){
  const teacherRows=[['UID','Họ tên','Email','Mã GV','Tổ chuyên môn','Môn mặc định','Trạng thái','Quyền','Số mẫu','Lượt chấm']];
  const historyRows=[['Giáo viên','Email','Thời gian','Học sinh','Lớp/Phòng','Loại kiểm tra','Môn','Mã đề','Mẫu','Điểm','Thang điểm','Điểm /10','Ảnh']];
  const templateRows=[['Giáo viên','Email','Tên mẫu','Loại kiểm tra','Môn','Cắt phách','TN','Đ/S','TLN','Thang điểm','Số mã đề']];
  const answerRows=[['Giáo viên','Tên mẫu','Mã đề','Đáp án Phần I','Đáp án Phần II','Đáp án Phần III']];
  adminTeacherCache.forEach(t=>{
    const p=t.profile||{},s=t.state||{},his=Array.isArray(s.history)?s.history:[],tpls=Array.isArray(s.templates)?s.templates:[];
    teacherRows.push([t.uid,p.name||'',p.email||'',p.code||'',p.department||'',p.subject||'',t.active?'Hoạt động':'Đã khóa',t.isAdmin?'ADMIN':'Giáo viên',tpls.length,his.length]);
    his.forEach(h=>historyRows.push([
      p.name||'',p.email||'',fmtHistoryTime(h.time),h.student||'',
      h.target?(h.targetType==='class'?`Lớp ${h.target}`:`Phòng ${h.target}`):'',
      h.testName||'',h.subject||p.subject||'',h.examCode||'',h.templateName||'',
      Number.isFinite(+h.score)?+h.score:'',Number.isFinite(+h.max)?+h.max:'',scoreOnTen(h)??'',(h.imageId||h.originalImageId)?'Có':'Không'
    ]));
    tpls.forEach(tp=>{
      templateRows.push([p.name||'',p.email||'',tp.name||'',tp.testName||'',tp.subject||'',tp.cut||'normal',
        tp.mcCount||0,tp.tfCount||0,tp.shortCount||0,tp.maxScore||10,Array.isArray(tp.versions)?tp.versions.length:0]);
      (Array.isArray(tp.versions)?tp.versions:[]).forEach(v=>answerRows.push([
        p.name||'',tp.name||'',v.code||'',Array.isArray(v.mcKey)?v.mcKey.join(', '):'',
        JSON.stringify(v.tfKey||[]),Array.isArray(v.shortKey)?v.shortKey.join(' | '):''
      ]));
    });
  });
  const subjectRows=[['Môn','Lượt chấm','Điểm TB /10','Cao nhất','Thấp nhất'],...adminSubjectStatsCache.map(a=>[a.name,a.count,a.avg??'',a.high??'',a.low??''])];
  const classRows=[['Lớp','Lượt chấm','Điểm TB /10','Cao nhất','Thấp nhất'],...adminClassStatsCache.map(a=>[a.name,a.count,a.avg??'',a.high??'',a.low??''])];
  const summaryRows=[
    ['BÁO CÁO OMR TOÀN TRƯỜNG',''],['Xuất lúc',new Date().toLocaleString('vi-VN')],
    ['Số giáo viên',adminTeacherCache.length],['Tài khoản hoạt động',adminTeacherCache.filter(x=>x.active).length],
    ['Tổng mẫu phiếu',adminTeacherCache.reduce((n,x)=>n+x.templateCount,0)],
    ['Tổng lượt chấm',adminTeacherCache.reduce((n,x)=>n+x.gradeCount,0)]
  ];
  return[
    {name:'Tong quan',rows:summaryRows},{name:'Giao vien',rows:teacherRows},{name:'Lich su cham',rows:historyRows},
    {name:'Mau phieu',rows:templateRows},{name:'Ma de & dap an',rows:answerRows},
    {name:'Thong ke mon',rows:subjectRows},{name:'Thong ke lop',rows:classRows}
  ];
}
async function loadSheetJs(){
  if(window.XLSX)return window.XLSX;
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload=()=>resolve(window.XLSX);s.onerror=()=>reject(new Error('Không tải được thư viện Excel'));
    document.head.appendChild(s);
  });
}
async function exportSchoolExcel(){
  if(!currentIsAdmin)return;
  const status=$('#adminExportStatus');status.textContent='Đang tạo Excel toàn trường…';
  const sheets=collectSchoolExportData();
  try{
    const XLSX=await loadSheetJs(),wb=XLSX.utils.book_new();
    sheets.forEach(s=>{
      const ws=XLSX.utils.aoa_to_sheet(s.rows);
      const widths=(s.rows[0]||[]).map((_,i)=>({wch:Math.min(40,Math.max(10,...s.rows.slice(0,100).map(r=>String(r[i]??'').length+2)))}));
      ws['!cols']=widths;XLSX.utils.book_append_sheet(wb,ws,s.name.slice(0,31));
    });
    XLSX.writeFile(wb,`OMR_Du_lieu_toan_truong_${new Date().toISOString().slice(0,10)}.xlsx`);
    status.textContent='Đã xuất Excel toàn trường (.xlsx).';
  }catch(e){
    console.warn(e);
    const xml=buildExcelFallbackXml(sheets),blob=new Blob([xml],{type:'application/vnd.ms-excel'}),u=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=u;a.download=`OMR_Du_lieu_toan_truong_${new Date().toISOString().slice(0,10)}.xml`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
    status.textContent='Không tải được thư viện XLSX; đã xuất file Excel XML dự phòng.';
  }
}
function adminPdfText(ctx,text,x,y,maxW,font='20px Arial',align='left'){
  ctx.font=font;ctx.textAlign=align;ctx.textBaseline='middle';let t=String(text??'');
  if(ctx.measureText(t).width>maxW){while(t.length>2&&ctx.measureText(t+'…').width>maxW)t=t.slice(0,-1);t+='…'}
  ctx.fillText(t,x,y);
}
async function makeAdminTablePdfPage(title,subtitle,headers,rows,pageNo,totalPages,widths=null){
  const W=1240,H=1754,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#111';
  adminPdfText(x,title,W/2,44,W-100,'700 30px Arial','center');
  adminPdfText(x,subtitle,W/2,82,W-100,'18px Arial','center');
  const left=42,top=125,tableW=W-84,rowH=42;
  const ws=widths&&widths.length===headers.length?widths:Array(headers.length).fill(1/headers.length);
  const norm=ws.reduce((a,b)=>a+b,0),px=ws.map(v=>tableW*v/norm);
  let y=top;
  x.fillStyle='#eef2f7';x.fillRect(left,y,tableW,rowH);x.strokeStyle='#9ca3af';x.lineWidth=1;
  let cx=left;
  headers.forEach((h,i)=>{x.strokeRect(cx,y,px[i],rowH);x.fillStyle='#111';adminPdfText(x,h,cx+6,y+rowH/2,px[i]-12,'700 15px Arial');cx+=px[i]});
  y+=rowH;
  rows.forEach((r,ri)=>{
    cx=left;x.fillStyle=ri%2?'#fafafa':'#fff';x.fillRect(left,y,tableW,rowH);
    r.forEach((v,i)=>{x.strokeStyle='#d1d5db';x.strokeRect(cx,y,px[i],rowH);x.fillStyle='#111';adminPdfText(x,v,cx+5,y+rowH/2,px[i]-10,'14px Arial');cx+=px[i]});
    y+=rowH;
  });
  x.fillStyle='#555';adminPdfText(x,`Trang ${pageNo}/${totalPages}`,W/2,H-25,300,'15px Arial','center');
  const blob=await blobFromCanvas(c,'image/jpeg',.82);return new Uint8Array(await blob.arrayBuffer());
}
function chunkRows(rows,n){const out=[];for(let i=0;i<rows.length;i+=n)out.push(rows.slice(i,i+n));return out}
async function exportSchoolPdf(){
  if(!currentIsAdmin)return;
  const status=$('#adminExportStatus');status.textContent='Đang tạo PDF báo cáo toàn trường…';
  const teachers=adminTeacherCache.map(t=>[
    t.profile?.name||'',t.profile?.department||'',t.profile?.subject||'',t.active?'Hoạt động':'Khóa',
    String(t.templateCount),String(t.gradeCount)
  ]);
  const subjects=adminSubjectStatsCache.map(a=>[a.name,String(a.count),fmtStatScore(a.avg),fmtStatScore(a.high),fmtStatScore(a.low)]);
  const classes=adminClassStatsCache.map(a=>[a.name,String(a.count),fmtStatScore(a.avg),fmtStatScore(a.high),fmtStatScore(a.low)]);
  const histories=[];
  adminTeacherCache.forEach(t=>(t.state?.history||[]).forEach(h=>histories.push([
    t.profile?.name||'',fmtHistoryTime(h.time),h.student||'',
    h.target?(h.targetType==='class'?`Lớp ${h.target}`:`Phòng ${h.target}`):'',
    h.subject||t.profile?.subject||'',`${h.score??''}/${h.max??''}`
  ])));
  histories.sort((a,b)=>String(b[1]).localeCompare(String(a[1])));
  const sections=[
    {title:'DANH SÁCH GIÁO VIÊN',headers:['Giáo viên','Tổ','Môn','Trạng thái','Mẫu','Lượt chấm'],rows:teachers,widths:[2.1,1.5,1.5,1.1,.7,.8],n:30},
    {title:'THỐNG KÊ THEO MÔN',headers:['Môn','Lượt chấm','Điểm TB /10','Cao nhất','Thấp nhất'],rows:subjects,widths:[2.4,1,1.2,1,1],n:30},
    {title:'THỐNG KÊ THEO LỚP',headers:['Lớp','Lượt chấm','Điểm TB /10','Cao nhất','Thấp nhất'],rows:classes,widths:[2,1,1.2,1,1],n:30},
    {title:'LỊCH SỬ CHẤM TOÀN TRƯỜNG',headers:['Giáo viên','Thời gian','Học sinh','Lớp/Phòng','Môn','Điểm'],rows:histories,widths:[1.5,1.25,1.6,1.05,1.35,.7],n:30}
  ];
  const pagePlans=[];
  sections.forEach(s=>{
    const chunks=chunkRows(s.rows.length?s.rows:[['Chưa có dữ liệu']],s.n);
    chunks.forEach((rows,i)=>pagePlans.push({...s,rows,part:i+1,parts:chunks.length}));
  });
  const pages=[],total=pagePlans.length+1;
  try{
    // Cover/summary
    const summaryRows=[
      ['Giáo viên',String(adminTeacherCache.length)],
      ['Tài khoản hoạt động',String(adminTeacherCache.filter(x=>x.active).length)],
      ['Tổng mẫu phiếu',String(adminTeacherCache.reduce((n,x)=>n+x.templateCount,0))],
      ['Tổng lượt chấm',String(adminTeacherCache.reduce((n,x)=>n+x.gradeCount,0))],
      ['Số môn có dữ liệu',String(adminSubjectStatsCache.length)],
      ['Số lớp có dữ liệu',String(adminClassStatsCache.length)]
    ];
    pages.push(await makeAdminTablePdfPage('BÁO CÁO OMR TOÀN TRƯỜNG',`Xuất lúc ${new Date().toLocaleString('vi-VN')}`,['Chỉ tiêu','Giá trị'],summaryRows,1,total,[2.5,1]));
    for(let i=0;i<pagePlans.length;i++){
      const s=pagePlans[i];status.textContent=`Đang tạo PDF ${i+2}/${total}: ${s.title}…`;
      pages.push(await makeAdminTablePdfPage(s.title,`Phần ${s.part}/${s.parts}`,s.headers,s.rows,i+2,total,s.widths));
      await new Promise(r=>setTimeout(r,0));
    }
    const pdf=buildJpegPdf(pages),u=URL.createObjectURL(pdf),a=document.createElement('a');
    a.href=u;a.download=`OMR_Bao_cao_toan_truong_${new Date().toISOString().slice(0,10)}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
    status.textContent=`Đã xuất PDF báo cáo ${pages.length} trang.`;
  }catch(e){console.error(e);status.textContent='Xuất PDF thất bại.';alert('Không xuất được PDF: '+(e?.message||e))}
}

function renderAdminTeacherTable(){
  const q=($('#adminTeacherSearch')?.value||'').trim().toLowerCase();
  const rows=adminTeacherCache.filter(x=>{
    const p=x.profile||{},hay=[p.name,p.email,p.code,p.department,p.subject,x.uid].join(' ').toLowerCase();
    return !q||hay.includes(q);
  });
  $('#adminTeacherBody').innerHTML=rows.map(x=>{
    const p=x.profile||{},role=x.isAdmin?'ADMIN':'Giáo viên',status=x.active?'Hoạt động':'Đã khóa';
    return `<tr>
      <td><b>${esc(p.name||'(chưa đặt tên)')}</b><br><span class="help">${esc(p.email||'')}</span><br><span class="help">${esc(p.code||x.uid)}</span></td>
      <td>${esc(p.department||'')}<br><span class="help">${esc(p.subject||'')}</span></td>
      <td>${x.active?'<span class="cloudBadge">Hoạt động</span>':'<span class="adminBadge">Đã khóa</span>'}</td>
      <td>${x.templateCount}</td><td>${x.gradeCount}</td>
      <td>${x.isAdmin?'<span class="adminBadge">ADMIN</span>':'Giáo viên'}</td>
      <td><div class="adminTableActions">
        <button class="adminDetailBtn" onclick="adminViewDetail('${esc(x.uid)}')">Chi tiết</button>
        <button class="adminResetBtn" onclick="adminResetPassword('${esc(x.uid)}')">Đặt lại MK</button>
        <button class="adminBtnLock" onclick="adminToggleAccess('${esc(x.uid)}',${x.active?'false':'true'})">${x.active?'Khóa':'Mở khóa'}</button>
        <button class="adminBtnRole" onclick="adminToggleRole('${esc(x.uid)}',${x.isAdmin?'false':'true'})">${x.isAdmin?'Thu Admin':'Cấp Admin'}</button>
        <button class="adminBtnBackup" onclick="adminBackup('${esc(x.uid)}')">Backup</button>
        <button class="adminBtnDanger" onclick="adminClearData('${esc(x.uid)}')">Xóa dữ liệu OMR</button>
      </div></td>
    </tr>`;
  }).join('');
}
async function loadAdminDashboard(){
  if(!currentIsAdmin||!firebaseCtx)return;
  const status=$('#adminLoadStatus');if(status)status.textContent='Đang tải dữ liệu toàn hệ thống…';
  try{
    const m=firebaseModules.firestore;
    const [teacherQ,accessQ,adminQ]=await Promise.all([
      m.getDocs(m.collection(firebaseCtx.db,'teachers')),
      m.getDocs(m.collection(firebaseCtx.db,'access')),
      m.getDocs(m.collection(firebaseCtx.db,'admins'))
    ]);
    const accessMap=new Map(accessQ.docs.map(d=>[d.id,d.data()])),adminSet=new Set(adminQ.docs.map(d=>d.id)),list=[];
    for(const d of teacherQ.docs){
      let state={},templateCount=0,gradeCount=0;
      try{
        const s=await m.getDoc(m.doc(firebaseCtx.db,'teachers',d.id,'app','state'));
        state=s.exists()?parseAdminState(s.data()):{};
        templateCount=Array.isArray(state.templates)?state.templates.length:0;
        gradeCount=Array.isArray(state.history)?state.history.length:0;
      }catch(e){}
      list.push({uid:d.id,profile:d.data()||{},active:accessMap.get(d.id)?.active===true,isAdmin:adminSet.has(d.id),templateCount,gradeCount,state});
    }
    adminTeacherCache=list.sort((a,b)=>(a.profile?.name||a.profile?.email||'').localeCompare(b.profile?.name||b.profile?.email||'','vi'));
    $('#adminTeacherCount').textContent=list.length;
    $('#adminActiveCount').textContent=list.filter(x=>x.active).length;
    $('#adminTemplateCount').textContent=list.reduce((n,x)=>n+x.templateCount,0);
    $('#adminGradeCount').textContent=list.reduce((n,x)=>n+x.gradeCount,0);
    if(status)status.textContent=`Đã tải ${list.length} giáo viên lúc ${new Date().toLocaleTimeString('vi-VN')}.`;
    renderAdminTeacherTable();renderAdminAnalytics();
  }catch(e){
    if(status)status.textContent='Không tải được dữ liệu: '+friendlyFirebaseError(e);
  }
}
window.adminToggleAccess=(uid,active)=>setTeacherAccess(uid,active);
window.adminToggleRole=(uid,makeAdmin)=>setTeacherAdmin(uid,makeAdmin);
window.adminBackup=uid=>downloadTeacherBackup(uid);
window.adminClearData=uid=>clearTeacherOmrData(uid);
window.adminViewDetail=uid=>openAdminTeacherDetail(uid);
window.adminResetPassword=uid=>sendTeacherPasswordReset(uid);

function lockAppToLogin(message=''){
  if($('#appShell'))$('#appShell').style.display='none';
  if($('#authGate'))$('#authGate').classList.add('open');
  if($('#gateStatus'))$('#gateStatus').textContent=message;
  if($('#gatePassword'))$('#gatePassword').value='';
}
function unlockAppAfterLogin(){
  if($('#authGate'))$('#authGate').classList.remove('open');
  if($('#appShell'))$('#appShell').style.display='block';
}
async function logoutToLogin(){
  if(typeof stopLiveCamera==='function')stopLiveCamera(true);
  lockAppToLogin('Đã đăng xuất.');
  currentUser=null;currentIsAdmin=false;currentProfile={};
  renderAccountState();
  try{if(firebaseCtx?.auth)await firebaseModules.auth.signOut(firebaseCtx.auth)}catch(e){console.warn(e)}
}
async function selfPasswordReset(){
  const email=currentUser?.email;
  if(!email||!firebaseCtx){alert('Không xác định được email tài khoản.');return}
  if(!confirm(`Gửi email đổi mật khẩu đến ${email}?`))return;
  try{await firebaseModules.auth.sendPasswordResetEmail(firebaseCtx.auth,email);alert('Firebase đã gửi email đổi mật khẩu. Hãy kiểm tra hộp thư.')}catch(e){alert(friendlyFirebaseError(e))}
}

async function activateTeacher(user){
  currentUser=user;deviceModeForced=false;cloudLoading=true;
  currentIsAdmin=await checkAdminRole(user.uid);
  if(!currentIsAdmin){
    const allowed=await checkAccessRole(user.uid);
    if(!allowed){
      cloudLoading=false;currentUser=null;currentIsAdmin=false;
      alert('Tài khoản này chưa được Super Admin kích hoạt hoặc đã bị khóa.');
      try{await firebaseModules.auth.signOut(firebaseCtx.auth)}catch(e){}
      lockAppToLogin('Tài khoản chưa được Super Admin kích hoạt hoặc đã bị khóa.');return;
    }
  }
  setFirebaseStatus(currentIsAdmin?`SUPER ADMIN: ${user.email||user.uid}`:`Đã đăng nhập: ${user.email||user.uid}`,'ok');
  const localHad=hasScopedData(user.uid);
  loadScopedStateOnly();
  try{
    const m=firebaseModules.firestore;
    const [profileSnap,stateSnap]=await Promise.all([
      m.getDoc(m.doc(firebaseCtx.db,'teachers',user.uid)),
      m.getDoc(m.doc(firebaseCtx.db,'teachers',user.uid,'app','state'))
    ]);
    if(profileSnap.exists())currentProfile={...currentProfile,...profileSnap.data()};
    else currentProfile={...currentProfile,email:user.email||''};
    if(stateSnap.exists()){
      const d=stateSnap.data()||{};
      let cloudState=null;
      // v3.59+: Firestore does not support nested arrays, so the complex OMR state
      // is stored as one JSON string and decoded here.
      if(typeof d.stateJson==='string'){
        try{cloudState=JSON.parse(d.stateJson)}catch(e){console.warn('stateJson không hợp lệ',e)}
      }
      // Backward compatibility with any older cloud document that may exist.
      const s=cloudState||d;
      if(Array.isArray(s.templates)&&s.templates.length)templates=s.templates;
      if(s.assignments&&typeof s.assignments==='object')assignments=s.assignments;
      if(Array.isArray(s.roster))studentRoster=s.roster;
      if(Array.isArray(s.history))setScoped(LS_HIS,JSON.stringify(s.history));
      if(s.imageMode)setScoped(LS_IMG_MODE,s.imageMode);
      if(Number.isFinite(+s.imageRetention))setScoped(LS_IMG_RET,String(+s.imageRetention));
    }else if(!localHad){
      templates=defaultTemplates();assignments={};studentRoster=[];setScoped(LS_HIS,'[]');setScoped(LS_ROSTER,'[]');
    }
  }catch(e){
    console.warn('Tải cloud thất bại',e);
    if($('#cloudSyncStatus'))$('#cloudSyncStatus').textContent='Không tải được dữ liệu cloud, đang dùng bản lưu trên thiết bị.';
  }
  templates.forEach(normalizeTemplate);cleanupAssignments();writeScopedStateLocal();cloudLoading=false;
  renderAccountState();applyProfileDefaults();initImageSettings();refreshSelects();fitSheet();renderRosterManager();renderHistory();unlockAppAfterLogin();queueCloudSync();loadSharedAnswerLibrary();if(currentIsAdmin)loadAdminDashboard();
}
function currentCloudState(){
  const payload={
    templates,
    assignments,
    roster:studentRoster,
    history:getHistory(),
    imageMode:getImageMode(),
    imageRetention:getImageRetention(),
    updatedAt:new Date().toISOString(),
    appVersion:'4.21'
  };
  const stateJson=JSON.stringify(payload);
  // Firestore rejects nested arrays. Saving the OMR payload as JSON preserves
  // every nested answer structure while keeping the Firestore document valid.
  return{
    stateJson,
    stateBytes:new Blob([stateJson]).size,
    updatedAt:payload.updatedAt,
    appVersion:'4.21',
    storageFormat:'json-v1'
  };
}
function queueCloudSync(){
  if(cloudLoading||!currentUser||!firebaseCtx)return;
  clearTimeout(cloudSyncTimer);cloudSyncTimer=setTimeout(()=>syncCloudNow(false),850);
}
async function syncCloudNow(showAlert=false){
  if(!currentUser||!firebaseCtx){if(showAlert)alert('Chưa đăng nhập Firebase.');return false}
  const el=$('#cloudSyncStatus');if(el)el.textContent='Đang đồng bộ Firebase…';
  try{
    const m=firebaseModules.firestore;
    await Promise.all([
      m.setDoc(m.doc(firebaseCtx.db,'teachers',currentUser.uid),sanitizeFirestore({...currentProfile,email:currentUser.email||'',updatedAt:new Date().toISOString()}),{merge:true}),
      m.setDoc(m.doc(firebaseCtx.db,'teachers',currentUser.uid,'app','state'),currentCloudState(),{merge:true})
    ]);
    if(el)el.textContent='Đã đồng bộ Firebase lúc '+new Date().toLocaleTimeString('vi-VN');
    if(showAlert)alert('Đã đồng bộ dữ liệu giáo viên lên Firebase.');return true;
  }catch(e){
    let msg=friendlyFirebaseError(e);
    if(String(e?.message||'').toLowerCase().includes('nested arrays')){
      msg='Dữ liệu có mảng lồng nhau. Hãy dùng bản v3.59 trở lên.';
    }
    if(String(e?.message||'').toLowerCase().includes('maximum size')||String(e?.message||'').includes('1048576')){
      msg='Dữ liệu đồng bộ đã quá lớn cho một tài liệu Firestore. Cần chuyển lịch sử sang kho riêng.';
    }
    if(el)el.textContent='Đồng bộ thất bại: '+msg;
    if(showAlert)alert('Không đồng bộ được: '+msg);return false;
  }
}
async function uploadCloudImage(imageId,blob){
  if(!currentUser||!firebaseCtx||!blob)return null;
  const ext=(blob.type||'').includes('png')?'png':((blob.type||'').includes('webp')?'webp':'jpg'),path=`teachers/${currentUser.uid}/grade-images/${imageId}.${ext}`;
  try{
    await firebaseModules.storage.uploadBytes(firebaseModules.storage.ref(firebaseCtx.storage,path),blob,{contentType:blob.type||'image/jpeg'});return path;
  }catch(e){console.warn('Upload ảnh Firebase Storage thất bại',e);return null}
}
async function deleteCloudImage(path){
  if(!path||!firebaseCtx||!currentUser)return;
  try{await firebaseModules.storage.deleteObject(firebaseModules.storage.ref(firebaseCtx.storage,path))}catch(e){console.warn('Xóa ảnh cloud thất bại',e)}
}
async function importLegacyDataToCurrentTeacher(){
  if(!currentUser){alert('Hãy đăng nhập giáo viên trước.');return}
  const legacyTpl=parseJson(localStorage.getItem(LS_TPL)||'[]',[]),legacyAss=parseJson(localStorage.getItem(LS_ASSIGN)||'{}',{}),legacyHis=parseJson(localStorage.getItem(LS_HIS)||'[]',[]);
  if(!legacyTpl.length&&!legacyHis.length&&!Object.keys(legacyAss||{}).length){alert('Không tìm thấy dữ liệu cũ của các bản trước trên thiết bị này.');return}
  if(!confirm(`Nhập ${legacyTpl.length} mẫu và ${legacyHis.length} kết quả cũ vào tài khoản ${currentUser.email||''}?`))return;
  const existingIds=new Set(templates.map(t=>t.id));
  legacyTpl.forEach(t=>{if(!existingIds.has(t.id)){templates.push(t);existingIds.add(t.id)}});
  assignments={...legacyAss,...assignments};
  const his=getHistory(),hisIds=new Set(his.map(h=>h.id||`${h.time}|${h.examCode}|${h.student}`));
  legacyHis.forEach(h=>{const k=h.id||`${h.time}|${h.examCode}|${h.student}`;if(!hisIds.has(k)){his.push(h);hisIds.add(k)}});
  his.sort((a,b)=>new Date(b.time)-new Date(a.time));saveHistory(his);saveAll();saveAssignmentsData();refreshSelects();await syncCloudNow(false);alert('Đã nhập dữ liệu cũ vào tài khoản giáo viên.');
}
function switchToDeviceMode(){
  if(firebaseCtx?.auth?.currentUser)firebaseModules.auth.signOut(firebaseCtx.auth).catch(()=>{});
  currentUser=null;currentIsAdmin=false;deviceModeForced=true;loadScopedStateOnly();renderAccountState();initImageSettings();refreshSelects();fitSheet();$('#authGate').classList.remove('open');
}

function openImageDb(){
  if(imageDbPromise)return imageDbPromise;
  imageDbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(new Error('Trình duyệt không hỗ trợ IndexedDB.'));return}
    const req=indexedDB.open(IMG_DB,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(IMG_STORE)){
        const st=db.createObjectStore(IMG_STORE,{keyPath:'id'});
        st.createIndex('createdAt','createdAt',{unique:false});
        st.createIndex('resultId','resultId',{unique:false});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Không mở được kho ảnh.'));
  });
  return imageDbPromise;
}
async function putGradeImage(rec){
  rec={...rec,ownerUid:rec.ownerUid||scopeId()};
  const db=await openImageDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(IMG_STORE,'readwrite');
    tx.objectStore(IMG_STORE).put(rec);
    tx.oncomplete=()=>resolve(rec.id);
    tx.onerror=()=>reject(tx.error||new Error('Không lưu được ảnh.'));
  });
}
async function getGradeImageLocal(id){
  if(!id)return null;
  const db=await openImageDb();
  return new Promise((resolve,reject)=>{
    const req=db.transaction(IMG_STORE,'readonly').objectStore(IMG_STORE).get(id);
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error);
  });
}
async function getGradeImage(id){
  if(!id)return null;
  let rec=await getGradeImageLocal(id);
  if(rec&&(rec.ownerUid===scopeId()||(!rec.ownerUid&&scopeId()==='device')))return rec;
  const h=getHistory().find(x=>x.imageId===id||x.originalImageId===id);
  const cloudPath=h?(h.originalImageId===id?h.originalImageCloudPath:h.imageCloudPath):null;
  if(cloudPath&&firebaseCtx&&currentUser){
    try{
      const blob=await firebaseModules.storage.getBlob(firebaseModules.storage.ref(firebaseCtx.storage,cloudPath));
      rec={id,resultId:h.id,createdAt:h.time,blob,mime:blob.type||'image/jpeg',ownerUid:scopeId(),cloudPath};
      await putGradeImage(rec);
      return rec;
    }catch(e){console.warn('Không tải được ảnh cloud',e)}
  }
  return null;
}
async function deleteGradeImage(id){
  if(!id)return;
  const db=await openImageDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(IMG_STORE,'readwrite');
    tx.objectStore(IMG_STORE).delete(id);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}
async function getAllGradeImages(){
  const db=await openImageDb();
  return new Promise((resolve,reject)=>{
    const req=db.transaction(IMG_STORE,'readonly').objectStore(IMG_STORE).getAll();
    req.onsuccess=()=>resolve(req.result||[]);
    req.onerror=()=>reject(req.error);
  });
}
function getHistory(){return parseJson(getScoped(LS_HIS,'[]'),[])||[]}
function saveHistory(his){setScoped(LS_HIS,JSON.stringify(his));queueCloudSync()}
function getImageMode(){return getScoped(LS_IMG_MODE,'compressed')||'compressed'}
function getImageRetention(){const n=Number(getScoped(LS_IMG_RET,'30'));return [0,7,30,90].includes(n)?n:30}
function safeFilePart(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60)||'OMR'}
function blobFromCanvas(c,type='image/jpeg',quality=.78){return new Promise(resolve=>c.toBlob(resolve,type,quality))}
function clearPendingGradeImage(){pendingGradeImage=null;pendingGradeAnnotation=null;pendingAnnotatedGradeImage=null}
async function packPendingGradeImage(mode){
  if(!pendingGradeImage)return null;
  if(mode==='original'&&pendingGradeImage.originalBlob){
    return{blob:pendingGradeImage.originalBlob,mime:pendingGradeImage.originalBlob.type||pendingGradeImage.mime||'image/jpeg',originalName:pendingGradeImage.originalName||'camera_live.jpg'};
  }
  const src=pendingGradeImage.source;
  if(!src)return null;
  const iw=src.videoWidth||src.naturalWidth||src.width,ih=src.videoHeight||src.naturalHeight||src.height;
  if(!iw||!ih)return null;
  const maxSide=1800,sc=Math.min(1,maxSide/Math.max(iw,ih)),c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(iw*sc));c.height=Math.max(1,Math.round(ih*sc));
  const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(src,0,0,c.width,c.height);
  let blob=await blobFromCanvas(c,'image/jpeg',.82);if(!blob)blob=await blobFromCanvas(c,'image/png',1);
  if(!blob)throw new Error('Không tạo được ảnh lưu từ khung hình đã chấm.');
  return{blob,mime:blob.type||'image/jpeg',originalName:pendingGradeImage.originalName||'anh_bai_lam.jpg'};
}
async function makeStoredImage(mode){
  if(mode==='none')return null;
  const pending=await packPendingGradeImage(mode);if(pending)return pending;
  if(!imgState||!imgState.img)return null;
  if(mode==='original'&&imgState.file){
    return{blob:imgState.file,mime:imgState.file.type||'image/jpeg',originalName:imgState.file.name||'anh_bai_lam'};
  }
  if(mode==='original'&&imgState.liveBlob){
    return{blob:imgState.liveBlob,mime:imgState.liveBlob.type||'image/jpeg',originalName:'camera_live.jpg'};
  }
  const img=imgState.img,maxSide=1800,iw=img.videoWidth||img.naturalWidth||img.width,ih=img.videoHeight||img.naturalHeight||img.height,sc=Math.min(1,maxSide/Math.max(iw,ih));
  const c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(iw*sc));
  c.height=Math.max(1,Math.round(ih*sc));
  const x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);
  let blob=await blobFromCanvas(c,'image/jpeg',.78);
  if(!blob)blob=await blobFromCanvas(c,'image/png',1);
  if(!blob)throw new Error('Không tạo được ảnh nén.');
  return{blob,mime:blob.type||'image/jpeg',originalName:'anh_bai_lam.jpg'};
}

function drawStoredGradeRing(g,pt,color){
  if(!pt||!H)return;
  const p=mapSheet(pt.x,pt.y),r=Math.max(6,5.9*Math.max(.60,scaleAt(pt.x,pt.y)));
  g.save();g.strokeStyle=color;g.lineWidth=Math.max(3.2,r*.30);g.beginPath();g.arc(p.x,p.y,r,0,Math.PI*2);g.stroke();g.restore();
}
async function makeAnnotatedGradeImage(){
  if(!imgState?.img||!pendingGradeAnnotation||!H)return null;
  const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;
  const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(imgState.img,0,0,c.width,c.height);
  const GREEN='#00d26a',RED='#ff3040',YELLOW='#ffd400',ann=pendingGradeAnnotation;
  for(const x of ann.mc||[]){const q=x.layout;if(!q)continue;if(x.ok&&x.selected?.length===1)drawStoredGradeRing(g,q.opts[x.selected[0]],GREEN);else{for(const i of x.selected||[])if(q.opts[i])drawStoredGradeRing(g,q.opts[i],RED);if(x.keyIdx>=0&&q.opts[x.keyIdx])drawStoredGradeRing(g,q.opts[x.keyIdx],YELLOW)}}
  for(const q of ann.tf||[])for(const x of q.det||[]){if(x.ok&&x.selected?.length===1)drawStoredGradeRing(g,x.points[x.selected[0]],GREEN);else{for(const i of x.selected||[])if(x.points?.[i])drawStoredGradeRing(g,x.points[i],RED);if(x.keyIdx>=0&&x.points?.[x.keyIdx])drawStoredGradeRing(g,x.points[x.keyIdx],YELLOW)}}
  for(const x of ann.sh||[]){const detected=[];if(x.signDark&&x.layout?.sign)detected.push(x.layout.sign);for(const i of x.commaSelected||[])if(x.layout?.commas?.[i])detected.push(x.layout.commas[i]);for(const d of x.digitSel||[])for(const i of d.selected||[])if(d.points?.[i])detected.push(d.points[i]);if(x.ok)detected.forEach(p=>drawStoredGradeRing(g,p,GREEN));else{detected.forEach(p=>drawStoredGradeRing(g,p,RED));for(const p of x.keyMarks||[])drawStoredGradeRing(g,p,YELLOW)}}
  const maxSide=2200,sc=Math.min(1,maxSide/Math.max(c.width,c.height));let out=c;
  if(sc<1){out=document.createElement('canvas');out.width=Math.max(1,Math.round(c.width*sc));out.height=Math.max(1,Math.round(c.height*sc));const ox=out.getContext('2d');ox.fillStyle='#fff';ox.fillRect(0,0,out.width,out.height);ox.drawImage(c,0,0,out.width,out.height)}
  let blob=await blobFromCanvas(out,'image/jpeg',.90);if(!blob)blob=await blobFromCanvas(out,'image/png',1);if(!blob)throw new Error('Không tạo được ảnh đã chấm màu.');
  return{blob,mime:blob.type||'image/jpeg',originalName:'anh_da_cham_mau.jpg'};
}
function historyImageFileName(h,rec){
  const target=h?.target?(h.targetType==='class'?`Lop_${h.target.replace('/','-')}`:`Phong_${h.target}`):'Khong_xac_dinh';
  const student=safeFilePart(h?.student||'Hoc_sinh');
  const code=safeFilePart(h?.examCode||'Ma_de');
  const score=String(h?.score??'').replace('.','_');
  const ext=(rec?.mime||'image/jpeg').includes('png')?'png':((rec?.mime||'').includes('webp')?'webp':'jpg');
  return `${safeFilePart(target)}_${student}_${code}_Diem_${score}.${ext}`;
}

function pdfGroupKey(h){
  return [h?.targetType||'',h?.target||'',h?.testName||'',h?.subject||'',h?.templateId||h?.templateName||''].join('||');
}
function pdfGroupLabel(h,count=0){
  const target=h?.target?(h.targetType==='class'?`Lớp ${h.target}`:`Phòng ${h.target}`):'Chưa xác định lớp/phòng';
  const parts=[target,h?.testName||'',h?.subject||'',h?.templateName||''].filter(Boolean);
  return `${parts.join(' • ')}${count?` • ${count} ảnh`:''}`;
}
function getPdfImageGroups(){
  const map=new Map();
  getHistory().filter(h=>h.imageId&&h.target).forEach(h=>{
    const key=pdfGroupKey(h);
    if(!map.has(key))map.set(key,{key,seed:h,items:[]});
    map.get(key).items.push(h);
  });
  return [...map.values()].sort((a,b)=>{
    const at=a.seed?.targetType==='class'?0:1,bt=b.seed?.targetType==='class'?0:1;
    if(at!==bt)return at-bt;
    const av=String(a.seed?.target||''),bv=String(b.seed?.target||'');
    const [ag,an]=av.split('/').map(Number),[bg,bn]=bv.split('/').map(Number);
    if(Number.isFinite(ag)&&Number.isFinite(bg)&&ag!==bg)return ag-bg;
    if(Number.isFinite(an)&&Number.isFinite(bn)&&an!==bn)return an-bn;
    return pdfGroupLabel(a.seed).localeCompare(pdfGroupLabel(b.seed),'vi');
  });
}
function refreshPdfGroupOptions(){
  const s=$('#pdfGroupSelect'),status=$('#pdfExportStatus'),btn=$('#exportGroupPdf');
  if(!s||!status||!btn)return;
  const groups=getPdfImageGroups(),old=s.value;
  s.innerHTML=groups.map(g=>`<option value="${esc(g.key)}">${esc(pdfGroupLabel(g.seed,g.items.length))}</option>`).join('');
  if(groups.some(g=>g.key===old))s.value=old;
  btn.disabled=!groups.length;
  if(!groups.length)status.textContent='Chưa có ảnh bài đã chấm có thông tin lớp/phòng để xuất PDF.';
  else{
    const g=groups.find(x=>x.key===s.value)||groups[0];
    if(g){s.value=g.key;status.textContent=`Nhóm đang chọn có ${g.items.length} ảnh đã lưu.`}
  }
}
function loadBlobImage(blob){
  return new Promise((resolve,reject)=>{
    const u=URL.createObjectURL(blob),img=new Image();
    img.onload=()=>resolve({img,url:u});
    img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('Không đọc được ảnh đã lưu.'))};
    img.src=u;
  });
}
function fitCanvasText(ctx,text,maxWidth,startSize=30,minSize=16,weight='700'){
  let size=startSize;
  while(size>minSize){
    ctx.font=`${weight} ${size}px Arial, sans-serif`;
    if(ctx.measureText(text).width<=maxWidth)break;
    size-=1;
  }
  if(ctx.measureText(text).width>maxWidth){
    let t=String(text);
    while(t.length>3&&ctx.measureText(t+'…').width>maxWidth)t=t.slice(0,-1);
    return{size,text:t+'…'};
  }
  return{size,text:String(text)};
}
function fmtHistoryTime(iso){
  try{return new Date(iso).toLocaleString('vi-VN')}catch(e){return String(iso||'')}
}
async function makePdfPageJpeg(h,rec,pageNo,totalPages){
  const W=1240,H=1754,c=document.createElement('canvas');c.width=W;c.height=H;
  const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);
  x.fillStyle='#111';x.textAlign='center';x.textBaseline='middle';

  const target=h.target?(h.targetType==='class'?`LỚP ${h.target}`:`PHÒNG ${h.target}`):'BÀI ĐÃ CHẤM';
  const title=[target,h.testName||'',h.subject||''].filter(Boolean).join(' - ');
  let fit=fitCanvasText(x,title,W-100,30,20,'700');x.font=`700 ${fit.size}px Arial, sans-serif`;x.fillText(fit.text,W/2,38);

  x.textAlign='left';
  const student=h.student||'(chưa nhập họ tên)',line1=`Học sinh: ${student}    |    Mã đề: ${h.examCode||'--'}    |    Điểm: ${h.score??'--'}/${h.max??'--'}`;
  fit=fitCanvasText(x,line1,W-100,23,16,'600');x.font=`600 ${fit.size}px Arial, sans-serif`;x.fillText(fit.text,50,78);

  const line2=`Mẫu: ${h.templateName||''}    |    Chấm lúc: ${fmtHistoryTime(h.time)}`;
  fit=fitCanvasText(x,line2,W-100,19,14,'400');x.font=`400 ${fit.size}px Arial, sans-serif`;x.fillText(fit.text,50,108);

  x.strokeStyle='#888';x.lineWidth=1;x.beginPath();x.moveTo(50,132);x.lineTo(W-50,132);x.stroke();

  const loaded=await loadBlobImage(rec.blob);
  try{
    const img=loaded.img,areaX=40,areaY=150,areaW=W-80,areaH=H-205;
    const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,sc=Math.min(areaW/iw,areaH/ih);
    const dw=Math.round(iw*sc),dh=Math.round(ih*sc),dx=Math.round(areaX+(areaW-dw)/2),dy=Math.round(areaY+(areaH-dh)/2);
    x.drawImage(img,dx,dy,dw,dh);
  }finally{URL.revokeObjectURL(loaded.url)}

  x.textAlign='center';x.fillStyle='#555';x.font='15px Arial, sans-serif';x.fillText(`Trang ${pageNo}/${totalPages}`,W/2,H-20);
  const blob=await blobFromCanvas(c,'image/jpeg',.84);
  if(!blob)throw new Error('Không tạo được trang PDF.');
  return new Uint8Array(await blob.arrayBuffer());
}
function asciiBytes(s){return new TextEncoder().encode(s)}
function concatByteArrays(parts){
  const len=parts.reduce((n,a)=>n+a.length,0),out=new Uint8Array(len);let off=0;
  parts.forEach(a=>{out.set(a,off);off+=a.length});return out;
}
function buildJpegPdf(jpegs,widthPx=1240,heightPx=1754){
  const pageW=595.28,pageH=841.89,objects=[],kids=[];
  const pageCount=jpegs.length;
  objects[1]=asciiBytes('<< /Type /Catalog /Pages 2 0 R >>');
  for(let i=0;i<pageCount;i++){
    const pageObj=3+i*3,imgObj=4+i*3,contentObj=5+i*3;
    kids.push(`${pageObj} 0 R`);
    const imageName=`Im${i+1}`;
    objects[pageObj]=asciiBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /${imageName} ${imgObj} 0 R >> >> /Contents ${contentObj} 0 R >>`);
    const jpg=jpegs[i],imgHead=asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
    objects[imgObj]=concatByteArrays([imgHead,jpg,asciiBytes('\nendstream')]);
    const content=asciiBytes(`q\n${pageW} 0 0 ${pageH} 0 0 cm\n/${imageName} Do\nQ\n`);
    objects[contentObj]=concatByteArrays([asciiBytes(`<< /Length ${content.length} >>\nstream\n`),content,asciiBytes('endstream')]);
  }
  objects[2]=asciiBytes(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageCount} >>`);

  const maxObj=2+pageCount*3,parts=[asciiBytes('%PDF-1.4\n')],offsets=new Array(maxObj+1).fill(0);let total=parts[0].length;
  for(let n=1;n<=maxObj;n++){
    offsets[n]=total;
    const obj=concatByteArrays([asciiBytes(`${n} 0 obj\n`),objects[n],asciiBytes('\nendobj\n')]);
    parts.push(obj);total+=obj.length;
  }
  const xrefOffset=total;
  let xref=`xref\n0 ${maxObj+1}\n0000000000 65535 f \n`;
  for(let n=1;n<=maxObj;n++)xref+=String(offsets[n]).padStart(10,'0')+' 00000 n \n';
  xref+=`trailer\n<< /Size ${maxObj+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(asciiBytes(xref));
  return new Blob([concatByteArrays(parts)],{type:'application/pdf'});
}
function pdfGroupFileName(g){
  const h=g.seed,target=h.targetType==='class'?`Lop_${String(h.target).replace('/','-')}`:`Phong_${h.target}`;
  return `Anh_bai_cham_${safeFilePart(target)}_${safeFilePart(h.testName||'Kiem_tra')}_${safeFilePart(h.subject||'Mon')}.pdf`;
}
async function exportSelectedGroupPdf(){
  const btn=$('#exportGroupPdf'),status=$('#pdfExportStatus'),key=$('#pdfGroupSelect').value;
  const g=getPdfImageGroups().find(x=>x.key===key);
  if(!g){alert('Chưa có nhóm ảnh để xuất.');return}
  let items=[...g.items];
  if($('#pdfSort').value==='name')items.sort((a,b)=>(a.student||'').localeCompare(b.student||'','vi')||new Date(a.time)-new Date(b.time));
  else items.sort((a,b)=>new Date(a.time)-new Date(b.time));
  if(items.length>60&&!confirm(`Nhóm này có ${items.length} ảnh. PDF có thể khá lớn. Tiếp tục xuất?`))return;

  btn.disabled=true;status.textContent=`Đang chuẩn bị PDF 0/${items.length}...`;
  const pages=[];let skipped=0;
  try{
    for(let i=0;i<items.length;i++){
      const h=items[i];status.textContent=`Đang xử lý ảnh ${i+1}/${items.length}: ${h.student||'Học sinh'}...`;
      const rec=await getGradeImage(h.imageId);
      if(!rec||!rec.blob){skipped++;continue}
      try{pages.push(await makePdfPageJpeg(h,rec,pages.length+1,items.length-skipped))}
      catch(e){console.warn('Skip PDF image',e);skipped++}
      await new Promise(r=>setTimeout(r,0));
    }
    if(!pages.length)throw new Error('Không còn ảnh hợp lệ trong nhóm này.');
    status.textContent=`Đang đóng gói ${pages.length} trang PDF...`;
    const pdf=buildJpegPdf(pages),u=URL.createObjectURL(pdf),a=document.createElement('a');
    a.href=u;a.download=pdfGroupFileName(g);document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),1500);
    status.textContent=`Đã xuất ${pages.length} trang PDF${skipped?`; bỏ qua ${skipped} ảnh lỗi/đã mất`:''}.`;
  }catch(e){
    status.textContent='Xuất PDF thất bại.';
    alert('Không xuất được PDF: '+(e?.message||e));
  }finally{btn.disabled=false}
}
async function applyImageRetention(){
  const days=getImageRetention();
  if(!days)return 0;
  let all=[];
  try{all=await getAllGradeImages()}catch(e){return 0}
  const cutoff=Date.now()-days*86400000,expired=all.filter(x=>(x.ownerUid===scopeId()||(!x.ownerUid&&scopeId()==='device'))&&new Date(x.createdAt||0).getTime()<cutoff);
  if(!expired.length)return 0;
  for(const rec of expired){
    try{await deleteGradeImage(rec.id)}catch(e){}
    const hh=getHistory().find(x=>x.imageId===rec.id||x.originalImageId===rec.id);
    const cp=hh?(hh.originalImageId===rec.id?hh.originalImageCloudPath:hh.imageCloudPath):null;
    if(cp){try{await deleteCloudImage(cp)}catch(e){}}
  }
  const dead=new Set(expired.map(x=>x.id)),his=getHistory();let changed=false;
  his.forEach(h=>{if(h.imageId&&dead.has(h.imageId)){h.imageId=null;h.imageExpired=true;changed=true}if(h.originalImageId&&dead.has(h.originalImageId)){h.originalImageId=null;h.originalImageExpired=true;changed=true}});
  if(changed)saveHistory(his);
  return expired.length;
}
function updateImageStorageInfo(){
  const mode=$('#imageSaveMode')?.value||getImageMode(),ret=Number($('#imageRetention')?.value??getImageRetention());
  const modeText=mode==='compressed'?'ảnh đã nén':mode==='original'?'ảnh gốc':'không lưu ảnh';
  const retText=ret?` tự xóa sau ${ret} ngày`:' không tự xóa';
  if($('#imageStorageInfo'))$('#imageStorageInfo').textContent=`Đang dùng: ${modeText};${retText}. Mỗi bài lưu song song ảnh gốc và ảnh đã chấm màu; khi đăng nhập Firebase, app sẽ cố gắng đồng bộ cả hai lên Storage để mở ở thiết bị khác.`;
}
function initImageSettings(){
  if(!$('#imageSaveMode'))return;
  $('#imageSaveMode').value=getImageMode();
  $('#imageRetention').value=String(getImageRetention());
  $('#imageSaveMode').onchange=()=>{setScoped(LS_IMG_MODE,$('#imageSaveMode').value);queueCloudSync();updateImageStorageInfo()};
  $('#imageRetention').onchange=async()=>{setScoped(LS_IMG_RET,$('#imageRetention').value);queueCloudSync();updateImageStorageInfo();await applyImageRetention();renderHistory()};
  $('#cleanupImages').onclick=async()=>{const n=await applyImageRetention();renderHistory();alert(n?`Đã xóa ${n} ảnh hết hạn.`:'Không có ảnh hết hạn để xóa.')};
  $('#pdfGroupSelect').onchange=()=>refreshPdfGroupOptions();
  $('#exportGroupPdf').onclick=exportSelectedGroupPdf;
  updateImageStorageInfo();
  refreshPdfGroupOptions();
}
function loadAssignments(){assignments=parseJson(getScoped(LS_ASSIGN,'{}'),{})||{}}
function saveAssignmentsData(){setScoped(LS_ASSIGN,JSON.stringify(assignments));queueCloudSync()}
function isFrequentTest(t){return String(t?.testName||'').toUpperCase()==='KIỂM TRA THƯỜNG XUYÊN'}
function isPeriodicTest(t){return !isFrequentTest(t)}
function showRoomField(t){return isPeriodicTest(t)&&t.periodicMode==='room'}
function targetTypeForTemplate(t){return showRoomField(t)?'room':'class'}
function assignmentContextKey(t){return [String(t?.testName||''),String(t?.subject||''),targetTypeForTemplate(t)].join('||')}
function assignmentKey(t,target){return assignmentContextKey(t)+'||'+String(target)}
function allClassTargets(){const a=[];for(let g=6;g<=9;g++)for(let n=1;n<=10;n++)a.push(`${g}/${n}`);return a}
function allRoomTargets(){return Array.from({length:20},(_,i)=>String(i+1))}
function allTargetsForTemplate(t){return targetTypeForTemplate(t)==='class'?allClassTargets():allRoomTargets()}
function assignedTargetsForTemplate(t){return allTargetsForTemplate(t).filter(x=>assignments[assignmentKey(t,x)]===t.id)}
function cleanupAssignments(){const ids=new Set(templates.map(t=>t.id));let changed=false;Object.keys(assignments).forEach(k=>{if(!ids.has(assignments[k])){delete assignments[k];changed=true}});if(changed)saveAssignmentsData()}
function assignmentContexts(){
  const map=new Map();
  Object.entries(assignments).forEach(([k,templateId])=>{
    const parts=k.split('||');if(parts.length<4)return;
    const [testName,subject,type,target]=parts;
    if(!cur(templateId))return;
    const ck=[testName,subject,type].join('||');
    if(!map.has(ck))map.set(ck,{key:ck,testName,subject,type,targets:[]});
    map.get(ck).targets.push({target,templateId});
  });
  return [...map.values()].sort((a,b)=>(a.testName+a.subject).localeCompare(b.testName+b.subject,'vi'));
}
function assignmentDisplayTarget(type,target){return type==='class'?`Lớp ${target}`:`Phòng ${target}`}
function blankVersion(code,t){return{code:String(code),mcKey:Array(t.mcCount).fill('A'),tfKey:Array.from({length:t.tfCount},()=>['Đ','Đ','Đ','Đ']),shortKey:Array(t.shortCount).fill('0')}}
function makeTemplate(name,mc,tf,sh,cut='normal',codes=['101','102','103','104']){const t={id:uid(),name,schoolName:'',testName:'KIỂM TRA THƯỜNG XUYÊN',periodicMode:'class',subject:'Toán',duration:45,mcCount:mc,tfCount:tf,shortCount:sh,shortLen:4,cut,idMode:cut==='cut'?'phach':'sbd',idDigits:3,examinerCount:1,examForm:'objective',totalPages:2,essayLineSpacing:9,maxScore:10,weights:{mc:3,short:3},tfItemScore:.25,versions:[]};t.versions=codes.map(c=>blankVersion(c,t));return t}
function defaultTemplates(){return [makeTemplate('Chuẩn 12 TN + 4 Đ/S + 6 TLN',12,4,6,'normal'),makeTemplate('Chuẩn cắt phách 12 TN + 4 Đ/S + 6 TLN',12,4,6,'cut'),makeTemplate('20 TN + 4 Đ/S + 4 TLN',20,4,4,'normal')]}
function migrate(){
  let v3=parseJson(getScoped(LS_TPL,'[]'),[]);
  if(v3.length){templates=v3;return}
  if(scopeId()==='device'){
    const legacy=parseJson(localStorage.getItem(LS_TPL)||'[]',[]);
    if(legacy.length){templates=legacy;setScoped(LS_TPL,JSON.stringify(templates));return}
    const old=parseJson(localStorage.getItem('omr_templates_v2')||'[]',[]);
    if(old.length){templates=old.map(o=>{const t=makeTemplate(o.name,o.mcCount||0,o.tfCount||0,o.shortCount||0,o.cut||'normal',[String(o.exam||'101')]);t.shortLen=o.shortLen||4;t.maxScore=o.maxScore||10;t.weights={mc:o.weights?.mc??3,short:o.weights?.short??3};t.tfItemScore=Number.isFinite(+o.tfItemScore)?+o.tfItemScore:.25;t.versions[0].mcKey=o.mcKey||t.versions[0].mcKey;t.versions[0].tfKey=o.tfKey||t.versions[0].tfKey;t.versions[0].shortKey=o.shortKey||t.versions[0].shortKey;return t});saveAll();return}
  }
  seed();
}
function seed(){templates=defaultTemplates();saveAll()}
function normalizeTemplate(t){t.schoolName=t.schoolName||'';t.testName=t.testName||'';t.periodicMode=(t.periodicMode==='class'||t.periodicMode==='room')?t.periodicMode:(isFrequentTest(t)?'class':'room');t.subject=t.subject||'';t.duration=Number.isFinite(+t.duration)&&+t.duration>0?+t.duration:'';t.idMode=t.idMode|| (t.cut==='cut'?'phach':'sbd');t.idDigits=3;t.examinerCount=[1,2,3].includes(+t.examinerCount)?+t.examinerCount:1;t.examForm=(t.examForm==='mixed'?'mixed':'objective');t.totalPages=Math.max(2,Math.min(6,+t.totalPages||2));t.essayLineSpacing=Math.max(1,Math.min(12,+t.essayLineSpacing||9));t.shortLen=+t.shortLen||4;t.maxScore=+t.maxScore||10;t.weights=t.weights||{mc:3,short:3};t.tfItemScore=Number.isFinite(+t.tfItemScore)?+t.tfItemScore:.25;if(!Array.isArray(t.versions)||!t.versions.length)t.versions=[blankVersion('101',t)];t.versions.forEach(v=>{if(!Array.isArray(v.mcKey)||v.mcKey.length!==t.mcCount)v.mcKey=Array(t.mcCount).fill('A');if(!Array.isArray(v.tfKey)||v.tfKey.length!==t.tfCount)v.tfKey=Array.from({length:t.tfCount},()=>['Đ','Đ','Đ','Đ']);v.tfKey=v.tfKey.map(x=>Array.isArray(x)&&x.length===4?x:['Đ','Đ','Đ','Đ']);if(!Array.isArray(v.shortKey)||v.shortKey.length!==t.shortCount)v.shortKey=Array(t.shortCount).fill('0')})}
function updateExamOrganizationUI(){
  const name=$('#testName')?.value||'';
  const frequent=name==='KIỂM TRA THƯỜNG XUYÊN';
  const wrap=$('#periodicModeWrap');
  if(wrap)wrap.style.display=frequent?'none':'block';
  if(frequent&&$('#periodicMode'))$('#periodicMode').value='class';
}
$('#testName').addEventListener('change',updateExamOrganizationUI);
function parseCodes(s){let a=String(s).split(/[,;\s]+/).map(x=>x.trim()).filter(Boolean);a=[...new Set(a)];if(!a.length)return null;if(a.some(x=>!/^\d+$/.test(x)))return null;const len=a[0].length;if(len<2||len>4||a.some(x=>x.length!==len))return null;return a}
function bindSectionToggle(checkId,rowId){
  const cb=$('#'+checkId),row=$('#'+rowId);
  if(!cb||!row)return;
  const fields=[...row.querySelectorAll('input,select')];
  const apply=()=>{
    const on=!!cb.checked;
    row.classList.toggle('disabled',!on);
    fields.forEach(el=>{ if(!el.disabled || el.id==='mcCount' || el.id==='tfCount' || el.id==='shortCount' || el.id==='shortLen') el.disabled=!on || el.hasAttribute('data-force-disabled'); });
  };
  cb.addEventListener('change',apply);
  apply();
}
function refreshSelects(){['keyTpl','printTpl','scanTpl'].forEach(id=>{const s=$('#'+id),old=s.value;s.innerHTML=templates.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');if(templates.some(t=>t.id===old))s.value=old});renderTplList();refreshVersions();renderSheet();renderHistory();refreshScanAssignments()}
function renderTplList(){const box=$('#tplList');box.innerHTML=templates.map(t=>{normalizeTemplate(t);const p1=t.mcCount?`I: ${t.mcCount}`:'I: tắt';const p2=t.tfCount?`II: ${t.tfCount}×4 ý`:'II: tắt';const p3=t.shortCount?`III: ${t.shortCount}`:'III: tắt';const assigned=assignedTargetsForTemplate(t);const orgText=isFrequentTest(t)?'Thường xuyên':(t.periodicMode==='room'?'Định kỳ • Chia phòng':'Định kỳ • Tại lớp');const assignText=` • ${orgText}`+(assigned.length?` • Đã gán: ${assigned.length} ${targetTypeForTemplate(t)==='class'?'lớp':'phòng'}`:'');return`<div class="template-item"><div><h3>${esc(t.name)}</h3><div class="help">${t.schoolName?esc(t.schoolName)+' • ':''}${t.testName?esc(t.testName)+' • ':''}${t.subject?esc(t.subject)+(t.duration?' '+t.duration+' phút':'')+' • ':''}${p1} • ${p2} • ${p3} • ${t.cut==='cut'?'Cắt phách':'Không cắt phách'} • ${t.examinerCount} GK • ${t.examForm==='mixed'?'TN + tự luận • '+t.totalPages+' trang • dòng '+t.essayLineSpacing+'mm':'100% trắc nghiệm'} • Mã đề: ${t.versions.map(v=>esc(v.code)).join(', ')}${assignText}</div></div><button class="btn danger" onclick="delTpl('${t.id}')">Xóa</button></div>`}).join('')}
window.delTpl=id=>{templates=templates.filter(t=>t.id!==id);Object.keys(assignments).forEach(k=>{if(assignments[k]===id)delete assignments[k]});saveAssignmentsData();saveAll();refreshSelects()}
$('#saveTpl').onclick=()=>{const codes=parseCodes($('#examCodes').value);if(!codes){alert('Mã đề phải là số, từ 2–4 chữ số và tất cả phải cùng độ dài. Ví dụ: 101,102,103,104');return}const mcCount=$('#mcEnabled').checked?Math.max(0,Math.min(40,+$('#mcCount').value||0)):0,tfCount=$('#tfEnabled').checked?Math.max(0,Math.min(8,+$('#tfCount').value||0)):0,shortCount=$('#shortEnabled').checked?Math.max(0,Math.min(10,+$('#shortCount').value||0)):0;const t=makeTemplate($('#tplName').value.trim()||'Mẫu mới',mcCount,tfCount,shortCount,$('#cutMode').value,codes);t.shortLen=+$('#shortLen').value;t.examinerCount=+$('#examinerCount').value||1;t.examForm=$('#examForm').value;t.totalPages=Math.max(2,Math.min(6,+$('#totalPages').value||2));t.essayLineSpacing=Math.max(1,Math.min(12,+$('#essayLineSpacing').value||9));t.schoolName=$('#schoolName').value.trim();t.testName=$('#testName').value.toUpperCase();t.periodicMode=t.testName==='KIỂM TRA THƯỜNG XUYÊN'?'class':$('#periodicMode').value;t.subject=$('#subject').value;t.duration=Math.max(1,+$('#duration').value||45);templates.push(t);saveAll();refreshSelects()}
$('#seedPresets').onclick=()=>{seed();refreshSelects()}

function renderAssignmentPanel(){
  const t=cur($('#keyTpl').value)||templates[0];
  const meta=$('#assignMeta'),box=$('#assignTargets'),sum=$('#assignSummary');
  if(!t||!meta||!box||!sum)return;
  normalizeTemplate(t);
  const type=targetTypeForTemplate(t),targets=allTargetsForTemplate(t),assigned=assignedTargetsForTemplate(t);
  meta.innerHTML=`<b>${esc(t.testName||'')}</b> • Môn <b>${esc(t.subject||'')}</b><br>${isFrequentTest(t)?'Kiểm tra thường xuyên → chọn một hoặc nhiều lớp 6/1–9/10.':(t.periodicMode==='room'?'Kiểm tra định kỳ • Chia phòng → chọn một hoặc nhiều phòng thi 1–20.':'Kiểm tra định kỳ • Tại lớp → chọn một hoặc nhiều lớp 6/1–9/10.')}`;
  if(type==='class'){
    let h='';
    for(let g=6;g<=9;g++){
      h+=`<div class="assignGrade"><div class="assignGradeTitle">Khối ${g}</div><div class="assignGrid">`;
      for(let n=1;n<=10;n++){
        const target=`${g}/${n}`,key=assignmentKey(t,target),owner=assignments[key],checked=owner===t.id,other=owner&&owner!==t.id;
        h+=`<label class="assignChip${other?' assignedOther':''}" title="${other?'Đang được gán cho mẫu khác; lưu sẽ chuyển sang mẫu này':''}"><input class="assignTargetCb" type="checkbox" value="${target}" ${checked?'checked':''}>${target}</label>`;
      }
      h+='</div></div>';
    }
    box.innerHTML=h;
  }else{
    box.innerHTML=`<div class="assignGrid rooms">${targets.map(target=>{const owner=assignments[assignmentKey(t,target)],checked=owner===t.id,other=owner&&owner!==t.id;return`<label class="assignChip${other?' assignedOther':''}" title="${other?'Đang được gán cho mẫu khác; lưu sẽ chuyển sang mẫu này':''}"><input class="assignTargetCb" type="checkbox" value="${target}" ${checked?'checked':''}>Phòng ${target}</label>`}).join('')}</div>`;
  }
  sum.innerHTML=assigned.length?`Mẫu này đang áp dụng cho: <b>${assigned.map(x=>assignmentDisplayTarget(type,x)).join(', ')}</b>.`:'Mẫu này chưa được gán cho lớp/phòng nào.';
}
$('#assignAll').onclick=()=>document.querySelectorAll('.assignTargetCb').forEach(x=>x.checked=true);
$('#assignNone').onclick=()=>document.querySelectorAll('.assignTargetCb').forEach(x=>x.checked=false);
$('#saveAssignments').onclick=()=>{
  const t=cur($('#keyTpl').value);if(!t)return;
  normalizeTemplate(t);
  const targets=allTargetsForTemplate(t),selected=[...document.querySelectorAll('.assignTargetCb:checked')].map(x=>x.value);
  const conflicts=selected.filter(x=>assignments[assignmentKey(t,x)]&&assignments[assignmentKey(t,x)]!==t.id);
  if(conflicts.length&&!confirm(`${conflicts.length} ${targetTypeForTemplate(t)==='class'?'lớp':'phòng'} đang được gán cho mẫu khác. Chuyển các lớp/phòng này sang mẫu "${t.name}"?`))return;
  targets.forEach(x=>{const k=assignmentKey(t,x);if(assignments[k]===t.id)delete assignments[k]});
  selected.forEach(x=>assignments[assignmentKey(t,x)]=t.id);
  saveAssignmentsData();renderAssignmentPanel();renderTplList();if($('#scanSource'))$('#scanSource').value='assigned';refreshScanAssignments();
  alert(`Đã lưu phân công ${selected.length} ${targetTypeForTemplate(t)==='class'?'lớp':'phòng'} cho mẫu "${t.name}".`);
}

function refreshVersions(){const t=cur($('#keyTpl').value)||templates[0];if(!t)return;normalizeTemplate(t);$('#keyTpl').value=t.id;const sv=$('#keyVersion'),old=sv.value;sv.innerHTML=t.versions.map(v=>`<option value="${esc(v.code)}">Mã ${esc(v.code)}</option>`).join('');if(t.versions.some(v=>v.code===old))sv.value=old;renderKey();renderAssignmentPanel()}
function keyVersion(t){return t.versions.find(v=>v.code===$('#keyVersion').value)||t.versions[0]}
function renderKey(){const t=cur($('#keyTpl').value)||templates[0];if(!t)return;normalizeTemplate(t);const v=keyVersion(t);$('#maxScore').value=t.maxScore;$('#mcWeight').value=t.weights.mc;$('#tfItemScore').value=t.tfItemScore;$('#tfWeight').value=(t.tfCount*4*t.tfItemScore).toFixed(2);$('#shortWeight').value=t.weights.short;let h='';if(t.mcCount)h+=`<div class="keySection"><h3>Phần I — Mã ${esc(v.code)}</h3><div class="answer-grid">${v.mcKey.map((x,i)=>`<div class="answer-cell"><b>Câu ${i+1}</b><select class="mcAns" data-i="${i}">${['A','B','C','D'].map(a=>`<option ${a===x?'selected':''}>${a}</option>`).join('')}</select></div>`).join('')}</div></div>`;if(t.tfCount)h+=`<div class="keySection"><h3>Phần II — Mã ${esc(v.code)}</h3><div class="answer-grid tf-answer-grid">${v.tfKey.map((arr,i)=>`<div class="answer-cell tf-answer-cell"><b>Câu ${i+1}</b><div class="tfKey">${arr.map((x,j)=>`<div class="tfChoice"><small>${'abcd'[j]}</small><input type="hidden" class="tfAns" data-i="${i}" data-j="${j}" value="${x==='S'?'S':'Đ'}"><button type="button" class="tfToggle ${x==='S'?'isFalse':'isTrue'}" data-i="${i}" data-j="${j}" aria-label="Ý ${'abcd'[j]}: ${x==='S'?'Sai':'Đúng'}" title="Bấm để đổi Đúng/Sai">${x==='S'?'S':'Đ'}</button></div>`).join('')}</div></div>`).join('')}</div></div>`;if(t.shortCount)h+=`<div class="keySection"><h3>Phần III — Mã ${esc(v.code)}</h3><div class="answer-grid">${v.shortKey.map((x,i)=>`<div class="answer-cell"><b>Câu ${i+1}</b><input class="shortAns" data-i="${i}" value="${esc(x)}" maxlength="${t.shortLen+2}" placeholder="-2,5"></div>`).join('')}</div></div>`;$('#keyEditor').innerHTML=h}
$('#keyTpl').onchange=()=>{refreshVersions();syncShareMetaFromTemplate()};$('#keyVersion').onchange=renderKey;
$('#keyEditor').addEventListener('click',e=>{
  const btn=e.target.closest('.tfToggle');if(!btn)return;
  const box=btn.closest('.tfChoice'),inp=box?.querySelector('.tfAns');if(!inp)return;
  const next=inp.value==='Đ'?'S':'Đ';
  inp.value=next;
  btn.textContent=next;
  btn.classList.toggle('isTrue',next==='Đ');
  btn.classList.toggle('isFalse',next==='S');
  btn.setAttribute('aria-label',`Ý ${'abcd'[+btn.dataset.j]||''}: ${next==='Đ'?'Đúng':'Sai'}`);
});
$('#tfItemScore').oninput=()=>{const t=cur($('#keyTpl').value);if(t)$('#tfWeight').value=(t.tfCount*4*(+$('#tfItemScore').value||0)).toFixed(2)}
function normalizeShort(s){s=String(s??'').trim().replace(/\s+/g,'').replace('.',',');if(s.startsWith('+'))s=s.slice(1);if(/^[-+]?\d+,0+$/.test(s))s=s.replace(/,0+$/,'');if(/^(-?)0+(\d)/.test(s))s=s.replace(/^(-?)0+(\d)/,'$1$2');return s}
function syncKeyEditorToTemplate(t,v){
  if(!t||!v)return;
  normalizeTemplate(t);
  t.maxScore=Math.max(0,+$('#maxScore').value||10);
  t.weights.mc=Math.max(0,+$('#mcWeight').value||0);
  t.weights.short=Math.max(0,+$('#shortWeight').value||0);
  t.tfItemScore=Math.max(0,+$('#tfItemScore').value||0);
  document.querySelectorAll('.mcAns').forEach(x=>v.mcKey[+x.dataset.i]=x.value);
  document.querySelectorAll('.tfAns').forEach(x=>v.tfKey[+x.dataset.i][+x.dataset.j]=x.value);
  document.querySelectorAll('.shortAns').forEach(x=>v.shortKey[+x.dataset.i]=normalizeShort(x.value));
}
$('#saveKey').onclick=()=>{const t=cur($('#keyTpl').value);if(!t)return;const v=keyVersion(t);syncKeyEditorToTemplate(t,v);saveAll();$('#tfWeight').value=(t.tfCount*4*t.tfItemScore).toFixed(2);alert('Đã lưu đáp án cho mã đề '+v.code)}

function safeKeyFileName(s){return String(s||'bo_dap_an').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||'bo_dap_an'}
function downloadKeyFile(name,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800)
}
function makeAnswerKeyPackage(t){
  normalizeTemplate(t);
  return{
    format:'OMR_MOBILE_ANSWER_KEY',
    schemaVersion:1,
    exportedAt:new Date().toISOString(),
    appVersion:'4.21',
    template:{
      name:t.name,
      schoolName:t.schoolName||'',
      testName:t.testName||'',
      periodicMode:t.periodicMode||'class',
      subject:t.subject||'',
      duration:t.duration||'',
      mcCount:t.mcCount,
      tfCount:t.tfCount,
      shortCount:t.shortCount,
      shortLen:t.shortLen,
      maxScore:t.maxScore,
      weights:{mc:+t.weights.mc||0,short:+t.weights.short||0},
      tfItemScore:+t.tfItemScore||0,
      assignment:{
        targetType:targetTypeForTemplate(t),
        testName:t.testName||'',
        subject:t.subject||'',
        targets:assignedTargetsForTemplate(t)
      },
      versions:t.versions.map(v=>({
        code:String(v.code),
        mcKey:[...v.mcKey],
        tfKey:v.tfKey.map(a=>[...a]),
        shortKey:v.shortKey.map(normalizeShort)
      }))
    }
  }
}

function makeSharedAnswerKeyPackage(t,meta={}){
  normalizeTemplate(t);
  return{
    format:'OMR_MOBILE_SHARED_ANSWER_KEY',
    schemaVersion:1,
    exportedAt:new Date().toISOString(),
    appVersion:'4.21',
    meta:{
      grade:String(meta.grade||''),
      title:String(meta.title||t.name||'Bộ đáp án dùng chung'),
      note:String(meta.note||'')
    },
    template:{
      name:t.name,
      testName:t.testName||'',
      periodicMode:t.periodicMode||'class',
      subject:t.subject||'',
      duration:t.duration||'',
      cut:t.cut||'normal',
      examinerCount:+t.examinerCount||1,
      examForm:t.examForm||'objective',
      totalPages:+t.totalPages||2,
      essayLineSpacing:+t.essayLineSpacing||9,
      mcCount:+t.mcCount||0,
      tfCount:+t.tfCount||0,
      shortCount:+t.shortCount||0,
      shortLen:+t.shortLen||4,
      maxScore:+t.maxScore||10,
      weights:{mc:+t.weights?.mc||0,short:+t.weights?.short||0},
      tfItemScore:+t.tfItemScore||0,
      versions:t.versions.map(v=>({
        code:String(v.code),
        mcKey:[...v.mcKey],
        tfKey:v.tfKey.map(a=>[...a]),
        shortKey:v.shortKey.map(normalizeShort)
      }))
    }
  }
}
function validateSharedAnswerKeyPackage(pkg){
  if(!pkg||pkg.format!=='OMR_MOBILE_SHARED_ANSWER_KEY'||!pkg.template)throw new Error('Đây không phải gói đáp án dùng chung của OMR Mobile.');
  const k=pkg.template;
  ['mcCount','tfCount','shortCount','shortLen'].forEach(x=>{if(!Number.isInteger(+k[x])||+k[x]<0)throw new Error('Cấu trúc gói đáp án không hợp lệ: '+x)});
  if(+k.shortLen<3||+k.shortLen>5)throw new Error('Số vị trí trả lời ngắn không hợp lệ.');
  if(!Array.isArray(k.versions)||!k.versions.length)throw new Error('Gói không có mã đề.');
  const codes=k.versions.map(v=>String(v.code)),parsed=parseCodes(codes.join(','));
  if(!parsed||parsed.length!==codes.length)throw new Error('Mã đề trong gói không hợp lệ.');
  k.versions.forEach(v=>{
    if(!Array.isArray(v.mcKey)||v.mcKey.length!==+k.mcCount||v.mcKey.some(a=>!['A','B','C','D'].includes(a)))throw new Error('Đáp án Phần I không hợp lệ ở mã '+v.code+'.');
    if(!Array.isArray(v.tfKey)||v.tfKey.length!==+k.tfCount||v.tfKey.some(a=>!Array.isArray(a)||a.length!==4||a.some(x=>!['Đ','S'].includes(x))))throw new Error('Đáp án Phần II không hợp lệ ở mã '+v.code+'.');
    if(!Array.isArray(v.shortKey)||v.shortKey.length!==+k.shortCount)throw new Error('Đáp án Phần III không hợp lệ ở mã '+v.code+'.');
  });
  return k;
}
function applySharedAnswerKeyToTemplate(target,k){
  target.name=target.name||k.name||'Mẫu dùng chung';
  target.testName=k.testName||target.testName||'KIỂM TRA THƯỜNG XUYÊN';
  target.periodicMode=(k.periodicMode==='room'?'room':'class');
  target.subject=k.subject||target.subject||'';
  target.duration=Number.isFinite(+k.duration)&&+k.duration>0?+k.duration:target.duration;
  target.cut=(k.cut==='cut'?'cut':'normal');
  target.idMode=target.cut==='cut'?'phach':'sbd';
  target.examinerCount=[1,2,3].includes(+k.examinerCount)?+k.examinerCount:1;
  target.examForm=(k.examForm==='mixed'?'mixed':'objective');
  target.totalPages=Math.max(2,Math.min(6,+k.totalPages||2));
  target.essayLineSpacing=Math.max(1,Math.min(12,+k.essayLineSpacing||9));
  target.mcCount=+k.mcCount||0;target.tfCount=+k.tfCount||0;target.shortCount=+k.shortCount||0;target.shortLen=+k.shortLen||4;
  target.maxScore=Math.max(0,+k.maxScore||10);
  target.weights={mc:Math.max(0,+k.weights?.mc||0),short:Math.max(0,+k.weights?.short||0)};
  target.tfItemScore=Math.max(0,+k.tfItemScore||0);
  target.versions=k.versions.map(v=>({
    code:String(v.code),
    mcKey:v.mcKey.map(String),
    tfKey:v.tfKey.map(a=>a.map(String)),
    shortKey:v.shortKey.map(normalizeShort)
  }));
  normalizeTemplate(target);
}
function createTemplateFromSharedPackage(pkg){
  const k=validateSharedAnswerKeyPackage(pkg),codes=k.versions.map(v=>String(v.code));
  const baseName=pkg.meta?.title||k.name||'Bộ đáp án dùng chung';
  const t=makeTemplate(baseName,+k.mcCount,+k.tfCount,+k.shortCount,k.cut==='cut'?'cut':'normal',codes);
  t.shortLen=+k.shortLen;applySharedAnswerKeyToTemplate(t,k);
  return t;
}
function chooseSharedImportMode(selected){
  if(!selected)return 'new';
  const ans=prompt(`Nhập gói đáp án dùng chung:\n\n1 = Tạo bản sao mới (khuyên dùng)\n2 = Ghi đè mẫu đang chọn: ${selected.name}\n0 = Hủy\n\nNhập 1, 2 hoặc 0:`, '1');
  if(ans===null||String(ans).trim()==='0')return 'cancel';
  return String(ans).trim()==='2'?'overwrite':'new';
}
function importSharedPackageObject(pkg,sourceLabel='gói dùng chung'){
  const k=validateSharedAnswerKeyPackage(pkg),selected=cur($('#keyTpl').value),mode=chooseSharedImportMode(selected);
  if(mode==='cancel')return null;
  let target;
  if(mode==='overwrite'&&selected){
    target=selected;applySharedAnswerKeyToTemplate(target,k);
  }else{
    target=createTemplateFromSharedPackage(pkg);
    target.name=(pkg.meta?.title||target.name)+' (bản sao)';templates.push(target);
  }
  saveAll();refreshSelects();$('#keyTpl').value=target.id;refreshVersions();renderAssignmentPanel();
  if($('#scanSource'))$('#scanSource').value='assigned';
  alert(`Đã nhập ${target.versions.length} mã đề từ ${sourceLabel}.\n\nKhông nhập lớp/phòng của người chia sẻ. Hãy gán mẫu này cho lớp/phòng bạn phụ trách ở phần "Gán mẫu & đáp án".`);
  return target;
}
function getSharedMetaInputs(){
  const t=cur($('#keyTpl').value);
  return{
    grade:$('#shareGrade').value,
    title:$('#shareTitle').value.trim()||(t?`${t.subject||''} ${$('#shareGrade').value} - ${t.testName||''} - ${t.name}`.trim():'Bộ đáp án dùng chung'),
    note:$('#shareNote').value.trim()
  }
}
function syncShareMetaFromTemplate(){
  const t=cur($('#keyTpl').value);if(!t)return;
  if(!$('#shareTitle').value.trim())$('#shareTitle').value=`${t.subject||''} - ${t.testName||''} - ${t.name}`.replace(/\s+/g,' ').trim();
}
async function publishSharedAnswerKey(){
  if(!currentUser||!firebaseCtx){alert('Cần đăng nhập Firebase.');return}
  const t=cur($('#keyTpl').value);if(!t){alert('Chưa chọn mẫu.');return}
  const v=keyVersion(t);syncKeyEditorToTemplate(t,v);saveAll();
  const meta=getSharedMetaInputs(),pkg=makeSharedAnswerKeyPackage(t,meta),json=JSON.stringify(pkg);
  if(json.length>900000){alert('Gói đáp án quá lớn để đưa lên Firestore. Hãy dùng xuất file.');return}
  if(!confirm(`Đăng bộ đáp án "${meta.title}" lên kho chung Khối ${meta.grade}?\n\nGói này không chứa lớp/phòng, lịch sử chấm hoặc ảnh bài làm.`))return;
  try{
    const m=firebaseModules.firestore;
    await m.addDoc(m.collection(firebaseCtx.db,'sharedAnswerPackages'),{
      format:'OMR_MOBILE_SHARED_ANSWER_KEY',schemaVersion:1,title:meta.title,grade:String(meta.grade),
      subject:t.subject||'',testName:t.testName||'',templateName:t.name||'',versionCodes:t.versions.map(x=>String(x.code)).join(', '),
      note:meta.note||'',ownerUid:currentUser.uid,ownerName:currentProfile?.name||currentUser.email||'',ownerEmail:currentUser.email||'',
      createdAt:new Date().toISOString(),packageJson:json
    });
    alert('Đã đăng bộ đáp án lên kho dùng chung.');await loadSharedAnswerLibrary();
  }catch(e){alert('Không đăng được lên kho đáp án: '+friendlyFirebaseError(e))}
}
async function loadSharedAnswerLibrary(){
  const status=$('#sharedLibraryStatus'),list=$('#sharedLibraryList');if(!status||!list)return;
  if(!currentUser||!firebaseCtx){status.textContent='Chưa đăng nhập Firebase.';list.innerHTML='';return}
  status.textContent='Đang tải kho đáp án…';
  try{
    const m=firebaseModules.firestore,q=await m.getDocs(m.collection(firebaseCtx.db,'sharedAnswerPackages'));
    sharedKeyCache=q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));renderSharedAnswerLibrary();
  }catch(e){status.textContent='Không tải được kho đáp án: '+friendlyFirebaseError(e);list.innerHTML=''}
}
function renderSharedAnswerLibrary(){
  const status=$('#sharedLibraryStatus'),list=$('#sharedLibraryList');if(!status||!list)return;
  const grade=$('#sharedFilterGrade').value,subject=$('#sharedFilterSubject').value.trim().toLowerCase(),txt=$('#sharedFilterText').value.trim().toLowerCase();
  const rows=sharedKeyCache.filter(x=>{
    if(grade&&String(x.grade)!==grade)return false;
    if(subject&&!String(x.subject||'').toLowerCase().includes(subject))return false;
    if(txt&&!`${x.title||''} ${x.testName||''} ${x.templateName||''} ${x.versionCodes||''}`.toLowerCase().includes(txt))return false;
    return true;
  });
  status.textContent=`Có ${rows.length}/${sharedKeyCache.length} gói đáp án phù hợp.`;
  list.innerHTML=rows.length?rows.map(x=>{
    const canDelete=currentIsAdmin||x.ownerUid===currentUser?.uid;
    return `<div class="sharedPackageCard"><div><h4>${esc(x.title||x.templateName||'Bộ đáp án')}</h4><div class="sharedPackageMeta"><span class="sharedPackageBadge">Khối ${esc(x.grade||'')}</span><span class="sharedPackageOwner">${esc(x.ownerName||x.ownerEmail||'Người đăng')}</span><br>${esc(x.subject||'')} • ${esc(x.testName||'')} • Mã đề: ${esc(x.versionCodes||'—')}<br>${x.note?`Ghi chú: ${esc(x.note)}<br>`:''}Đăng: ${esc(fmtHistoryTime(x.createdAt))}</div></div><div class="sharedPackageActions"><button class="btn good" onclick="copySharedPackage('${esc(x.id)}')">Sao chép về tài khoản</button><button class="btn secondary" onclick="downloadSharedCloudPackage('${esc(x.id)}')">Tải file</button>${canDelete?`<button class="btn danger" onclick="deleteSharedCloudPackage('${esc(x.id)}')">Xóa khỏi kho</button>`:''}</div></div>`;
  }).join(''):'<div class="notice">Chưa có gói đáp án phù hợp.</div>';
}
async function copySharedCloudPackage(id){
  const x=sharedKeyCache.find(a=>a.id===id);if(!x)return;
  try{importSharedPackageObject(JSON.parse(x.packageJson),'kho đáp án chung')}catch(e){alert('Gói đáp án trên kho không hợp lệ: '+(e?.message||e))}
}
async function downloadSharedCloudPackage(id){
  const x=sharedKeyCache.find(a=>a.id===id);if(!x)return;
  try{downloadKeyFile(`goi_dap_an_khoi_${safeKeyFileName(x.grade)}_${safeKeyFileName(x.title)}.omrshare.json`,JSON.parse(x.packageJson))}catch(e){alert('Không tải được gói đáp án.')}
}
async function deleteSharedCloudPackage(id){
  const x=sharedKeyCache.find(a=>a.id===id);if(!x)return;
  if(!(currentIsAdmin||x.ownerUid===currentUser?.uid)){alert('Bạn không có quyền xóa gói này.');return}
  if(!confirm(`Xóa "${x.title||'gói đáp án'}" khỏi kho dùng chung?`))return;
  try{await firebaseModules.firestore.deleteDoc(firebaseModules.firestore.doc(firebaseCtx.db,'sharedAnswerPackages',id));await loadSharedAnswerLibrary()}
  catch(e){alert('Không xóa được: '+friendlyFirebaseError(e))}
}
window.copySharedPackage=id=>copySharedCloudPackage(id);
window.downloadSharedCloudPackage=id=>downloadSharedCloudPackage(id);
window.deleteSharedCloudPackage=id=>deleteSharedCloudPackage(id);

function validateAnswerKeyPackage(pkg){
  if(!pkg||pkg.format!=='OMR_MOBILE_ANSWER_KEY'||!pkg.template)throw new Error('Đây không phải file đáp án của OMR Mobile.');
  const k=pkg.template;
  const ints=['mcCount','tfCount','shortCount','shortLen'];
  ints.forEach(x=>{if(!Number.isInteger(+k[x])||+k[x]<0)throw new Error('Cấu trúc file đáp án không hợp lệ: '+x)});
  if(+k.shortLen<3||+k.shortLen>5)throw new Error('Số vị trí trả lời ngắn không hợp lệ.');
  if(!Array.isArray(k.versions)||!k.versions.length)throw new Error('File không có mã đề.');
  const codes=k.versions.map(v=>String(v.code));
  const parsed=parseCodes(codes.join(','));
  if(!parsed||parsed.length!==codes.length)throw new Error('Mã đề trong file không hợp lệ.');
  k.versions.forEach(v=>{
    if(!Array.isArray(v.mcKey)||v.mcKey.length!==+k.mcCount||v.mcKey.some(a=>!['A','B','C','D'].includes(a)))throw new Error('Đáp án Phần I không hợp lệ ở mã '+v.code+'.');
    if(!Array.isArray(v.tfKey)||v.tfKey.length!==+k.tfCount||v.tfKey.some(a=>!Array.isArray(a)||a.length!==4||a.some(x=>!['Đ','S'].includes(x))))throw new Error('Đáp án Phần II không hợp lệ ở mã '+v.code+'.');
    if(!Array.isArray(v.shortKey)||v.shortKey.length!==+k.shortCount)throw new Error('Đáp án Phần III không hợp lệ ở mã '+v.code+'.');
  });
  return k
}
function applyAnswerKeyPackage(target,k){
  normalizeTemplate(target);
  target.periodicMode=(k.periodicMode==='room'?'room':'class');
  target.maxScore=Math.max(0,+k.maxScore||10);
  target.weights={mc:Math.max(0,+k.weights?.mc||0),short:Math.max(0,+k.weights?.short||0)};
  target.tfItemScore=Math.max(0,+k.tfItemScore||0);
  target.versions=k.versions.map(v=>({
    code:String(v.code),
    mcKey:v.mcKey.map(String),
    tfKey:v.tfKey.map(a=>a.map(String)),
    shortKey:v.shortKey.map(normalizeShort)
  }));
  normalizeTemplate(target);
  if(k.assignment&&Array.isArray(k.assignment.targets)){
    const all=allTargetsForTemplate(target);
    all.forEach(x=>{const key=assignmentKey(target,x);if(assignments[key]===target.id)delete assignments[key]});
    k.assignment.targets.forEach(x=>{if(all.includes(String(x)))assignments[assignmentKey(target,String(x))]=target.id});
    saveAssignmentsData();
  }
}
$('#exportKeyFile').onclick=()=>{
  const t=cur($('#keyTpl').value);if(!t){alert('Chưa có mẫu để xuất đáp án.');return}
  const v=keyVersion(t);syncKeyEditorToTemplate(t,v);saveAll();
  const pkg=makeAnswerKeyPackage(t);
  downloadKeyFile('dap_an_'+safeKeyFileName(t.name)+'.omrkey.json',pkg);
}
$('#importKeyFile').onclick=()=>$('#importKeyInput').click();
$('#importKeyInput').onchange=async e=>{
  const file=e.target.files&&e.target.files[0];if(!file)return;
  try{
    const pkg=JSON.parse(await file.text()),k=validateAnswerKeyPackage(pkg);
    let target=cur($('#keyTpl').value);
    const compatible=target&&target.mcCount===+k.mcCount&&target.tfCount===+k.tfCount&&target.shortCount===+k.shortCount&&target.shortLen===+k.shortLen;
    if(!compatible){
      const msg=`Cấu trúc file đáp án: I=${k.mcCount}, II=${k.tfCount}, III=${k.shortCount}, ${k.shortLen} vị trí.\nMẫu đang chọn không cùng cấu trúc.\n\nTạo một mẫu mới từ file đáp án này?`;
      if(!confirm(msg)){e.target.value='';return}
      const codes=k.versions.map(v=>String(v.code));
      target=makeTemplate((k.name||'Mẫu nhập đáp án')+' (nhập)',+k.mcCount,+k.tfCount,+k.shortCount,'normal',codes);
      target.shortLen=+k.shortLen;
      target.schoolName=k.schoolName||'';
      target.testName=k.testName||'KIỂM TRA THƯỜNG XUYÊN';
      target.periodicMode=(k.periodicMode==='room'?'room':'class');
      target.subject=k.subject||'Toán';
      target.duration=+k.duration||45;
      templates.push(target)
    }
    applyAnswerKeyPackage(target,k);
    saveAll();
    if(k.assignment&&Array.isArray(k.assignment.targets)&&k.assignment.targets.length&&$('#scanSource'))$('#scanSource').value='assigned';
    refreshSelects();
    $('#keyTpl').value=target.id;
    refreshVersions();
    alert(`Đã nhập thành công ${target.versions.length} mã đề vào mẫu "${target.name}".`)
  }catch(err){
    alert('Không thể nhập file đáp án: '+(err&&err.message?err.message:'File không hợp lệ.'))
  }finally{e.target.value=''}
}


$('#exportSharedKeyFile').onclick=()=>{
  const t=cur($('#keyTpl').value);if(!t){alert('Chưa chọn mẫu.');return}
  const v=keyVersion(t);syncKeyEditorToTemplate(t,v);saveAll();const meta=getSharedMetaInputs(),pkg=makeSharedAnswerKeyPackage(t,meta);
  downloadKeyFile(`goi_dap_an_khoi_${safeKeyFileName(meta.grade)}_${safeKeyFileName(meta.title)}.omrshare.json`,pkg);
};
$('#importSharedKeyFile').onclick=()=>$('#importSharedKeyInput').click();
$('#importSharedKeyInput').onchange=async e=>{
  const file=e.target.files&&e.target.files[0];if(!file)return;
  try{importSharedPackageObject(JSON.parse(await file.text()),'file dùng chung')}
  catch(err){alert('Không thể nhập gói đáp án dùng chung: '+(err?.message||'File không hợp lệ.'))}
  finally{e.target.value=''}
};
$('#publishSharedKey').onclick=publishSharedAnswerKey;
$('#refreshSharedKeys').onclick=loadSharedAnswerLibrary;
$('#sharedFilterGrade').onchange=renderSharedAnswerLibrary;
$('#sharedFilterSubject').oninput=renderSharedAnswerLibrary;
$('#sharedFilterText').oninput=renderSharedAnswerLibrary;
$('#shareGrade').onchange=syncShareMetaFromTemplate;
$('#shareTitle').addEventListener('focus',syncShareMetaFromTemplate);


function candidateLabelForTemplate(t){return showRoomField(t)?'SBD':'SỐ HIỆU'}
function normalizeCandidateCode(v){const d=String(v??'').replace(/\D/g,'');if(!d||d.length>3)return'';return d.padStart(3,'0')}
function normalizeRosterRoom(v){let d=String(v??'').trim().replace(/^ph[oòóỏõọ]ng\s*/i,'').replace(/\D/g,'');if(!d)return'';const n=+d;return Number.isFinite(n)&&n>0?String(n):''}
function foldHeader(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]/g,'')}
function findRosterHeader(headers,aliases){const fs=headers.map(foldHeader);for(const a of aliases){const i=fs.indexOf(foldHeader(a));if(i>=0)return i}return-1}
function saveRoster(){setScoped(LS_ROSTER,JSON.stringify(studentRoster));queueCloudSync();renderRosterManager()}
function rosterLookup(code,t,target=''){
  const id=normalizeCandidateCode(code);if(!id)return null;
  const type=targetTypeForTemplate(t);
  let rows=[];
  if(type==='class')rows=studentRoster.filter(r=>String(r.className||'').trim()===String(target||'').trim()&&normalizeCandidateCode(r.number)===id);
  else rows=studentRoster.filter(r=>normalizeRosterRoom(r.room)===normalizeRosterRoom(target)&&normalizeCandidateCode(r.sbd)===id);
  if(rows.length===1)return rows[0];
  if(rows.length>1)return{...rows[0],_ambiguous:true};
  // Fallback only when the identifier is globally unique in the relevant mode.
  rows=type==='class'?studentRoster.filter(r=>normalizeCandidateCode(r.number)===id):studentRoster.filter(r=>normalizeCandidateCode(r.sbd)===id);
  return rows.length===1?rows[0]:null;
}
function rosterRowKey(r){return[foldHeader(r.name),String(r.className||''),normalizeCandidateCode(r.number),normalizeRosterRoom(r.room),normalizeCandidateCode(r.sbd)].join('|')}
function renderRosterManager(){
  const body=$('#rosterPreviewBody'),status=$('#rosterStatus');if(!body||!status)return;
  const classes=new Set(studentRoster.map(r=>String(r.className||'').trim()).filter(Boolean)),rooms=new Set(studentRoster.map(r=>normalizeRosterRoom(r.room)).filter(Boolean));
  status.textContent=studentRoster.length?`Đã lưu ${studentRoster.length} học sinh • ${classes.size} lớp • ${rooms.size} phòng có dữ liệu. Danh sách được đồng bộ theo tài khoản giáo viên.`:'Chưa có danh sách học sinh.';
  body.innerHTML=studentRoster.slice(0,150).map(r=>`<tr><td>${esc(r.name||'')}</td><td>${esc(r.className||'')}</td><td>${esc(normalizeCandidateCode(r.number)||'')}</td><td>${esc(normalizeRosterRoom(r.room)||'')}</td><td>${esc(normalizeCandidateCode(r.sbd)||'')}</td></tr>`).join('')+(studentRoster.length>150?`<tr><td colspan="5" class="help">… còn ${studentRoster.length-150} học sinh</td></tr>`:'');
}
async function parseRosterFile(file){
  const XLSX=await loadSheetJs(),buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  if(!aoa.length)throw new Error('File không có dữ liệu.');
  const headers=aoa[0].map(String),iName=findRosterHeader(headers,['Họ và tên','Họ tên','Tên học sinh','Ho ten']),iClass=findRosterHeader(headers,['Lớp','Lop']),iNo=findRosterHeader(headers,['Số hiệu','So hieu','STT lớp','STT']),iRoom=findRosterHeader(headers,['Phòng thi','Phòng','Phong thi','Phong']),iSbd=findRosterHeader(headers,['SBD','Số báo danh','So bao danh']);
  if(iName<0||iClass<0)throw new Error('File cần tối thiểu hai cột “Họ và tên” và “Lớp”.');
  if(iNo<0&&iSbd<0)throw new Error('File cần có cột “Số hiệu” hoặc “SBD”.');
  const rows=[];let skipped=0;
  for(let r=1;r<aoa.length;r++){
    const x=aoa[r],name=String(x[iName]??'').trim(),className=String(x[iClass]??'').trim(),number=iNo>=0?normalizeCandidateCode(x[iNo]):'',room=iRoom>=0?normalizeRosterRoom(x[iRoom]):'',sbd=iSbd>=0?normalizeCandidateCode(x[iSbd]):'';
    if(!name&&!className&&!number&&!sbd)continue;
    if(!name||!className||(!number&&!sbd)){skipped++;continue}
    rows.push({name,className,number,room,sbd});
  }
  if(!rows.length)throw new Error('Không tìm thấy dòng học sinh hợp lệ.');
  return{rows,skipped};
}
async function importRosterFile(file){
  try{
    const parsed=await parseRosterFile(file),mode=studentRoster.length?prompt(`Đã đọc ${parsed.rows.length} học sinh.\n\n1 = Thay toàn bộ danh sách hiện tại\n2 = Gộp với danh sách hiện tại\n0 = Hủy`,'1'):'1';
    if(mode===null||String(mode).trim()==='0')return;
    if(String(mode).trim()==='2'){
      const map=new Map(studentRoster.map(r=>[rosterRowKey(r),r]));parsed.rows.forEach(r=>map.set(rosterRowKey(r),r));studentRoster=[...map.values()];
    }else studentRoster=parsed.rows;
    saveRoster();renderHistory();alert(`Đã lưu ${studentRoster.length} học sinh.${parsed.skipped?` Bỏ qua ${parsed.skipped} dòng thiếu thông tin.`:''}`);
  }catch(e){alert('Không nhập được danh sách học sinh: '+(e?.message||e))}
}
async function downloadRosterTemplate(){
  try{
    const XLSX=await loadSheetJs(),rows=[['Họ và tên','Lớp','Số hiệu','Phòng thi','SBD'],['Nguyễn Văn An','8/1',1,1,1],['Trần Thị Bình','8/1',2,1,2],['Lê Minh Châu','8/2',1,2,35]],ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new();
    ws['!cols']=[{wch:28},{wch:10},{wch:12},{wch:12},{wch:12}];XLSX.utils.book_append_sheet(wb,ws,'Danh sach');XLSX.writeFile(wb,'Mau_Danh_Sach_Hoc_Sinh_OMR_v4.3.xlsx');
  }catch(e){alert('Không tạo được file mẫu: '+(e?.message||e))}
}
function applyRosterToExistingHistory(){
  const his=getHistory();let changed=0;
  his.forEach(h=>{if(!h.candidateId)return;const fake={periodicMode:h.targetType==='room'?'room':'class',testName:h.testName||'',idMode:'sbd'};const r=rosterLookup(h.candidateId,fake,h.target);if(!r||r._ambiguous)return;if(!h.student&&r.name){h.student=r.name;changed++}if(!h.studentClass&&r.className)h.studentClass=r.className;if(!h.studentRoom&&(r.room||h.targetType==='room'))h.studentRoom=normalizeRosterRoom(r.room||h.target)});
  if(changed||his.length){saveHistory(his);renderHistory()}alert(changed?`Đã điền tên cho ${changed} kết quả cũ.`:'Không có kết quả cũ nào cần cập nhật tên.');
}

function buildLayout(t){
normalizeTemplate(t);
const W=794,Hh=1123,idTop=t.cut==='cut'?306:216,reviewTop=idTop,start=idTop+195,end=45,left=55,right=55,width=W-left-right;
let y=start;
const activeCount=(t.mcCount?1:0)+(t.tfCount?1:0)+(t.shortCount?1:0);
const sectionGap=activeCount<=1?11:activeCount===2?8:5;
const L={W,H:Hh,idTop,reviewTop,id:[],exam:[],mc:[],mcGroups:[],tf:[],tfGroups:[],short:[],titles:[],overflow:false,activeCount};

// v4.3: hai khối nhận dạng đặt cạnh nhau, dùng chung tọa độ in và tọa độ camera.
const blockW=105,idBoxLeft=305,examBoxLeft=420,rowStart=idTop+72,rowStep=10.6;
const makeDigitCols=(leftBox,count)=>{
  const innerLeft=leftBox+17,innerRight=leftBox+blockW-17,span=innerRight-innerLeft;
  return Array.from({length:count},(_,c)=>{
    const x=innerLeft+(c+.5)*span/count;
    return{pos:c+1,x,vals:Array.from({length:10},(_,d)=>({label:String(d),x,y:rowStart+d*rowStep}))};
  });
};
L.id=makeDigitCols(idBoxLeft,3);
const codeLen=t.versions[0].code.length;L.exam=makeDigitCols(examBoxLeft,codeLen);
L.idBox={x:idBoxLeft,y:idTop,w:blockW,h:187};L.examBox={x:examBoxLeft,y:idTop,w:blockW,h:187};

if(t.mcCount){
  L.titles.push({text:'PHẦN I. TRẮC NGHIỆM 4 LỰA CHỌN — Chọn A, B, C hoặc D',y});
  y+=18;

  // Quy tắc mới cho Phần I:
  // - Luôn chia thành 4 khung bằng nhau.
  // - Nếu số câu từ 20 trở xuống: mỗi khung luôn có 5 câu (tổng 20 vị trí).
  // - Nếu trên 20 câu: làm tròn tổng số vị trí lên bội số của 4 rồi chia đều cho 4 khung.
  //   Ví dụ: 23 câu -> 24 vị trí -> mỗi khung 6 câu.
  const cols=4;
  const displayCount=t.mcCount<=20?20:Math.ceil(t.mcCount/4)*4;
  const perCol=displayCount/4;
  const counts=[perCol,perCol,perCol,perCol];
  const gap=8,groupW=(width-gap*(cols-1))/cols,rowH=14,headH=21;

  const groupH=headH+perCol*rowH+6;
  let qStart=0;

  for(let c=0;c<cols;c++){
    const gx=left+c*(groupW+gap),count=counts[c];
    const optionXs=Array.from({length:4},(_,j)=>gx+40+(j+.5)*(groupW-48)/4);
    L.mcGroups.push({x:gx,y,w:groupW,h:groupH,optionXs});
    for(let r=0;r<count;r++){
      const qi=qStart+r,yy=y+headH+r*rowH+7;
      L.mc.push({
        q:qi+1,
        active:qi<t.mcCount,
        x:gx+7,
        y:yy,
        opts:['A','B','C','D'].map((lab,j)=>({label:lab,x:optionXs[j],y:yy}))
      })
    }
    qStart+=count;
  }
  L.mcDisplayCount=displayCount;
  y+=groupH+sectionGap;
}

if(t.tfCount){
  L.titles.push({text:'PHẦN II. ĐÚNG / SAI — Mỗi ý đúng được '+t.tfItemScore.toFixed(2)+' điểm',y});
  y+=18;

  // Mỗi câu là một khung riêng. Tối đa 4 câu/hàng.
  // Các khung trong cùng hàng luôn bằng nhau; hàng cuối tự căn giữa.
  const maxPerRow=Math.min(4,t.tfCount),gap=8,groupH=88,rows=Math.ceil(t.tfCount/maxPerRow);

  for(let row=0;row<rows;row++){
    const first=row*maxPerRow;
    const itemsInRow=Math.min(maxPerRow,t.tfCount-first);
    const groupW=(width-gap*(maxPerRow-1))/maxPerRow;
    const rowWidth=itemsInRow*groupW+(itemsInRow-1)*gap;
    const rowLeft=left+(width-rowWidth)/2;

    for(let c=0;c<itemsInRow;c++){
      const qi=first+c;
      const gx=rowLeft+c*(groupW+gap);
      const gy=y+row*(groupH+7);
      const qw=groupW;

      // Dùng lưới 3 cột đều nhau trong mỗi khung:
      // cột 1 = nhãn a/b/c/d, cột 2 = Đúng, cột 3 = Sai.
      // Như vậy khoảng cách giữa nhãn và 2 cột ô sẽ cân bằng hơn.
      const innerPad=22;
      const innerW=qw-innerPad*2;
      const labelCenter=gx+innerPad+innerW*(1/6);
      const trueCenter =gx+innerPad+innerW*(3/6);
      const falseCenter=gx+innerPad+innerW*(5/6);
      const labelX=labelCenter-10; // tfItemLabel rộng 20px
      const tx=trueCenter;
      const sx=falseCenter;
      const items=[];

      for(let j=0;j<4;j++){
        const iy=gy+35+j*14;
        items.push({
          item:'abcd'[j],
          labelX,
          d:{x:tx,y:iy,label:'Đ'},
          s:{x:sx,y:iy,label:'S'}
        })
      }

      L.tfGroups.push({x:gx,y:gy,w:groupW,h:groupH,qCount:1});
      L.tf.push({q:qi+1,x:gx,y:gy,w:qw,trueX:tx,falseX:sx,items});
    }
  }

  y+=rows*(groupH+7)-7+sectionGap;
}

if(t.shortCount){
  L.titles.push({text:'PHẦN III. TRẢ LỜI NGẮN — Tô theo ô đáp án và bảng số',y});
  y+=18;
  // v4.17: Phần III dùng cùng chuẩn hình học với Phần I.
  // - Vòng tròn: 12px (render dùng .bubble chung của Phần I)
  // - Khoảng cách tâm theo chiều dọc: 14px
  // Điều này giúp các hàng không dính nhau và engine OMR dùng cùng bán kính đo như Phần I.
  const maxPerRow=t.shortLen<=4?6:5,gap=5,shortRowH=14,blockH=214,rows=Math.ceil(t.shortCount/maxPerRow);
  for(let row=0;row<rows;row++){
    const first=row*maxPerRow,itemsInRow=Math.min(maxPerRow,t.shortCount-first);
    const blockW=(width-gap*(itemsInRow-1))/itemsInRow;
    const rowWidth=itemsInRow*blockW+(itemsInRow-1)*gap;
    const rowLeft=left+(width-rowWidth)/2;
    for(let c=0;c<itemsInRow;c++){
      const q=first+c,bx=rowLeft+c*(blockW+gap),by=y+row*(blockH+6),innerLeft=bx+27,innerRight=bx+blockW-10,digitXs=[];
      for(let p=0;p<t.shortLen;p++)digitXs.push(innerLeft+(p+.5)*(innerRight-innerLeft)/t.shortLen);
      const sign={x:digitXs[0],y:by+45},commas=[];
      if(t.shortLen>=2)commas.push({gap:2,x:digitXs[1],y:by+45+shortRowH});if(t.shortLen>=3)commas.push({gap:3,x:digitXs[2],y:by+45+shortRowH});
      const digitStartY=by+45+shortRowH*2;
      const digits=digitXs.map((x,p)=>({pos:p+1,x,vals:Array.from({length:10},(_,d)=>({label:String(d),x,y:digitStartY+d*shortRowH}))}));
      L.short.push({q:q+1,x:bx,y:by,w:blockW,h:blockH,digitXs,sign,commas,digits})
    }
  }
  y+=rows*(blockH+6)-6+sectionGap;
}

/* Tự động nén theo chiều dọc nếu nội dung vượt vùng in.
   Tọa độ OMR và hình vẽ cùng dùng một layout nên vẫn đồng bộ khi chấm. */
const available=Hh-end-start,natural=Math.max(1,y-start);
if(natural>available){
  const s=Math.max(.78,(available-3)/natural);
  const sy=v=>start+(v-start)*s;
  L.titles.forEach(o=>o.y=sy(o.y));
  L.mcGroups.forEach(o=>{o.y=sy(o.y);o.h*=s});
  L.mc.forEach(o=>{o.y=sy(o.y);o.opts.forEach(a=>a.y=sy(a.y))});
  L.tfGroups.forEach(o=>{o.y=sy(o.y);o.h*=s});
  L.tf.forEach(o=>{o.y=sy(o.y);o.items.forEach(a=>{a.d.y=sy(a.d.y);a.s.y=sy(a.s.y)})});
  L.short.forEach(o=>{o.y=sy(o.y);o.h*=s;o.sign.y=sy(o.sign.y);o.commas.forEach(a=>a.y=sy(a.y));o.digits.forEach(c=>c.vals.forEach(a=>a.y=sy(a.y)))});
  y=start+natural*s;
}
L.contentBottom=y;
L.overflow=y>Hh-end+1;
return L
}
function renderMiniSquares(n,cls='writeSquare'){return `<span class="writeSquares">${Array.from({length:n},()=>`<span class="${cls}"></span>`).join('')}</span>`}
function renderSerialSquares(n=2){return `<span class="serialSquares">${Array.from({length:n},()=>'<span class="serialSquare"></span>').join('')}</span>`}
function renderGuideBox(top,t){const idLabel=candidateLabelForTemplate(t),items=['Điền đầy đủ thông tin ở đầu phiếu theo hướng dẫn của giám thị.',`Ghi ${idLabel==='SBD'?'SBD':'Số hiệu'} vào 3 ô vuông và tô đúng 3 chữ số ở khung nhận dạng.`,'Ghi mã đề vào các ô vuông và tô mã đề ở khung bên cạnh.'];if(t.mcCount)items.push('Phần I: mỗi câu chỉ tô 1 ô A, B, C hoặc D.');if(t.tfCount)items.push('Phần II: mỗi ý chỉ tô 1 ô Đ hoặc S.');if(t.shortCount)items.push('Phần III: tô dấu âm (nếu có), vị trí dấu phẩy và từng chữ số của đáp án.');items.push('Tô kín ô, không gạch chéo, không làm nhàu hoặc gấp phiếu.');return `<div class="guideBox" data-items="${items.length}" style="--guide-top:${top}px"><div class="guideTitle">HƯỚNG DẪN HỌC SINH SỬ DỤNG PHIẾU</div><ol>${items.map(x=>`<li>${x}</li>`).join('')}</ol></div>`}
function renderIdBlock(title,cols,box,writeCount=0){let h=`<div class="idBlockV43" style="left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px"><div class="idTitleV43">${title}</div><div class="idGridOutline"></div>`;if(writeCount>0){cols.slice(0,writeCount).forEach(c=>h+=`<span class="idWriteBoxV43" style="left:${c.x-box.x}px;top:42px"></span>`)}cols.forEach(c=>c.vals.forEach(v=>{h+=`<span class="idDigitLabelV43" style="left:${v.x-box.x-5}px;top:${v.y-box.y}px">${v.label}</span><span class="idBubbleV43" style="left:${v.x-box.x}px;top:${v.y-box.y}px"></span>`}));return h+'</div>'}
function renderReviewRow(t,top){let score='';if(t.examForm==='mixed'){score=`<table class="scoreTable mixed"><tr class="scoreTitleRow"><th colspan="3">ĐIỂM</th></tr><tr class="scoreLabelRow"><th>Trắc nghiệm</th><th>Tự luận</th><th>Tổng điểm</th></tr><tr class="scoreWriteRow"><td></td><td></td><td></td></tr></table>`}else{score=`<table class="scoreTable objective"><tr class="scoreTitleRow"><th>ĐIỂM</th></tr><tr class="scoreWriteRow"><td></td></tr></table>`}const count=Math.max(1,Math.min(3,Number(t.examinerCount)||1)),totalH=187,gap=8;let scoreH,sigH;if(count===1){scoreH=t.examForm==='mixed'?88:84;sigH=totalH-scoreH-gap}else if(count===2){scoreH=t.examForm==='mixed'?66:62;sigH=Math.floor((totalH-scoreH-gap*2)/2)}else{scoreH=t.examForm==='mixed'?58:54;sigH=Math.floor((totalH-scoreH-gap*3)/3)}const sig=count===1?`<div class="sigBox" style="height:${sigH}px">CHỮ KÝ GIÁM KHẢO</div>`:Array.from({length:count},(_,i)=>`<div class="sigBox" style="height:${sigH}px">CHỮ KÝ GIÁM KHẢO ${i+1}</div>`).join('');return `<div class="reviewStack" style="--review-top:${top}px"><div class="scorePanel" style="height:${scoreH}px">${score}</div><div class="signaturePanel n${count}" style="margin-top:${gap}px;gap:${gap}px">${sig}</div></div>`}
function renderEssayPages(t){const box=$('#essayPages');if(!box)return;box.innerHTML='';if(!t||t.examForm!=='mixed')return;const total=Math.max(2,Math.min(6,+t.totalPages||2)),gap=Math.max(1,Math.min(12,+t.essayLineSpacing||9)),pxPerMm=1123/297;for(let pg=2;pg<=total;pg++){const cut=t.cut==='cut',topPx=cut?318:112,bottomPx=48,usableMm=(1123-topPx-bottomPx)/pxPerMm,lineCount=Math.max(1,Math.floor(usableMm/gap)),page=document.createElement('div');page.className='essayPage'+(cut?' cutEssay':'');const cutPart=cut?`<div class="essayPhachWarning">HỌC SINH KHÔNG ĐƯỢC GHI VÀO PHẦN NÀY,<br>VÌ ĐÂY LÀ PHÁCH SẼ RỌC ĐI MẤT</div><div class="essayCutLine"><span>✂ CẮT THEO ĐƯỜNG NÀY</span></div>`:'';const meta=cut?'':`<div class="essayMeta"><span>Họ và tên: ............................................................</span><span style="text-align:right">Lớp: ............... &nbsp;&nbsp; Mã đề: ............</span></div>`;page.innerHTML=`${cutPart}<div class="essayPageTitle">PHẦN BÀI LÀM TỰ LUẬN</div>${meta}<div class="essayLines">${Array.from({length:lineCount},()=>`<div class="essayLine" style="height:${gap}mm"></div>`).join('')}</div><div class="essayPageNo">Trang ${pg}/${total}</div>`;box.appendChild(page)}}
function autoFitGuideBox(){
 const box=document.querySelector('#sheet .guideBox');if(!box)return;
 const title=box.querySelector('.guideTitle'),ol=box.querySelector('ol'),count=+box.dataset.items||ol.children.length;
 let fs=count>=6?9.3:count===5?10.0:10.8;
 let lh=count>=6?1.24:count===5?1.30:1.36;
 box.style.fontSize=fs+'px';box.style.lineHeight=lh;
 title.style.fontSize=(count>=6?10.2:11)+'px';
 ol.style.justifyContent=count>=6?'space-between':'space-evenly';
 let guard=0;
 while(box.scrollHeight>box.clientHeight+1&&fs>8.2&&guard++<20){
   fs-=.18;lh=Math.max(1.16,lh-.015);
   box.style.fontSize=fs+'px';box.style.lineHeight=lh;
 }
 /* Nếu còn nhiều khoảng trống thì tăng nhẹ trở lại, nhưng tuyệt đối không vượt khung. */
 guard=0;
 while(box.scrollHeight<box.clientHeight-10&&fs<11.2&&guard++<12){
   const old=fs;fs+=.12;box.style.fontSize=fs+'px';
   if(box.scrollHeight>box.clientHeight){fs=old;box.style.fontSize=fs+'px';break}
 }
}


function renderInlineEssayPage1(t,L){
  if(!t||t.examForm!=='mixed')return '';
  const gapMm=Math.max(1,Math.min(12,+t.essayLineSpacing||9));
  const pxPerMm=1123/297;
  const gapPx=gapMm*pxPerMm;
  const top=Math.ceil((L.contentBottom||0)+4);
  const titleH=24;
  const lineStart=top+titleH;
  const bottom=1062; // chừa vùng marker dưới và lề in
  const available=bottom-lineStart;
  const lineCount=Math.max(0,Math.floor(available/gapPx));
  if(lineCount<1)return '';
  let h=`<div class="inlineEssayTitle" style="top:${top}px">PHẦN BÀI LÀM TỰ LUẬN</div>`;
  for(let i=1;i<=lineCount;i++){
    const y=lineStart+i*gapPx;
    h+=`<div class="inlineEssayLine" style="top:${y}px"></div>`;
  }
  return h;
}

function renderSheet(){const t=cur($('#printTpl').value)||templates[0],sh=$('#sheet');if(!t){sh.innerHTML='';return}$('#printTpl').value=t.id;const L=buildLayout(t),codeLen=t.versions[0].code.length,showRoom=showRoomField(t),frequent=isFrequentTest(t),candidateLabel=candidateLabelForTemplate(t);$('#capacityWarning').style.display=L.overflow?'block':'none';$('#capacityWarning').textContent=L.overflow?'Mẫu này quá dày cho một trang A4. Hãy giảm số câu hoặc số vị trí trả lời ngắn.':'';const giamsat=frequent?'':`<div class="sigInline"><span class="sigLine">Chữ ký giám thị 1:<span class="sigFill"></span></span><span class="sigLine">Chữ ký giám thị 2:<span class="sigFill"></span></span></div>`;let h=`<svg class="marker m1" viewBox="0 0 26 26" width="26" height="26" aria-hidden="true"><rect x="0" y="0" width="26" height="26"/></svg><svg class="marker m2" viewBox="0 0 26 26" width="26" height="26" aria-hidden="true"><rect x="0" y="0" width="26" height="26"/></svg><svg class="marker m3" viewBox="0 0 26 26" width="26" height="26" aria-hidden="true"><rect x="0" y="0" width="26" height="26"/></svg><svg class="marker m4" viewBox="0 0 26 26" width="26" height="26" aria-hidden="true"><rect x="0" y="0" width="26" height="26"/></svg>${AUTO_OMR_V2.auxRows.flatMap((yy,ri)=>AUTO_OMR_V2.auxX.map((xx,si)=>`<svg class="auxMarker" data-row="${ri}" data-side="${si}" style="left:${xx-AUTO_OMR_V2.auxSize/2}px;top:${yy-AUTO_OMR_V2.auxSize/2}px" viewBox="0 0 ${AUTO_OMR_V2.auxSize} ${AUTO_OMR_V2.auxSize}" width="${AUTO_OMR_V2.auxSize}" height="${AUTO_OMR_V2.auxSize}" aria-hidden="true"><rect x="0" y="0" width="${AUTO_OMR_V2.auxSize}" height="${AUTO_OMR_V2.auxSize}"/></svg>`)).join('')}${t.testName?`<div class="examHeading">${esc(t.testName.toUpperCase())}</div>`:''}${(t.subject||t.duration)?`<div class="examSubHeading">${t.subject?`MÔN: ${esc(String(t.subject).toUpperCase())}`:''}${t.subject&&t.duration?' &nbsp; • &nbsp; ':''}${t.duration?`THỜI GIAN: ${esc(t.duration)} PHÚT`:''}</div>`:''}<div class="title">PHIẾU TRẢ LỜI TRẮC NGHIỆM</div>`;if(t.cut==='cut'){
  const cutStudentInfo=frequent
    ?`<div class="infoRow freqName"><span>Họ và tên:</span><span class="infoFill name"></span></div><div class="infoRow freqClass"><span>Lớp:</span><span class="infoFill cls"></span><span>${candidateLabel==='SBD'?'SBD':'Số hiệu'}:</span><span class="infoFill code"></span></div>`
    :`<div class="infoRow"><span>Họ và tên:</span><span class="infoFill name"></span><span>Lớp:</span><span class="infoFill cls"></span><span>${candidateLabel==='SBD'?'SBD':'Số hiệu'}:</span><span class="infoFill code"></span></div>${showRoom?`<div class="infoRow"><span>Phòng thi:</span><span class="infoFill room"></span></div>`:''}`;
  h+=`<div class="cutStub"><div class="schoolRow"><span class="schoolValue">${esc(t.schoolName||'........................................................')}</span></div>${cutStudentInfo}<div class="phachRow"><span class="phachLabel phach">Mã phách:</span><span class="dotsField"></span><span class="phachLabel stt">Số thứ tự:</span>${renderSerialSquares(2)}<span class="phachLabel made">Mã đề:</span>${renderMiniSquares(codeLen)}</div>${giamsat}</div><div class="cutLine"><span>✂ CẮT THEO ĐƯỜNG NÀY</span></div><div class="anonBox"><div class="phachRow"><span class="phachLabel phach">Mã phách:</span><span class="dotsField short"></span><span class="phachLabel stt">Số thứ tự:</span>${renderSerialSquares(2)}<span class="phachSpacer"></span></div></div>`;
}else{
  const normalStudentInfo=frequent
    ?`<div class="infoRow freqName"><span>Họ và tên:</span><span class="infoFill name"></span></div><div class="infoRow freqClass"><span>Lớp:</span><span class="infoFill cls"></span><span>${candidateLabel==='SBD'?'SBD':'Số hiệu'}:</span><span class="infoFill code"></span></div><div class="infoRow freqCode"><span>Mã đề:</span>${renderMiniSquares(codeLen)}</div>`
    :`<div class="infoRow"><span>Họ và tên:</span><span class="infoFill name"></span><span>Lớp:</span><span class="infoFill cls"></span><span>${candidateLabel==='SBD'?'SBD':'Số hiệu'}:</span><span class="infoFill code"></span></div><div class="infoRow">${showRoom?`<span>Phòng thi:</span><span class="infoFill room"></span>`:''}<span>Mã đề:</span>${renderMiniSquares(codeLen)}</div>${giamsat}`;
  h+=`<div class="infoBox"><div class="schoolRow"><span class="schoolValue">${esc(t.schoolName||'........................................................')}</span></div>${normalStudentInfo}</div>`;
}h+=renderGuideBox(L.idTop,t);h+=renderIdBlock(candidateLabel==='SBD'?'TÔ SBD':'TÔ SỐ HIỆU',L.id,L.idBox,3);h+=renderIdBlock('TÔ MÃ ĐỀ',L.exam,L.examBox,codeLen);h+=renderReviewRow(t,L.reviewTop);L.titles.forEach(x=>h+=`<div class="sheetSecTitle" style="top:${x.y}px">${x.text}</div>`);
L.mcGroups.forEach(g=>{h+=`<div class="mcGroup" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px">${g.optionXs.map((x,j)=>`<span class="mcHeadLetter" style="left:${x-g.x}px">${'ABCD'[j]}</span>`).join('')}</div>`});L.mc.forEach(q=>{h+=`<span class="mcNum" style="left:${q.x}px;top:${q.y-6}px">${q.q}</span>`;q.opts.forEach(o=>h+=`<span class="bubble" style="position:absolute;left:${o.x-6}px;top:${o.y-6}px"></span>`)});
L.tfGroups.forEach(g=>{h+=`<div class="tfGroup" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px"></div>`});L.tf.forEach(q=>{h+=`<div class="tfQTitle" style="left:${q.x}px;top:${q.y+4}px;width:${q.w}px">Câu ${q.q}</div><span class="tfColHead" style="left:${q.trueX}px;top:${q.y+18}px">Đúng</span><span class="tfColHead" style="left:${q.falseX}px;top:${q.y+18}px">Sai</span>`;q.items.forEach((it,j)=>{h+=`<span class="tfItemLabel" style="left:${it.labelX}px;top:${it.d.y-6}px">${it.item})</span><span class="bubble tfBubble" style="position:absolute;left:${it.d.x-6}px;top:${it.d.y-6}px"></span><span class="bubble tfBubble" style="position:absolute;left:${it.s.x-6}px;top:${it.s.y-6}px"></span>`})});
L.short.forEach(q=>{h+=`<div class="shortBlock" style="left:${q.x}px;top:${q.y}px;width:${q.w}px;height:${q.h}px"><div class="shortHead">Câu ${q.q}</div>${q.digitXs.map(x=>`<span class="shortWriteBox" style="left:${x-q.x-8.5}px;top:22px"></span>`).join('')}<span class="shortRowLabel" style="top:${q.sign.y-q.y}px">−</span><span class="shortRowLabel" style="top:${q.commas.length?q.commas[0].y-q.y:59}px">,</span>${q.digits[0].vals.map(v=>`<span class="shortRowLabel" style="top:${v.y-q.y}px">${v.label}</span>`).join('')}</div>`;h+=`<span class="bubble" style="position:absolute;left:${q.sign.x-6}px;top:${q.sign.y-6}px"></span>`;q.commas.forEach(c=>h+=`<span class="bubble" style="position:absolute;left:${c.x-6}px;top:${c.y-6}px"></span>`);q.digits.forEach(c=>c.vals.forEach(v=>h+=`<span class="bubble" style="position:absolute;left:${v.x-6}px;top:${v.y-6}px"></span>`))});h+=renderInlineEssayPage1(t,L);sh.innerHTML=h;const markerCount=sh.querySelectorAll('svg.marker').length,auxCount=sh.querySelectorAll('svg.auxMarker').length;if(markerCount!==4)console.error('OMR corner marker invariant failed:',markerCount);if(auxCount!==6)console.error('OMR v2 auxiliary marker invariant failed:',auxCount);autoFitGuideBox();renderEssayPages(t)}
$('#printTpl').onchange=()=>{renderSheet();setTimeout(fitSheet,0)};

function xmlEsc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
function crc32(bytes){let table=crc32._t;if(!table){table=crc32._t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;table[n]=c>>>0}}let c=0xFFFFFFFF;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function u16(n){return new Uint8Array([n&255,(n>>>8)&255])}
function u32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])}
function concatBytes(parts){const len=parts.reduce((a,b)=>a+b.length,0),out=new Uint8Array(len);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}
function zipStore(files){
  const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;
  for(const f of files){
    const name=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data,crc=crc32(data);
    const local=concatBytes([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);
    locals.push(local);
    const central=concatBytes([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
    centrals.push(central);offset+=local.length;
  }
  const cd=concatBytes(centrals),body=concatBytes(locals);
  const end=concatBytes([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cd.length),u32(body.length),u16(0)]);
  return new Blob([body,cd,end],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
function wText(text,bold=false,size=21,align='left'){
  const jc=align?`<w:jc w:val="${align}"/>`:'';
  return `<w:p><w:pPr>${jc}<w:spacing w:after="40"/></w:pPr><w:r><w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`;
}
function wCell(inner,width=3000,shade=''){
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shade?`<w:shd w:fill="${shade}"/>`:''}<w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr>${inner}</w:tc>`;
}
function wTable(rows,widths=[]){
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="8" w:color="333333"/><w:left w:val="single" w:sz="8" w:color="333333"/><w:bottom w:val="single" w:sz="8" w:color="333333"/><w:right w:val="single" w:sz="8" w:color="333333"/><w:insideH w:val="single" w:sz="4" w:color="AAAAAA"/><w:insideV w:val="single" w:sz="4" w:color="AAAAAA"/></w:tblBorders></w:tblPr>${rows.map(r=>`<w:tr>${r.map((c,i)=>wCell(c,widths[i]||3000)).join('')}</w:tr>`).join('')}</w:tbl>`;
}
function docxQuestionLines(t){let out='';if(t.mcCount){out+=wText('PHẦN I. TRẮC NGHIỆM 4 LỰA CHỌN — Chọn A, B, C hoặc D',true,21);const cols=4,displayCount=t.mcCount<=20?20:Math.ceil(t.mcCount/4)*4,perCol=displayCount/4,counts=[perCol,perCol,perCol,perCol];const cells=[];let qStart=0;for(let c=0;c<cols;c++){let cell=wText('      A        B        C        D',true,16,'center');for(let r=0;r<counts[c];r++)cell+=wText(`${qStart+r+1}.    ○        ○        ○        ○`,false,16);cells.push(cell);qStart+=counts[c]}out+=wTable([cells],Array(cols).fill(Math.floor(9600/cols)))}if(t.tfCount){out+=wText(`PHẦN II. ĐÚNG / SAI — Mỗi ý đúng được ${Number(t.tfItemScore).toFixed(2)} điểm`,true,21);const per=Math.min(4,t.tfCount);for(let base=0;base<t.tfCount;base+=per){const count=Math.min(per,t.tfCount-base),cells=[];for(let i=0;i<count;i++){const q=base+i+1;let c=wText(`Câu ${q}`,true,16,'center')+wText(`          Đúng       Sai`,true,14,'center');['a','b','c','d'].forEach(x=>c+=wText(`${x})           ○          ○`,false,16));cells.push(c)}out+=wTable([cells],Array(count).fill(Math.floor(9600/count)))}}if(t.shortCount){out+=wText('PHẦN III. TRẢ LỜI NGẮN',true,21);const per=Math.min(6,t.shortCount);for(let base=0;base<t.shortCount;base+=per){const cells=[];for(let i=0;i<per&&base+i<t.shortCount;i++){let c=wText(`Câu ${base+i+1}`,true,16,'center')+wText(Array.from({length:t.shortLen},()=> '□').join('  '),false,18,'center')+wText('−      ○',false,15)+wText(',    ○  ○  ○',false,15);for(let d=0;d<=9;d++)c+=wText(`${d}   ○  ○  ○  ○`,false,15);cells.push(c)}out+=wTable([cells],Array(cells.length).fill(Math.floor(9600/cells.length)))}}return out}
function buildDocxXml(t){
  normalizeTemplate(t);
  const codeLen=t.versions[0].code.length,codeBoxes='□ '.repeat(codeLen).trim(),showRoom=showRoomField(t),candidateLabel=candidateLabelForTemplate(t);
  const idBoxes='□ □ □',idCircles='○ ○ ○',codeCircles=Array.from({length:codeLen},()=> '○').join(' '),idMatrixRows=Array.from({length:10},(_,d)=>`${d} ${idCircles}          ${d} ${codeCircles}`).join('\n');
  const guide=['Điền đầy đủ thông tin ở đầu phiếu theo hướng dẫn của giám thị.',`Ghi ${candidateLabel==='SBD'?'SBD':'Số hiệu'} vào 3 ô vuông và tô đủ 3 chữ số.`, 'Ghi mã đề vào các ô vuông và tô mã đề.'];
  if(t.mcCount)guide.push('Phần I: mỗi câu chỉ chọn một đáp án A, B, C hoặc D.');
  if(t.tfCount)guide.push('Phần II: mỗi ý chỉ chọn Đúng hoặc Sai.');
  if(t.shortCount)guide.push('Phần III: ghi/tô đáp án trả lời ngắn theo mẫu.');
  guide.push('Giữ phiếu sạch, phẳng, không gấp hoặc làm nhàu.');
  let body='';
  body+=wText((t.testName||'').toUpperCase(),true,24,'center');
  body+=wText(`${t.subject?`MÔN: ${String(t.subject).toUpperCase()}`:''}${t.subject&&t.duration?'  •  ':''}${t.duration?`THỜI GIAN: ${t.duration} PHÚT`:''}`,true,21,'center');
  body+=wText('PHIẾU TRẢ LỜI TRẮC NGHIỆM',true,30,'center');
  const frequent=isFrequentTest(t);
  if(frequent){
    const info=wText((t.schoolName||'').toUpperCase(),true,21)+wText('Họ và tên: ................................................................................................',false,20)+wText(`Lớp: ..............................        ${candidateLabel}: ..............................`,false,20)+wText(`Mã đề: ${codeBoxes}`,false,20);
    body+=wTable([[info]],[9600]);
  }else{
    body+=wTable([
      [wText((t.schoolName||'').toUpperCase(),true,21),wText('Họ và tên: ........................................................',false,20)],
      [wText(`Lớp: ....................   ${candidateLabel}: ....................`,false,20),wText(`${showRoom?'Phòng thi: ....................   ':''}Mã đề: ${codeBoxes}`,false,20)]
    ],[4800,4800]);
  }
  if(t.cut==='cut'){
    body+=wTable([[wText('Mã phách: ....................................',false,20),wText('Số thứ tự: □ □',false,20)]],[4800,4800]);
    body+=wText('✂  CẮT THEO ĐƯỜNG NÀY  ✂',false,18,'center');
    body+=wTable([[wText('Mã phách: ....................................',false,20),wText('Số thứ tự: □ □',false,20)]],[4800,4800]);
  }
  if(!frequent)body+=wText('Chữ ký giám thị 1: ........................................        Chữ ký giám thị 2: ........................................',false,18);
  body+=wTable([[guide.map((x,i)=>wText(`${i+1}. ${x}`,false,18)).join(''),wText(`TÔ ${candidateLabel}     |     TÔ MÃ ĐỀ\n\n${idBoxes}          ${codeBoxes}\n\n${idMatrixRows}`,true,17,'center')]],[4800,4800]);
  let scoreCell=t.examForm==='mixed'
    ?wText('ĐIỂM',true,18,'center')+wText('Trắc nghiệm: ............   Tự luận: ............',false,18,'center')+wText('TỔNG ĐIỂM: ............',true,18,'center')
    :wText('ĐIỂM',true,18,'center')+wText('....................',false,22,'center');
  const n=Math.max(1,Math.min(3,Number(t.examinerCount)||1));
  let sig=Array.from({length:n},(_,i)=>wText(n===1?'CHỮ KÝ GIÁM KHẢO':`CHỮ KÝ GIÁM KHẢO ${i+1}`,true,17,'center')+wText('\n\n\n',false,17)).join('');
  body+=wTable([[scoreCell,sig]],[3200,6400]);
  body+=docxQuestionLines(t);
  if(t.examForm==='mixed'){
    const L1=buildLayout(t),gap1=Math.max(1,Math.min(12,+t.essayLineSpacing||9)),pxPerMm1=1123/297,top1=(L1.contentBottom||0)+28,bottom1=1062,firstLines=Math.max(0,Math.floor(((bottom1-top1)/pxPerMm1)/gap1)),lineTwips1=Math.round(gap1/25.4*1440);
    if(firstLines>0){
      body+=wText('PHẦN BÀI LÀM TỰ LUẬN',true,22,'center');
      for(let i=0;i<firstLines;i++){
        body+=`<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${lineTwips1}" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>............................................................................................................................................................................................</w:t></w:r></w:p>`;
      }
    }
  }
  if(t.examForm==='mixed'){const total=Math.max(2,Math.min(6,+t.totalPages||2)),gap=Math.max(1,Math.min(12,+t.essayLineSpacing||9)),lineTwips=Math.round(gap/25.4*1440),normalLines=Math.floor(255/gap),cutLines=Math.floor(200/gap);for(let pg=2;pg<=total;pg++){body+=`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;if(t.cut==='cut'){body+=wTable([[wText('HỌC SINH KHÔNG ĐƯỢC GHI VÀO PHẦN NÀY,\nVÌ ĐÂY LÀ PHÁCH SẼ RỌC ĐI MẤT',true,22,'center')]],[9600]);body+=wText('✂  CẮT THEO ĐƯỜNG NÀY  ✂',false,18,'center');body+=wText('PHẦN BÀI LÀM TỰ LUẬN',true,24,'center');for(let i=0;i<cutLines;i++){body+=`<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${lineTwips}" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>............................................................................................................................................................................................</w:t></w:r></w:p>`}}else{body+=wText('PHẦN BÀI LÀM TỰ LUẬN',true,24,'center');body+=wText('Họ và tên: ............................................................        Lớp: ...............        Mã đề: ............',false,19);for(let i=0;i<normalLines;i++){body+=`<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${lineTwips}" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>............................................................................................................................................................................................</w:t></w:r></w:p>`}}body+=wText(`Trang ${pg}/${total}`,false,16,'center')}}
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}
function exportDocx(){
  const t=cur($('#printTpl').value)||templates[0];if(!t){alert('Chưa có mẫu phiếu để xuất.');return}
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const blob=zipStore([{name:'[Content_Types].xml',data:contentTypes},{name:'_rels/.rels',data:rels},{name:'word/document.xml',data:buildDocxXml(t)}]);
  const safe=((t.testName||t.name||'phieu_trac_nghiem').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,'_')).slice(0,80);
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${safe}.docx`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800);
}
$('#exportDocxBtn').onclick=exportDocx;


$('#saveTeacherProfile').onclick=async()=>{
  const p=collectProfileForm();saveLocalProfile(p);setScoped(LS_IMG_MODE,p.imageMode);setScoped(LS_IMG_RET,String(p.retention));initImageSettings();
  if(currentUser)await syncCloudNow(false);alert('Đã lưu hồ sơ cá nhân giáo viên.');
};
$('#applyTeacherDefaults').onclick=()=>{currentProfile=collectProfileForm();saveLocalProfile(currentProfile);applyProfileDefaults();alert('Đã áp dụng thông tin mặc định vào form tạo mẫu mới.')};
$('#syncCloudNow').onclick=()=>syncCloudNow(true);
$('#importLegacyToTeacher').onclick=importLegacyDataToCurrentTeacher;
$('#selfResetPassword').onclick=selfPasswordReset;
$('#gateLogin').onclick=async()=>{
  if(!firebaseCtx){$('#gateStatus').textContent='Không kết nối được hệ thống Firebase.';return}
  const email=$('#gateEmail').value.trim(),pass=$('#gatePassword').value;
  if(!email||!pass){$('#gateStatus').textContent='Vui lòng nhập email và mật khẩu.';return}
  $('#gateStatus').textContent='Đang đăng nhập…';
  try{await firebaseModules.auth.signInWithEmailAndPassword(firebaseCtx.auth,email,pass);$('#gateStatus').textContent='Đang tải dữ liệu tài khoản…'}
  catch(e){$('#gateStatus').textContent=friendlyFirebaseError(e)}
};
$('#gatePassword').addEventListener('keydown',e=>{if(e.key==='Enter')$('#gateLogin').click()});
$('#gateForgotPassword').onclick=async()=>{
  const email=$('#gateEmail').value.trim();
  if(!email){$('#gateStatus').textContent='Nhập email trước khi yêu cầu đổi mật khẩu.';return}
  if(!firebaseCtx){$('#gateStatus').textContent='Không kết nối được hệ thống.';return}
  try{await firebaseModules.auth.sendPasswordResetEmail(firebaseCtx.auth,email);$('#gateStatus').textContent='Đã gửi email đổi mật khẩu. Hãy kiểm tra hộp thư.'}
  catch(e){$('#gateStatus').textContent=friendlyFirebaseError(e)}
};
$('#headerLogoutBtn').onclick=logoutToLogin;
$('#headerAccountChip').onclick=()=>{const b=document.querySelector('.tabs button[data-tab="account"]');if(b)b.click()};

$('#adminCreateTeacher').onclick=createTeacherAuthByAdmin;
$('#adminActivateExisting').onclick=activateExistingTeacher;
$('#refreshAdminDashboard').onclick=loadAdminDashboard;
$('#adminTeacherSearch').oninput=renderAdminTeacherTable;
$('#exportSchoolExcel').onclick=exportSchoolExcel;
$('#exportSchoolPdf').onclick=exportSchoolPdf;
$('#closeAdminTeacherDetail').onclick=closeAdminTeacherDetail;
$('#closeAdminTeacherDetail2').onclick=closeAdminTeacherDetail;
$('#adminTeacherDetail').onclick=e=>{if(e.target===$('#adminTeacherDetail'))closeAdminTeacherDetail()};
$('#detailSubjectFilter').onchange=renderAdminDetailHistory;
$('#detailTargetFilter').onchange=renderAdminDetailHistory;
$('#detailClearFilter').onclick=()=>{$('#detailSubjectFilter').value='';$('#detailTargetFilter').value='';renderAdminDetailHistory()};
$('#detailTeacherBackup').onclick=()=>{if(adminDetailUid)downloadTeacherBackup(adminDetailUid)};
$('#detailTeacherResetPassword').onclick=()=>{if(adminDetailUid)sendTeacherPasswordReset(adminDetailUid)};


document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#panel-'+b.dataset.tab).classList.add('active');if(b.dataset.tab==='print')setTimeout(fitSheet,20);if(b.dataset.tab==='account')renderAccountState();if(b.dataset.tab==='key'){syncShareMetaFromTemplate();loadSharedAnswerLibrary()}if(b.dataset.tab==='admin'&&currentIsAdmin)loadAdminDashboard()});function fitSheet(){const vp=$('#sheetViewport'),sh=$('#sheet');if(!vp||!sh)return;const sc=Math.min(1,(vp.clientWidth-24)/794);sh.style.transform=`scale(${sc})`;sh.style.marginBottom=`${1123*(sc-1)}px`;document.querySelectorAll('.essayPage').forEach(pg=>{pg.style.transform=`scale(${sc})`;pg.style.transformOrigin='top left';pg.style.marginBottom=`${1123*(sc-1)+16}px`})}


function refreshScanAssignments(){
  const source=$('#scanSource'),ctxSel=$('#scanContext'),targetSel=$('#scanTarget'),tplSel=$('#scanTpl'),info=$('#scanAutoInfo'),ctxWrap=$('#scanContextWrap'),targetWrap=$('#scanTargetWrap');
  if(!source||!ctxSel||!targetSel||!tplSel)return;
  cleanupAssignments();
  const contexts=assignmentContexts();
  const oldCtx=ctxSel.value,oldTarget=targetSel.value;
  ctxSel.innerHTML=contexts.map(c=>`<option value="${esc(c.key)}">${esc(c.testName)} • ${esc(c.subject)} • ${c.type==='class'?'Theo lớp':'Theo phòng thi'}</option>`).join('');
  if(contexts.some(c=>c.key===oldCtx))ctxSel.value=oldCtx;
  if(!contexts.length){
    source.value='manual';
    source.querySelector('option[value="assigned"]').disabled=true;
  }else{
    source.querySelector('option[value="assigned"]').disabled=false;
  }
  const assignedMode=source.value==='assigned'&&contexts.length>0;
  ctxWrap.style.display=assignedMode?'block':'none';
  targetWrap.style.display=assignedMode?'block':'none';
  tplSel.disabled=assignedMode;
  if(!assignedMode){
    if(info)info.innerHTML='Chế độ thủ công: tự chọn mẫu cần chấm.';
    return;
  }
  const c=contexts.find(x=>x.key===ctxSel.value)||contexts[0];
  if(!c)return;
  ctxSel.value=c.key;
  const sorted=[...c.targets].sort((a,b)=>{
    if(c.type==='room')return Number(a.target)-Number(b.target);
    const [ga,na]=a.target.split('/').map(Number),[gb,nb]=b.target.split('/').map(Number);
    return ga-gb||na-nb;
  });
  targetSel.innerHTML=sorted.map(x=>`<option value="${esc(x.target)}">${assignmentDisplayTarget(c.type,x.target)}</option>`).join('');
  if(sorted.some(x=>x.target===oldTarget))targetSel.value=oldTarget;
  $('#scanTargetLabel').textContent=c.type==='class'?'Chọn lớp':'Chọn phòng thi';
  applyScanAssignment();
}
function applyScanAssignment(){
  if($('#scanSource').value!=='assigned')return;
  const c=assignmentContexts().find(x=>x.key===$('#scanContext').value);if(!c)return;
  const target=$('#scanTarget').value;
  const item=c.targets.find(x=>x.target===target);if(!item)return;
  const t=cur(item.templateId);if(!t)return;
  $('#scanTpl').value=t.id;
  if($('#detectedIdLabel'))$('#detectedIdLabel').textContent=c.type==='room'?'SBD nhận được':'Số hiệu nhận được';
  $('#scanAutoInfo').innerHTML=`${assignmentDisplayTarget(c.type,target)} → tự dùng mẫu <b>${esc(t.name)}</b> • ${esc(t.testName)} • ${esc(t.subject)} • Mã đề: <b>${t.versions.map(v=>esc(v.code)).join(', ')}</b>.`;
  clearResult();
}
$('#scanSource').onchange=()=>{refreshScanAssignments();clearResult()};
$('#scanContext').onchange=()=>{refreshScanAssignments();clearResult()};
$('#scanTarget').onchange=()=>{applyScanAssignment()};

const canvas=$('#scanCanvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
function setStatus(msg,type=''){const e=$('#scanStatus');e.className='status'+(type?' '+type:'');e.textContent=msg}
function resetScanQuality(){auxMarkerObservations=[];scanQuality=null;localCorrection=null;updateScanQualityUI()}
function updateScanQualityUI(){
  const e=$('#scanQualityBox');if(!e)return;
  if(!scanQuality){e.className='scanQualityBox';e.innerHTML='<b>Auto OMR v2:</b> Chưa kiểm tra chất lượng ảnh.';return}
  const q=scanQuality,cls=q.ok?(q.mode==='v2'?'ok':'warn'):'err';e.className='scanQualityBox '+cls;
  e.innerHTML=`<b>Auto OMR v2:</b> ${esc(q.message)}<div class="scanQualityMetrics"><span>4 marker chính: <b>${q.mainMarkers}/4</b></span><span>Marker phụ: <b>${q.auxCount}/6</b></span><span>Diện tích trang: <b>${Math.round(q.pageAreaRatio*100)}%</b></span><span>Hiệu chỉnh cục bộ: <b>${q.localCorrection?'Có':'Không'}</b></span></div>`;
}

function setLiveStatus(msg,type=''){
  const e=$('#liveCameraStatus');if(e){e.className='liveCameraStatus'+(type?' '+type:'');e.textContent=msg}
  const f=$('#liveFreeStatus');if(f){f.textContent=msg;f.dataset.state=type||''}
}
function setLiveHud(main='--',aux='--',stable=0,state='',exam='---',examOk=false,readyMs=null){
  const a=$('#liveMainMarkerHud'),b=$('#liveAuxMarkerHud'),e=$('#liveExamHud'),c=$('#liveStableHud'),p=$('#liveStableProgress');
  if(a){a.textContent=`Marker góc: ${main}/4`;a.className='liveHudChip '+(main===4?'ok':main==='--'?'':'err')}
  if(b){b.textContent=`Marker phụ: ${aux}/6`;b.className='liveHudChip '+(Number(aux)>=4?'ok':aux==='--'?'':'warn')}
  if(e){e.textContent=`Mã đề: ${exam||'---'}`;e.className='liveHudChip '+(examOk?'ok':exam==='---'?'':'warn')}
  if(Number.isFinite(readyMs)){
    const ms=Math.max(0,Math.min(liveReadyRequiredMs,readyMs));
    const done=ms>=liveReadyRequiredMs&&liveReadyHits>=2;
    if(c){c.textContent=`Tự chấm: ${(ms/1000).toFixed(1)}/${(liveReadyRequiredMs/1000).toFixed(1)}s`;c.className='liveHudChip '+(done?'ok':state==='bad'?'warn':'')}
    if(p)p.style.width=Math.max(0,Math.min(100,ms/liveReadyRequiredMs*100))+'%';
  }else{
    if(c){c.textContent=`Tự chấm: chờ phiếu`;c.className='liveHudChip '+(state==='bad'?'warn':'')}
    if(p)p.style.width='0%';
  }
}
function liveCurrentTrack(){return liveStream?.getVideoTracks?.()[0]||null}
function updateTorchButton(){
  const btn=$('#toggleTorch'),track=liveCurrentTrack();if(!btn)return;
  let supported=false;try{supported=!!track?.getCapabilities?.().torch}catch{}
  btn.disabled=!liveRunning||!supported;btn.textContent=liveTorchOn?'Tắt đèn':'Bật đèn';
}
function stopLiveCamera(keepMessage=false){
  liveRunning=false;liveBusy=false;livePaused=false;liveStableFrames=0;livePrevMarkers=null;liveTorchOn=false;liveExamCode='';liveExamStable=0;liveAutoCooldownUntil=0;liveAwaitRemoval=false;liveRemovalMisses=0;liveCurrentSaved=false;liveResultLocked=false;liveResultLockUntil=0;liveRemovalSince=0;resetLiveReady();
  if(liveTimer){clearTimeout(liveTimer);liveTimer=null}
  if(liveStream){liveStream.getTracks().forEach(t=>{try{t.stop()}catch{}});liveStream=null}
  const video=$('#liveVideo');if(video){try{video.pause()}catch{};video.srcObject=null}
  $('#liveCameraStage')?.classList.remove('open','freeScan');document.body.classList.remove('liveFreeScanOpen');
  if($('#startLiveCamera'))$('#startLiveCamera').disabled=false;
  if($('#stopLiveCamera'))$('#stopLiveCamera').disabled=true;
  if($('#switchLiveCamera'))$('#switchLiveCamera').disabled=true;
  if($('#captureLiveNow'))$('#captureLiveNow').disabled=true;
  if($('#toggleTorch')){$('#toggleTorch').disabled=true;$('#toggleTorch').textContent='Bật đèn'}
  if($('#nextLiveSheet'))$('#nextLiveSheet').style.display='none';
  setLiveHud('--','--',0);
  resetRealtimeResult();if(!keepMessage)setLiveStatus('Camera đã dừng.');
}
function liveMarkerMotion(prev,curr){
  if(!prev||!curr||prev.length!==4||curr.length!==4)return 1;
  const diag=Math.max(1,Math.hypot(canvas.width,canvas.height));
  // Dùng độ dịch chuyển trung vị của 4 marker thay vì marker lệch nhiều nhất.
  // Camera cầm tay và phép tìm tâm marker thường làm 1 góc dao động vài pixel,
  // nếu dùng max thì bộ đếm Giữ yên sẽ bị reset về 0 liên tục dù phiếu đã đọc rất rõ.
  const ds=[];
  for(let i=0;i<4;i++)ds.push(Math.hypot(prev[i].x-curr[i].x,prev[i].y-curr[i].y)/diag);
  ds.sort((a,b)=>a-b);
  const median=(ds[1]+ds[2])/2;
  const pc=prev.reduce((a,p)=>({x:a.x+p.x/4,y:a.y+p.y/4}),{x:0,y:0});
  const cc=curr.reduce((a,p)=>({x:a.x+p.x/4,y:a.y+p.y/4}),{x:0,y:0});
  const center=Math.hypot(pc.x-cc.x,pc.y-cc.y)/diag;
  return Math.max(center,median);
}
function resetLiveReady(){liveReadySince=0;liveReadyLastSeen=0;liveReadyExam='';liveReadyHits=0}
function markLiveReady(examCode){
  const now=Date.now();
  if(!liveReadySince||liveReadyExam!==examCode||(liveReadyLastSeen&&now-liveReadyLastSeen>liveReadyGraceMs)){
    liveReadySince=now;liveReadyExam=examCode;liveReadyHits=1;
  }else liveReadyHits++;
  liveReadyLastSeen=now;
  return Math.max(0,now-liveReadySince);
}
function holdLiveReady(){
  if(!liveReadySince||!liveReadyLastSeen)return 0;
  const now=Date.now();
  if(now-liveReadyLastSeen>liveReadyGraceMs){resetLiveReady();return 0}
  return Math.max(0,liveReadyLastSeen-liveReadySince);
}
function liveReadyComplete(ms){return ms>=liveReadyRequiredMs&&liveReadyHits>=2}

function livePerformanceProfile(){
  const mem=Number(navigator.deviceMemory||0),cores=Number(navigator.hardwareConcurrency||0);
  const low=(mem>0&&mem<=4)||(cores>0&&cores<=4);
  const mid=!low&&((mem>0&&mem<=6)||(cores>0&&cores<=6));
  if(low)return{maxSide:900,interval:520,label:'Tiết kiệm'};
  if(mid)return{maxSide:1050,interval:440,label:'Cân bằng'};
  return{maxSide:1200,interval:380,label:'Mượt'};
}
function drawVideoFrameToScanCanvas(video,maxSide=1100){
  const vw=video.videoWidth||1280,vh=video.videoHeight||720,sc=Math.min(1,maxSide/Math.max(vw,vh));
  const w=Math.max(1,Math.round(vw*sc)),h=Math.max(1,Math.round(vh*sc));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(video,0,0,canvas.width,canvas.height);
}
async function captureLiveHighResSource(){
  const video=$('#liveVideo'),track=liveCurrentTrack();
  if(!video||video.readyState<2)throw new Error('Camera chưa sẵn sàng.');

  // Android Chrome và một số trình duyệt có thể lấy ảnh tĩnh ở độ phân giải cảm biến,
  // cao hơn đáng kể so với luồng preview.
  if(track&&typeof ImageCapture!=='undefined'){
    try{
      const ic=new ImageCapture(track),blob=await ic.takePhoto();
      if(blob&&blob.size>0){
        const bmp=await createImageBitmap(blob);
        return{source:bmp,blob,width:bmp.width,height:bmp.height,mode:'photo'};
      }
    }catch(e){console.warn('ImageCapture.takePhoto không dùng được, chuyển sang frame video.',e)}
  }

  // Fallback: dùng frame video ở kích thước native, không thu nhỏ trước khi đọc OMR.
  return{source:video,blob:null,width:video.videoWidth||1280,height:video.videoHeight||720,mode:'video'};
}
async function freezeLiveFrame(){
  const cap=await captureLiveHighResSource(),maxSide=4600,sc=Math.min(1,maxSide/Math.max(cap.width,cap.height));
  const snap=document.createElement('canvas');
  snap.width=Math.max(1,Math.round(cap.width*sc));snap.height=Math.max(1,Math.round(cap.height*sc));
  const sx=snap.getContext('2d',{willReadFrequently:true});
  sx.fillStyle='#fff';sx.fillRect(0,0,snap.width,snap.height);
  sx.drawImage(cap.source,0,0,snap.width,snap.height);

  let blob=cap.blob;
  if(!blob)blob=await blobFromCanvas(snap,'image/jpeg',.96);

  canvas.width=snap.width;canvas.height=snap.height;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(snap,0,0);
  imgState={img:snap,file:null,url:null,live:true,liveBlob:blob||null,liveCaptureMode:cap.mode};
  pendingGradeImage={source:snap,originalBlob:blob||null,mime:blob?.type||'image/jpeg',originalName:'camera_live.jpg',captureMode:cap.mode,createdAt:Date.now()};
  manualMode=false;markerPoints=[];resetScanQuality();

  const ok=autoDetectMarkers();
  if(ok)scanQuality=analyzeScanQuality();
  drawOverlay();updateScanQualityUI();
  try{if(cap.mode==='photo'&&cap.source?.close)cap.source.close()}catch{}
  return ok&&scanQuality?.ok;
}
function renderFinalLiveResult(g=lastGrade){
  if(!g)return;
  const box=$('#liveRealtimeScore');if(box){box.classList.add('show','locked')}
  const t=cur($('#scanTpl').value);
  if($('#liveRtExam'))$('#liveRtExam').textContent=`KẾT QUẢ CHÍNH THỨC • Mã ${g.examCode||'---'}`;
  if($('#liveRtP1'))$('#liveRtP1').textContent=`P1: ${Number.isFinite(+g.mcPoints)?g.mcPoints:'--'}`;
  if($('#liveRtP2'))$('#liveRtP2').textContent=`P2: ${Number.isFinite(+g.tfPoints)?g.tfPoints:'--'}`;
  if($('#liveRtP3'))$('#liveRtP3').textContent=`P3: ${Number.isFinite(+g.shortPoints)?g.shortPoints:'--'}`;
  if($('#liveRtTotal'))$('#liveRtTotal').textContent=`${g.score} / ${g.max}`;
  if($('#liveRtStudent'))$('#liveRtStudent').textContent=[g.candidateId?`${candidateLabelForTemplate(t)}: ${g.candidateId}`:'',g.studentFromRoster,g.studentClass?`Lớp ${g.studentClass}`:''].filter(Boolean).join(' • ');
}
function clearLiveResultLock(){
  liveResultLocked=false;liveResultLockUntil=0;liveRemovalSince=0;
  $('#liveRealtimeScore')?.classList.remove('locked');
}
async function captureLiveAndGrade(){
  if(liveBusy||livePaused)return;
  liveBusy=true;livePaused=true;setLiveStatus('Ảnh đã ổn định. Đang chụp khung hình HD để đọc Số hiệu/SBD, Mã đề và chấm…','ok');
  try{
    const good=await freezeLiveFrame();
    if(!good){livePaused=false;liveStableFrames=0;livePrevMarkers=null;liveExamCode='';liveExamStable=0;resetLiveReady();setLiveStatus('Khung vừa lấy chưa đạt chuẩn. Tiếp tục giữ phiếu trong khung.','warn');return}
    const t=cur($('#scanTpl').value),finalExam=t?examCodeCheck(t):{value:'???',bad:true,exists:false,expected:[]};
    if(finalExam.bad||!finalExam.exists){livePaused=false;liveStableFrames=0;livePrevMarkers=null;liveExamCode='';liveExamStable=0;resetLiveReady();setLiveHud(4,scanQuality?.auxCount??0,0,'bad',finalExam.bad?'???':finalExam.value,false);setLiveStatus(finalExam.bad?'Ảnh HD vẫn chưa đọc đủ Mã đề. Hãy kiểm tra mỗi cột TÔ MÃ ĐỀ chỉ tô 1 vòng tròn, tô đậm hơn và giữ giấy phẳng.':`Ảnh HD đọc được mã ${finalExam.value} nhưng mã này không thuộc mẫu hiện tại (${finalExam.expected.join(', ')}).`,'warn');return}
    grade();
    if(lastGrade){
      lastGrade.liveCamera=true;lastGrade.liveCaptureMode=imgState?.liveCaptureMode||'video';
      liveAwaitRemoval=true;liveRemovalMisses=0;liveCurrentSaved=false;livePaused=false;resetLiveReady();
      liveResultLocked=true;liveResultLockUntil=Date.now()+liveResultHoldMs;liveRemovalSince=0;
      if($('#nextLiveSheet'))$('#nextLiveSheet').style.display='none';
      if($('#liveFreeSave'))$('#liveFreeSave').disabled=false;
      renderFinalLiveResult(lastGrade);
      setLiveStatus(`KẾT QUẢ ${lastGrade.score}/${lastGrade.max} • đang giữ cố định ${(liveResultHoldMs/1000).toFixed(0)} giây. Có thể bấm Lưu trong lúc này.`,'ok');
      if(navigator.vibrate)try{navigator.vibrate([90,45,90])}catch{}
    }else{
      livePaused=false;liveStableFrames=0;livePrevMarkers=null;resetLiveReady();setLiveStatus('Chưa tạo được kết quả. Điều chỉnh phiếu và thử lại.','warn');
    }
  }catch(e){
    console.error(e);livePaused=false;liveStableFrames=0;livePrevMarkers=null;resetLiveReady();setLiveStatus('Lỗi lấy khung hình: '+(e?.message||e),'err');
  }finally{liveBusy=false}
}
function scheduleLiveProcessing(delay=0){
  if(!liveRunning)return;
  if(liveTimer){clearTimeout(liveTimer);liveTimer=null}
  liveTimer=setTimeout(()=>{
    liveTimer=null;
    if(!liveRunning)return;
    // Cho trình duyệt vẽ frame camera trước, sau đó mới chạy OMR nặng.
    requestAnimationFrame(()=>{
      if(!liveRunning)return;
      const perf=livePerformanceProfile(),started=performance.now();
      processLiveFrame();
      if(!liveRunning)return;
      const elapsed=performance.now()-started;
      // Không dùng setInterval: nếu OMR mất nhiều thời gian, callback sẽ không xếp hàng
      // liên tục làm nghẹt main thread. Luôn chừa ít nhất 120ms để video/UI được render.
      const rest=Math.max(120,perf.interval-elapsed);
      scheduleLiveProcessing(rest);
    });
  },Math.max(0,delay));
}
function processLiveFrame(){
  if(!liveRunning||liveBusy||livePaused)return;
  const video=$('#liveVideo');if(!video||video.readyState<2)return;
  try{
    const perf=livePerformanceProfile();drawVideoFrameToScanCanvas(video,perf.maxSide);
    imgState={img:video,file:null,url:null,livePreview:true};manualMode=false;markerPoints=[];resetScanQuality();
    const ok=autoDetectMarkers();
    if(liveResultLocked){
      const now=Date.now(),remain=Math.max(0,liveResultLockUntil-now);
      renderFinalLiveResult(lastGrade);
      if(ok){
        liveRemovalSince=0;
        if(remain>0)setLiveStatus(`KẾT QUẢ ${lastGrade?.score??'--'}/${lastGrade?.max??'--'} • giữ cố định ${(remain/1000).toFixed(1)} giây…`,'ok');
        else if(liveCurrentSaved)setLiveStatus(`Đã lưu • ${lastGrade?.score??'--'}/${lastGrade?.max??'--'}. Lấy phiếu hiện tại ra khỏi camera để quét bài tiếp theo.`,'ok');
        else setLiveStatus(`KẾT QUẢ ${lastGrade?.score??'--'}/${lastGrade?.max??'--'} đang khóa. Bấm Lưu, rồi lấy phiếu ra để quét bài tiếp theo.`,'ok');
      }else{
        if(!liveRemovalSince)liveRemovalSince=now;
        const goneMs=now-liveRemovalSince;
        if(remain>0){
          setLiveStatus(`KẾT QUẢ ${lastGrade?.score??'--'}/${lastGrade?.max??'--'} • vẫn giữ cố định ${(remain/1000).toFixed(1)} giây…`,'ok');
        }else if(!liveCurrentSaved){
          setLiveStatus(`Phiếu đã rời camera nhưng kết quả ${lastGrade?.score??'--'}/${lastGrade?.max??'--'} chưa lưu. Bấm Lưu để không mất kết quả.`,'warn');
        }else if(goneMs>=liveRemovalRequiredMs){
          setLiveStatus('Đã xác nhận phiếu cũ rời camera. Sẵn sàng bài tiếp theo…','ok');
          resumeLiveForNextSheet();
        }else{
          setLiveStatus(`Đã lưu • đang xác nhận phiếu cũ đã rời camera ${(goneMs/1000).toFixed(1)}/${(liveRemovalRequiredMs/1000).toFixed(1)}s…`,'ok');
        }
      }
      return;
    }
    if(liveAwaitRemoval){
      if(!ok){
        liveRemovalMisses++;
        presentLiveProcessedFrame();
        if(liveCurrentSaved&&liveRemovalMisses>=2){
          setLiveStatus('Đã lấy phiếu ra. Đang sẵn sàng bài tiếp theo…','ok');
          resumeLiveForNextSheet();
        }else if(liveCurrentSaved)setLiveStatus('Đã lưu. Lấy phiếu ra khỏi camera để quét bài tiếp theo.','ok');
        else setLiveStatus('Phiếu đã rời camera nhưng kết quả chưa lưu. Bấm Lưu để giữ kết quả.','warn');
      }else{
        liveRemovalMisses=0;scanQuality=analyzeScanQuality();presentLiveProcessedFrame();
        setLiveStatus(liveCurrentSaved?`Đã lưu ${lastGrade?.score??''}/${lastGrade?.max??''}. Lấy phiếu ra để quét bài tiếp theo.`:`Đã chấm ${lastGrade?.score??''}/${lastGrade?.max??''}. Bấm Lưu rồi lấy phiếu ra.`,'ok');
      }
      return;
    }
    if(!ok){
      const held=holdLiveReady();livePrevMarkers=null;resetRealtimeResult();presentLiveProcessedFrame();
      setLiveHud(0,0,0,'bad','---',false,held);
      setLiveStatus(held>0?'Mất marker thoáng qua — app vẫn giữ tiến trình tự chấm. Đưa trọn phiếu lại vào vùng camera.':'Đang tìm phiếu… Hãy đưa toàn bộ tờ A4 vào vùng camera.','warn');return;
    }
    scanQuality=analyzeScanQuality();updateScanQualityUI();
    const current=markerPoints.map(p=>({x:p.x,y:p.y})),q=scanQuality,t=cur($('#scanTpl').value),qualityGood=!!q?.ok&&q.mode==='v2'&&q.auxCount>=4;
    livePrevMarkers=current;
    if(!qualityGood){
      const held=holdLiveReady();resetRealtimeResult();presentLiveProcessedFrame();
      setLiveHud(4,q?.auxCount??0,0,'bad','---',false,held);
      setLiveStatus(held>0?'Chất lượng dao động 1 khung — chưa reset tiến trình. Giữ phiếu trong khung.':(q?.message||'Ảnh chưa đạt chuẩn.'),'warn');return;
    }
    const L=buildLayout(t),gridLock=lockRecognitionGrids(L),answerLock=lockAnswerGrids(L),rex=examCodeCheck(t,L);
    if(rex.bad||!rex.exists){
      const held=holdLiveReady();resetRealtimeResult();presentLiveProcessedFrame();
      setLiveHud(4,q?.auxCount??0,0,'bad',rex.bad?'???':rex.value,false,held);
      setLiveStatus(held>0?'Mã đề dao động thoáng qua — app vẫn giữ tiến trình.':(rex.bad?'Đã khóa phiếu nhưng chưa đọc đủ Mã đề. Giữ phiếu rõ và phẳng.':`Đọc mã ${rex.value}, chưa có trong mẫu hiện tại.`),'warn');return;
    }
    const v=t.versions.find(x=>x.code===rex.value),rt=realtimeEvaluate(t,L,v,rex.value);

    // v4.11: AutoScan theo thời gian hiện diện hợp lệ, KHÔNG phụ thuộc rung marker
    // và KHÔNG phụ thuộc đáp án realtime có giống 100% giữa các frame hay không.
    // Realtime chỉ xác nhận: đúng phiếu + đủ marker + mã đề hợp lệ.
    // Khi đạt thời gian yêu cầu, ảnh HD mới là nguồn dùng để chấm chính thức.
    const readyMs=markLiveReady(rex.value);
    presentLiveProcessedFrame(rt);renderRealtimeResult(rt,rex.value,true);
    setLiveHud(4,q?.auxCount??0,0,'good',rex.value,true,readyMs);

    if(!liveReadyComplete(readyMs)){
      const remain=Math.max(0,liveReadyRequiredMs-readyMs);
      setLiveStatus(`Đã nhận Mã ${rex.value} • Tổng xem trước ${rt.total}. Tự chụp sau ${(remain/1000).toFixed(1)} giây…`,'ok');
    }else if(liveAutoScan&&Date.now()>=liveAutoCooldownUntil){
      liveAutoCooldownUntil=Date.now()+1800;
      setLiveStatus(`Đã khóa phiếu • Mã ${rex.value} • Đang tự chụp HD và chấm…`,'ok');
      void captureLiveAndGrade();
    }else setLiveStatus(`Đã khóa phiếu • Mã ${rex.value} • Tổng xem trước ${rt.total}.`,'ok');
  }catch(e){console.warn('Realtime OMR frame error',e);holdLiveReady();resetRealtimeResult();setLiveStatus('Không xử lý được khung hình camera.','err')}
}
function updateCameraDiag(extra=''){
  const e=$('#liveCameraDiag');if(!e)return;
  const secure=window.isSecureContext?'HTTPS/secure ✓':'Không phải HTTPS ✗';
  const media=!!navigator.mediaDevices?.getUserMedia?'getUserMedia ✓':'getUserMedia ✗';
  const video=$('#liveVideo');const dims=video?.videoWidth&&video?.videoHeight?` • ${video.videoWidth}×${video.videoHeight}`:'';
  e.textContent=`Camera: ${secure} • ${media}${dims}${extra?` • ${extra}`:''}`;
}
function waitForVideoReady(video,timeout=6000){
  return new Promise((resolve,reject)=>{
    if(video.readyState>=2&&video.videoWidth>0)return resolve();
    let done=false;
    const finish=(err)=>{if(done)return;done=true;clearTimeout(timer);video.removeEventListener('loadedmetadata',ok);video.removeEventListener('canplay',ok);err?reject(err):resolve()};
    const ok=()=>{if(video.videoWidth>0)finish()};
    const timer=setTimeout(()=>finish(new Error('Camera đã cấp quyền nhưng không tạo được hình xem trước.')),timeout);
    video.addEventListener('loadedmetadata',ok);video.addEventListener('canplay',ok);
  });
}
async function requestCameraStream(){
  const attempts=[
    // Preview ưu tiên 720p để camera mượt. Khi tự chấm, ImageCapture.takePhoto()
    // vẫn cố lấy ảnh tĩnh ở độ phân giải cảm biến nếu trình duyệt hỗ trợ.
    {audio:false,video:{facingMode:{ideal:liveFacingMode},width:{ideal:1280,max:1280},height:{ideal:720,max:720},frameRate:{ideal:30,max:30}}},
    {audio:false,video:{facingMode:{ideal:liveFacingMode},width:{ideal:960},height:{ideal:540},frameRate:{ideal:30,max:30}}},
    {audio:false,video:{facingMode:{ideal:liveFacingMode}}},
    {audio:false,video:true}
  ];
  let lastErr=null;
  for(let i=0;i<attempts.length;i++){
    try{return await navigator.mediaDevices.getUserMedia(attempts[i])}
    catch(e){lastErr=e;console.warn(`Camera attempt ${i+1} failed`,e);if(e?.name==='NotAllowedError'||e?.name==='SecurityError')throw e}
  }
  throw lastErr||new Error('Không mở được camera.');
}
async function startLiveCamera(){
  updateCameraDiag();
  if(!window.isSecureContext){
    const msg='Camera web chỉ hoạt động trên HTTPS. Hãy mở đúng đường dẫn https:// của Vercel, không mở bằng http:// hoặc file cục bộ.';
    setLiveStatus(msg,'err');alert(msg);return;
  }
  if(!navigator.mediaDevices?.getUserMedia){
    const msg='Trình duyệt hiện tại không cung cấp camera web. Hãy mở bằng Chrome trên Android hoặc Safari trên iPhone, tránh trình duyệt nhúng trong Zalo/Facebook/Messenger.';
    setLiveStatus(msg,'err');alert(msg);return;
  }
  if($('#scanSource').value==='assigned'&&!$('#scanTarget').value){alert('Hãy chọn lớp hoặc phòng thi trước khi mở camera.');return}
  const t=cur($('#scanTpl').value);if(!t){alert('Chưa chọn mẫu & đáp án để chấm.');return}
  stopLiveCamera(true);clearResult();resetRealtimeResult();resetScanQuality();setLiveStatus('Đang xin quyền mở camera…');
  try{
    liveStream=await requestCameraStream();
    const track=liveCurrentTrack();
    try{
      const cap=track?.getCapabilities?.()||{},adv=[];
      if(Array.isArray(cap.focusMode)&&cap.focusMode.includes('continuous'))adv.push({focusMode:'continuous'});
      if(adv.length)await track.applyConstraints({advanced:adv});
    }catch(e){console.warn('Không áp dụng được autofocus liên tục.',e)}
    const video=$('#liveVideo');video.srcObject=liveStream;
    await waitForVideoReady(video);
    try{await video.play()}catch(e){console.warn('video.play() chưa chạy ngay trên thiết bị này',e)}
    if(!video.videoWidth)await waitForVideoReady(video,3000);
    liveRunning=true;livePaused=false;liveStableFrames=0;livePrevMarkers=null;liveExamCode='';liveExamStable=0;liveAutoCooldownUntil=0;liveAwaitRemoval=false;liveRemovalMisses=0;liveCurrentSaved=false;liveResultLocked=false;liveResultLockUntil=0;liveRemovalSince=0;resetLiveReady();
    $('#liveCameraStage')?.classList.add('open','freeScan');document.body.classList.add('liveFreeScanOpen');$('#startLiveCamera').disabled=true;$('#stopLiveCamera').disabled=false;$('#switchLiveCamera').disabled=false;
    if($('#captureLiveNow'))$('#captureLiveNow').disabled=false;
    const perf=livePerformanceProfile();
    updateTorchButton();setLiveHud('--','--',0);updateCameraDiag(`Đã mở • ${perf.label} ${perf.maxSide}px/${perf.interval}ms`);setLiveStatus(liveAutoScan?'Camera toàn màn hình đã mở. Đưa toàn bộ phiếu vào vùng camera; app tự tìm phiếu và tự chấm.':'Camera đã mở. Chế độ tự chấm đang tắt; dùng nút “Chụp & chấm ngay”.');
    scheduleLiveProcessing(220);
  }catch(e){
    stopLiveCamera(true);updateCameraDiag(e?.name||'Lỗi');
    const name=e?.name||'',msg=name==='NotAllowedError'?'Bạn chưa cho phép truy cập camera. Vào quyền của trình duyệt/trang web, bật Camera rồi tải lại trang.':name==='NotFoundError'?'Không tìm thấy camera trên thiết bị.':name==='NotReadableError'?'Camera đang bị ứng dụng khác sử dụng hoặc trình duyệt không đọc được camera. Hãy đóng ứng dụng Camera/Zalo/Meet rồi thử lại.':name==='OverconstrainedError'?'Camera không đáp ứng cấu hình hình ảnh yêu cầu. Bản này đã tự hạ cấu hình; hãy tải lại trang và thử lại.':'Không mở được camera: '+(e?.message||e);
    setLiveStatus(msg,'err');alert(msg);
  }
}
async function switchLiveCamera(){liveFacingMode=liveFacingMode==='environment'?'user':'environment';if(liveRunning)await startLiveCamera()}
async function toggleLiveTorch(){
  const track=liveCurrentTrack();if(!track)return;
  try{
    const cap=track.getCapabilities?.();if(!cap?.torch){alert('Thiết bị/camera này không hỗ trợ bật đèn từ trình duyệt.');return}
    liveTorchOn=!liveTorchOn;await track.applyConstraints({advanced:[{torch:liveTorchOn}]});updateTorchButton();
  }catch(e){liveTorchOn=false;updateTorchButton();alert('Không điều khiển được đèn camera trên thiết bị này.')}
}
function resumeLiveForNextSheet(){
  if(!liveRunning){startLiveCamera();return}
  clearLiveResultLock();clearResult();resetRealtimeResult();imgState=null;markerPoints=[];H=null;resetScanQuality();livePaused=false;liveBusy=false;liveStableFrames=0;livePrevMarkers=null;liveExamCode='';liveExamStable=0;liveAutoCooldownUntil=0;liveAwaitRemoval=false;liveRemovalMisses=0;liveCurrentSaved=false;liveResultLocked=false;liveResultLockUntil=0;liveRemovalSince=0;resetLiveReady();
  $('#nextLiveSheet').style.display='none';setLiveHud('--','--',0);setLiveStatus('Sẵn sàng. Đưa bài tiếp theo vào vùng camera.');
}
$('#startLiveCamera').onclick=startLiveCamera;
if($('#captureLiveNow'))$('#captureLiveNow').onclick=captureLiveAndGrade;
if($('#autoLiveGrade')){
  liveAutoScan=$('#autoLiveGrade').checked!==false;
  $('#autoLiveGrade').onchange=()=>{
    liveAutoScan=$('#autoLiveGrade').checked;
    resetRealtimeResult();liveAutoCooldownUntil=0;resetLiveReady();
    if(liveRunning)setLiveStatus(liveAutoScan?'Tự chấm đã bật. Đưa phiếu vào khung và giữ yên.':'Tự chấm đã tắt. Dùng nút “Chụp & chấm ngay”.',liveAutoScan?'ok':'warn');
  };
}
$('#stopLiveCamera').onclick=()=>stopLiveCamera();
$('#switchLiveCamera').onclick=switchLiveCamera;
$('#toggleTorch').onclick=toggleLiveTorch;
$('#nextLiveSheet').onclick=resumeLiveForNextSheet;
if($('#liveFreeClose'))$('#liveFreeClose').onclick=()=>stopLiveCamera();
if($('#liveFreeTorch'))$('#liveFreeTorch').onclick=()=>$('#toggleTorch')?.click();
if($('#liveFreeSwitch'))$('#liveFreeSwitch').onclick=()=>$('#switchLiveCamera')?.click();
if($('#liveFreeSave'))$('#liveFreeSave').onclick=()=>{if(!$('#saveResult')?.disabled)$('#saveResult').click()};
window.addEventListener('beforeunload',()=>stopLiveCamera(true));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&liveRunning)stopLiveCamera(true)});
updateCameraDiag();

$('#photoInput').onchange=e=>{const f=e.target.files[0];if(!f)return;stopLiveCamera();clearResult();resetScanQuality();if(imgState?.url)URL.revokeObjectURL(imgState.url);const url=URL.createObjectURL(f),img=new Image();img.onload=()=>{const s=Math.min(1,3200/Math.max(img.width,img.height));canvas.width=Math.round(img.width*s);canvas.height=Math.round(img.height*s);ctx.drawImage(img,0,0,canvas.width,canvas.height);imgState={img,file:f,url};pendingGradeImage={source:img,originalBlob:f,mime:f.type||'image/jpeg',originalName:f.name||'anh_bai_lam'};manualMode=false;markerPoints=[];const ok=autoDetectMarkers();if(ok)scanQuality=analyzeScanQuality();drawOverlay();updateScanQualityUI();if(!ok)setStatus('Không nhận đủ 4 marker chính. Bảo đảm cả 4 ô đen lớn nằm trọn trong ảnh, không ô nào chạm/cắt mép ảnh; sau đó thử lại hoặc chọn thủ công.','err');else if(!scanQuality.ok)setStatus('Ảnh chưa đạt chuẩn Auto OMR v2: '+scanQuality.message+' Hãy chụp lại.','err');else if(scanQuality.mode==='v2')setStatus('Ảnh đạt chuẩn Auto OMR v2. Đã nhận marker phụ và hiệu chỉnh cục bộ.','ok');else setStatus('Phiếu kiểu cũ chỉ có 4 marker chính. Vẫn có thể chấm nhưng độ ổn định thấp hơn phiếu Auto OMR v2.','warn')};img.src=url}
function downsample(){const max=520,sc=Math.min(1,max/Math.max(canvas.width,canvas.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(canvas.width*sc));c.height=Math.max(1,Math.round(canvas.height*sc));const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(canvas,0,0,c.width,c.height);return{c,x,sc}}
function findMarkerInRoi(data,w,h,roi,corner){
  const [x0,y0,x1,y1]=roi.map(Math.round),vis=new Uint8Array(w*h);let best=null;
  const maxQueue=(x1-x0)*(y1-y0),qx=new Int32Array(maxQueue),qy=new Int32Array(maxQueue);
  for(let y=y0;y<y1;y++){
    for(let x=x0;x<x1;x++){
      const idx=y*w+x;if(vis[idx])continue;
      const k=idx*4,g=.299*data[k]+.587*data[k+1]+.114*data[k+2];
      if(g>90){vis[idx]=1;continue}
      let head=0,tail=0;qx[tail]=x;qy[tail++]=y;vis[idx]=1;
      let area=0,minx=x,maxx=x,miny=y,maxy=y,sx=0,sy=0;
      while(head<tail){
        const cx=qx[head],cy=qy[head++];area++;sx+=cx;sy+=cy;
        if(cx<minx)minx=cx;if(cx>maxx)maxx=cx;if(cy<miny)miny=cy;if(cy>maxy)maxy=cy;
        const ns=[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]];
        for(const [nx,ny] of ns){
          if(nx<x0||nx>=x1||ny<y0||ny>=y1)continue;
          const ni=ny*w+nx;if(vis[ni])continue;
          const kk=ni*4,gg=.299*data[kk]+.587*data[kk+1]+.114*data[kk+2];vis[ni]=1;
          if(gg<=90&&tail<maxQueue){qx[tail]=nx;qy[tail++]=ny}
        }
      }
      const bw=maxx-minx+1,bh=maxy-miny+1,fill=area/(bw*bh),ratio=bw/bh;
      const touchesImageEdge=minx<=1||miny<=1||maxx>=w-2||maxy>=h-2;
      if(touchesImageEdge)continue;
      if(area<25||bw<5||bh<5||bw>Math.min(w,h)*.11||bh>Math.min(w,h)*.11||ratio<.55||ratio>1.8||fill<.45)continue;
      const cx=sx/area,cy=sy/area,dx=corner.includes('r')?(w-cx):cx,dy=corner.includes('b')?(h-cy):cy,dist=Math.hypot(dx,dy)+1,score=area*fill/dist;
      if(!best||score>best.score)best={x:cx,y:cy,score,area,bw,bh};
    }
  }
  return best;
}

function findMainMarkersAnywhere(data,w,h){
  const vis=new Uint8Array(w*h),qx=new Int32Array(w*h),qy=new Int32Array(w*h),cand=[];
  const minDim=Math.min(w,h),maxBox=minDim*.11;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const idx=y*w+x;if(vis[idx])continue;
    const k=idx*4,g=.299*data[k]+.587*data[k+1]+.114*data[k+2];
    if(g>90){vis[idx]=1;continue}
    let head=0,tail=0;qx[tail]=x;qy[tail++]=y;vis[idx]=1;
    let area=0,minx=x,maxx=x,miny=y,maxy=y,sx=0,sy=0;
    while(head<tail){
      const cx=qx[head],cy=qy[head++];area++;sx+=cx;sy+=cy;
      if(cx<minx)minx=cx;if(cx>maxx)maxx=cx;if(cy<miny)miny=cy;if(cy>maxy)maxy=cy;
      const ns=[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]];
      for(const [nx,ny] of ns){
        if(nx<1||nx>=w-1||ny<1||ny>=h-1)continue;
        const ni=ny*w+nx;if(vis[ni])continue;
        const kk=ni*4,gg=.299*data[kk]+.587*data[kk+1]+.114*data[kk+2];vis[ni]=1;
        if(gg<=90&&tail<qx.length){qx[tail]=nx;qy[tail++]=ny}
      }
    }
    const bw=maxx-minx+1,bh=maxy-miny+1,fill=area/Math.max(1,bw*bh),ratio=bw/bh;
    if(area<28||bw<5||bh<5||bw>maxBox||bh>maxBox||ratio<.68||ratio>1.45||fill<.58)continue;
    cand.push({x:sx/area,y:sy/area,area,bw,bh,fill});
  }
  if(cand.length<4)return null;
  cand.sort((a,b)=>b.area-a.area);
  const top=cand.slice(0,Math.min(16,cand.length));
  let best=null;
  for(let a=0;a<top.length-3;a++)for(let b=a+1;b<top.length-2;b++)for(let c=b+1;c<top.length-1;c++)for(let d=c+1;d<top.length;d++){
    const q=[top[a],top[b],top[c],top[d]],tl=q.reduce((m,p)=>p.x+p.y<m.x+m.y?p:m,q[0]),br=q.reduce((m,p)=>p.x+p.y>m.x+m.y?p:m,q[0]),tr=q.reduce((m,p)=>p.x-p.y>m.x-m.y?p:m,q[0]),bl=q.reduce((m,p)=>p.x-p.y<m.x-m.y?p:m,q[0]);
    const pts=[tl,tr,br,bl];if(new Set(pts).size<4)continue;
    const ar=polygonArea(pts)/Math.max(1,w*h);if(ar<.10)continue;
    const areas=pts.map(p=>p.area),ratioArea=Math.max(...areas)/Math.max(1,Math.min(...areas));if(ratioArea>2.8)continue;
    const topLen=sideLen(tl,tr),bottomLen=sideLen(bl,br),leftLen=sideLen(tl,bl),rightLen=sideLen(tr,br);
    if(Math.min(topLen,bottomLen,leftLen,rightLen)<minDim*.18)continue;
    const opp=Math.max(topLen,bottomLen)/Math.max(1,Math.min(topLen,bottomLen));
    const opp2=Math.max(leftLen,rightLen)/Math.max(1,Math.min(leftLen,rightLen));if(opp>1.9||opp2>1.9)continue;
    const score=ar*(areas.reduce((x,y)=>x+y,0)/4)*pts.reduce((x,p)=>x+p.fill,0)/4;
    if(!best||score>best.score)best={pts,score};
  }
  return best?.pts||null;
}
function restoreRawCanvas(){if(imgState?.img){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(imgState.img,0,0,canvas.width,canvas.height)}}
function autoDetectMarkers(){if(!imgState)return false;resetScanQuality();restoreRawCanvas();const d=downsample(),w=d.c.width,h=d.c.height,data=d.x.getImageData(0,0,w,h).data,rx=.32*w,ry=.28*h;const rois=[[0,0,rx,ry],[w-rx,0,w,ry],[w-rx,h-ry,w,h],[0,h-ry,rx,h]],names=['tl','tr','br','bl'];let pts=[],roiOk=true;for(let i=0;i<4;i++){const m=findMarkerInRoi(data,w,h,rois[i],names[i]);if(!m){roiOk=false;break}pts.push({x:m.x/d.sc,y:m.y/d.sc})}if(!roiOk){const any=findMainMarkersAnywhere(data,w,h);if(!any)return false;pts=any.map(m=>({x:m.x/d.sc,y:m.y/d.sc}))}markerPoints=pts;H=computeHomography(AUTO_OMR_V2.cornerCenters,markerPoints);return !!H}
function computeHomography(src,dst){const A=[],b=[];for(let i=0;i<4;i++){const x=src[i].x,y=src[i].y,u=dst[i].x,v=dst[i].y;A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v)}for(let i=0;i<8;i++){let p=i;for(let r=i+1;r<8;r++)if(Math.abs(A[r][i])>Math.abs(A[p][i]))p=r;if(Math.abs(A[p][i])<1e-9)return null;[A[i],A[p]]=[A[p],A[i]];[b[i],b[p]]=[b[p],b[i]];const q=A[i][i];for(let c=i;c<8;c++)A[i][c]/=q;b[i]/=q;for(let r=0;r<8;r++){if(r===i)continue;const f=A[r][i];for(let c=i;c<8;c++)A[r][c]-=f*A[i][c];b[r]-=f*b[i]}}return b}
function mapSheetBase(x,y){if(!H)return{x:0,y:0};const den=H[6]*x+H[7]*y+1;return{x:(H[0]*x+H[1]*y+H[2])/den,y:(H[3]*x+H[4]*y+H[5])/den}}
function lerp(a,b,t){return a+(b-a)*Math.max(0,Math.min(1,t))}
function sideCorrectionAt(side,y){
  if(!localCorrection?.enabled)return{x:0,y:0};const nodes=localCorrection[side]||[];if(!nodes.length)return{x:0,y:0};
  if(y<=nodes[0].y)return{x:nodes[0].dx,y:nodes[0].dy};if(y>=nodes[nodes.length-1].y)return{x:nodes[nodes.length-1].dx,y:nodes[nodes.length-1].dy};
  for(let i=0;i<nodes.length-1;i++){const a=nodes[i],b=nodes[i+1];if(y>=a.y&&y<=b.y){const t=(y-a.y)/(b.y-a.y||1);return{x:lerp(a.dx,b.dx,t),y:lerp(a.dy,b.dy,t)}}}return{x:0,y:0};
}
function correctionAt(x,y){if(!localCorrection?.enabled)return{x:0,y:0};const l=sideCorrectionAt('left',y),r=sideCorrectionAt('right',y),t=(x-AUTO_OMR_V2.auxX[0])/(AUTO_OMR_V2.auxX[1]-AUTO_OMR_V2.auxX[0]);return{x:lerp(l.x,r.x,t),y:lerp(l.y,r.y,t)}}
function mapSheet(x,y,useCorrection=true){const p=mapSheetBase(x,y);if(!useCorrection)return p;const c=correctionAt(x,y);return{x:p.x+c.x,y:p.y+c.y}}
function scaleAtBase(x,y){const p=mapSheetBase(x,y),px=mapSheetBase(x+10,y),py=mapSheetBase(x,y+10);return(Math.hypot(px.x-p.x,px.y-p.y)+Math.hypot(py.x-p.x,py.y-p.y))/20}
function darknessAtSheetBase(x,y,rSheet=4){const p=mapSheetBase(x,y),sc=Math.max(.3,scaleAtBase(x,y)),r=Math.max(2,rSheet*sc),x0=Math.max(0,Math.floor(p.x-r)),y0=Math.max(0,Math.floor(p.y-r)),x1=Math.min(canvas.width-1,Math.ceil(p.x+r)),y1=Math.min(canvas.height-1,Math.ceil(p.y+r));if(x1<x0||y1<y0)return 0;const data=ctx.getImageData(x0,y0,x1-x0+1,y1-y0+1).data;let sum=0,n=0,k=0;for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++,k+=4){const dx=xx-p.x,dy=yy-p.y;if(dx*dx+dy*dy<=r*r){const g=.299*data[k]+.587*data[k+1]+.114*data[k+2];sum+=(255-g)/255;n++}}return n?sum/n:0}
function findAuxMarker(x,y){let best={dark:0,dx:0,dy:0,point:mapSheetBase(x,y)};for(let dy=-AUTO_OMR_V2.auxSearch;dy<=AUTO_OMR_V2.auxSearch;dy+=2){for(let dx=-AUTO_OMR_V2.auxSearch;dx<=AUTO_OMR_V2.auxSearch;dx+=2){const dark=darknessAtSheetBase(x+dx,y+dy,3.2);if(dark>best.dark){best={dark,dx,dy,point:mapSheetBase(x+dx,y+dy)}}}}const expected=mapSheetBase(x,y);best.rawDx=best.point.x-expected.x;best.rawDy=best.point.y-expected.y;best.expected={x,y};best.found=best.dark>=AUTO_OMR_V2.auxMinDark;return best}
function detectAuxMarkers(){auxMarkerObservations=[];for(const y of AUTO_OMR_V2.auxRows){for(const x of AUTO_OMR_V2.auxX)auxMarkerObservations.push(findAuxMarker(x,y))}return auxMarkerObservations}
function buildLocalCorrection(obs){
  const found=obs.filter(o=>o.found);if(found.length<AUTO_OMR_V2.auxRequired){localCorrection=null;return false}
  const left=[{y:31,dx:0,dy:0}],right=[{y:31,dx:0,dy:0}];
  for(const o of obs.filter(o=>o.found)){const n={y:o.expected.y,dx:o.rawDx,dy:o.rawDy};(o.expected.x<397?left:right).push(n)}
  left.push({y:1092,dx:0,dy:0});right.push({y:1092,dx:0,dy:0});left.sort((a,b)=>a.y-b.y);right.sort((a,b)=>a.y-b.y);
  localCorrection={enabled:true,left,right};return true
}
function polygonArea(pts){let s=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];s+=a.x*b.y-b.x*a.y}return Math.abs(s)/2}
function sideLen(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function analyzeScanQuality(){
  restoreRawCanvas();
  if(markerPoints.length!==4||!H)return{ok:false,mode:'none',message:'Thiếu 4 marker chính.',mainMarkers:markerPoints.length,auxCount:0,pageAreaRatio:0,localCorrection:false};
  const areaRatio=polygonArea(markerPoints)/Math.max(1,canvas.width*canvas.height),top=sideLen(markerPoints[0],markerPoints[1]),bottom=sideLen(markerPoints[3],markerPoints[2]),left=sideLen(markerPoints[0],markerPoints[3]),right=sideLen(markerPoints[1],markerPoints[2]);
  const wr=Math.max(top,bottom)/Math.max(1,Math.min(top,bottom)),hr=Math.max(left,right)/Math.max(1,Math.min(left,right));
  if(areaRatio<AUTO_OMR_V2.minPageAreaRatio)return{ok:false,mode:'none',message:'Tờ giấy quá nhỏ trong ảnh. Hãy đưa camera gần hơn và lấy đủ 4 góc.',mainMarkers:4,auxCount:0,pageAreaRatio:areaRatio,localCorrection:false};
  if(wr>AUTO_OMR_V2.maxOppositeEdgeRatio||hr>AUTO_OMR_V2.maxOppositeEdgeRatio)return{ok:false,mode:'none',message:'Ảnh bị nghiêng/phối cảnh quá mạnh. Hãy giữ camera gần vuông góc với tờ giấy.',mainMarkers:4,auxCount:0,pageAreaRatio:areaRatio,localCorrection:false};
  const obs=detectAuxMarkers(),auxCount=obs.filter(o=>o.found).length;
  if(auxCount===0){localCorrection=null;return{ok:true,mode:'legacy',message:'Phiếu 4-marker kiểu cũ: hình học đạt, nhưng chưa có marker phụ Auto OMR v2.',mainMarkers:4,auxCount,pageAreaRatio:areaRatio,localCorrection:false}}
  if(auxCount<AUTO_OMR_V2.auxRequired){localCorrection=null;return{ok:false,mode:'v2',message:`Chỉ nhận ${auxCount}/6 marker phụ. Có thể giấy bị cong, che khuất hoặc ảnh mờ.`,mainMarkers:4,auxCount,pageAreaRatio:areaRatio,localCorrection:false}}
  const corrected=buildLocalCorrection(obs);return{ok:true,mode:'v2',message:`Ảnh đạt chuẩn; nhận ${auxCount}/6 marker phụ và đã hiệu chỉnh biến dạng theo vùng.`,mainMarkers:4,auxCount,pageAreaRatio:areaRatio,localCorrection:corrected}
}
function strokeSheetRect(x,y,w,h,color,label){const pts=[mapSheet(x,y),mapSheet(x+w,y),mapSheet(x+w,y+h),mapSheet(x,y+h)];ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<4;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.closePath();ctx.stroke();if(label){ctx.font='700 13px sans-serif';ctx.fillText(label,pts[0].x+4,pts[0].y-5)}ctx.restore()}
function drawRecognitionZones(L){
  if(!L||!H)return;
  if(L.id?.length&&L.idBox)strokeSheetRect(L.idBox.x,L.idBox.y,L.idBox.w,L.idBox.h,'#16a34a','Số hiệu/SBD');
  if(L.exam?.length){
    const vals=L.exam.flatMap(c=>c.vals),xs=vals.map(v=>v.x),ys=vals.map(v=>v.y);
    strokeSheetRect(Math.min(...xs)-13,Math.min(...ys)-8,Math.max(...xs)-Math.min(...xs)+26,Math.max(...ys)-Math.min(...ys)+16,'#7c3aed','Mã đề');
  }
  ctx.save();ctx.lineWidth=1.6;
  for(const [cols,color] of [[L.id,'#16a34a'],[L.exam,'#a855f7']]){
    for(const c of cols||[])for(const v of c.vals||[]){
      const p=mapSheet(v.x,v.y);ctx.strokeStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,3.2,0,Math.PI*2);ctx.stroke();
    }
  }
  ctx.restore();
  for(const g of L.mcGroups||[])strokeSheetRect(g.x,g.y,g.w,g.h,'#2563eb','I');
  for(const g of L.tfGroups||[])strokeSheetRect(g.x,g.y,g.w,g.h,'#ea580c','II');
  for(const q of L.short||[])strokeSheetRect(q.x,q.y,q.w,q.h,'#0891b2','III')
}
function drawOverlay(layout=null){if(!imgState)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(imgState.img,0,0,canvas.width,canvas.height);ctx.save();ctx.lineWidth=4;ctx.strokeStyle='#00e5ff';ctx.fillStyle='#ffeb3b';ctx.font='18px sans-serif';markerPoints.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,9,0,Math.PI*2);ctx.fill();ctx.strokeText(String(i+1),p.x+12,p.y-8)});if(markerPoints.length>1){ctx.beginPath();ctx.moveTo(markerPoints[0].x,markerPoints[0].y);for(let i=1;i<markerPoints.length;i++)ctx.lineTo(markerPoints[i].x,markerPoints[i].y);if(markerPoints.length===4)ctx.closePath();ctx.stroke()}if(H&&auxMarkerObservations.length){ctx.lineWidth=2;auxMarkerObservations.forEach((o,i)=>{const p=o.point;ctx.strokeStyle=o.found?'#16a34a':'#ef4444';ctx.fillStyle=o.found?'rgba(22,163,74,.35)':'rgba(239,68,68,.2)';ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=o.found?'#16a34a':'#ef4444';ctx.font='13px sans-serif';ctx.fillText('A'+(i+1),p.x+9,p.y-7)})}ctx.restore();if(layout)drawRecognitionZones(layout)}
$('#autoCorners').onclick=()=>{if(!imgState)return;manualMode=false;markerPoints=[];resetScanQuality();const ok=autoDetectMarkers();if(ok)scanQuality=analyzeScanQuality();drawOverlay();updateScanQualityUI();if(!ok)setStatus('Không nhận đủ 4 marker chính. Hãy chụp lại hoặc chọn thủ công.','err');else if(!scanQuality.ok)setStatus('Ảnh chưa đạt chuẩn: '+scanQuality.message,'err');else setStatus(scanQuality.mode==='v2'?'Đã nhận Auto OMR v2 và hiệu chỉnh marker phụ.':'Đã nhận phiếu 4-marker kiểu cũ.','ok')}
$('#manualCorners').onclick=()=>{if(!imgState)return;manualMode=true;markerPoints=[];H=null;resetScanQuality();drawOverlay();setStatus('Chế độ thủ công: chạm tâm 4 ô đen theo thứ tự trên trái → trên phải → dưới phải → dưới trái.','warn')}
canvas.onclick=e=>{if(!manualMode||!imgState||markerPoints.length>=4)return;const r=canvas.getBoundingClientRect(),sx=canvas.width/r.width,sy=canvas.height/r.height;markerPoints.push({x:(e.clientX-r.left)*sx,y:(e.clientY-r.top)*sy});if(markerPoints.length===4){H=computeHomography(AUTO_OMR_V2.cornerCenters,markerPoints);manualMode=false;scanQuality=analyzeScanQuality();setStatus(scanQuality.ok?(scanQuality.mode==='v2'?'Đã chọn 4 marker chính; marker phụ cũng đạt chuẩn.':'Đã chọn đủ 4 marker; đây là phiếu kiểu cũ không có marker phụ.'):'Ảnh chưa đạt chuẩn: '+scanQuality.message,scanQuality.ok?'ok':'err')}drawOverlay();updateScanQualityUI()}
function scaleAt(x,y){const p=mapSheet(x,y),px=mapSheet(x+10,y),py=mapSheet(x,y+10);return(Math.hypot(px.x-p.x,px.y-p.y)+Math.hypot(py.x-p.x,py.y-p.y))/20}
function darknessAtSheet(x,y,rSheet=4){const p=mapSheet(x,y),sc=Math.max(.3,scaleAt(x,y)),r=Math.max(2,rSheet*sc),x0=Math.max(0,Math.floor(p.x-r)),y0=Math.max(0,Math.floor(p.y-r)),x1=Math.min(canvas.width-1,Math.ceil(p.x+r)),y1=Math.min(canvas.height-1,Math.ceil(p.y+r)),data=ctx.getImageData(x0,y0,x1-x0+1,y1-y0+1).data;let sum=0,n=0,k=0;for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++,k+=4){const dx=xx-p.x,dy=yy-p.y;if(dx*dx+dy*dy<=r*r){const g=.299*data[k]+.587*data[k+1]+.114*data[k+2];sum+=(255-g)/255;n++}}return n?sum/n:0}

function makeSheetPatchSampler(points,extraSheet=18){
  if(!points?.length)return null;
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const x0=Math.min(...xs)-extraSheet,x1=Math.max(...xs)+extraSheet;
  const y0=Math.min(...ys)-extraSheet,y1=Math.max(...ys)+extraSheet;
  const corners=[mapSheet(x0,y0),mapSheet(x1,y0),mapSheet(x1,y1),mapSheet(x0,y1)];
  const minX=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.x))-12));
  const maxX=Math.min(canvas.width-1,Math.ceil(Math.max(...corners.map(p=>p.x))+12));
  const minY=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y))-12));
  const maxY=Math.min(canvas.height-1,Math.ceil(Math.max(...corners.map(p=>p.y))+12));
  if(maxX<=minX||maxY<=minY)return null;
  const w=maxX-minX+1,h=maxY-minY+1,data=ctx.getImageData(minX,minY,w,h).data;
  const darkAtImage=(px,py)=>{
    const ix=Math.round(px)-minX,iy=Math.round(py)-minY;
    if(ix<0||iy<0||ix>=w||iy>=h)return 0;
    let sum=0,n=0;
    for(let yy=Math.max(0,iy-1);yy<=Math.min(h-1,iy+1);yy++){
      for(let xx=Math.max(0,ix-1);xx<=Math.min(w-1,ix+1);xx++){
        const k=(yy*w+xx)*4,g=.299*data[k]+.587*data[k+1]+.114*data[k+2];
        sum+=(255-g)/255;n++;
      }
    }
    return n?sum/n:0;
  };
  return(x,y)=>{const p=mapSheet(x,y);return darkAtImage(p.x,p.y)};
}
function gridRingScore(points,sampler,dx,dy,radiusSheet=4){
  if(!sampler||!points.length)return 0;
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[-.707,.707],[.707,-.707],[-.707,-.707]];
  let sum=0,n=0;
  for(const p of points){
    for(const [ux,uy] of dirs){
      sum+=sampler(p.x+dx+ux*radiusSheet,p.y+dy+uy*radiusSheet);n++;
    }
  }
  return n?sum/n:0;
}
function lockDigitGrid(cols,label='grid'){
  const points=(cols||[]).flatMap(c=>c.vals||[]);
  if(points.length<10)return{dx:0,dy:0,score:0,baseScore:0,confidence:0,locked:false,label};
  const sampler=makeSheetPatchSampler(points,22);
  if(!sampler)return{dx:0,dy:0,score:0,baseScore:0,confidence:0,locked:false,label};
  const baseScore=gridRingScore(points,sampler,0,0,4);
  let best={dx:0,dy:0,score:baseScore};
  for(let dy=-10;dy<=10;dy++){
    for(let dx=-10;dx<=10;dx++){
      const score=gridRingScore(points,sampler,dx,dy,4);
      if(score>best.score)best={dx,dy,score};
    }
  }
  const gain=best.score-baseScore,confidence=Math.max(0,Math.min(1,(best.score-.08)/.22));
  const locked=best.score>=.13;
  if(locked&&(best.dx||best.dy)){
    cols.forEach(c=>{
      c.x=(c.x??0)+best.dx;
      c.vals.forEach(v=>{v.x+=best.dx;v.y+=best.dy});
    });
  }
  return{...best,baseScore,gain,confidence,locked,label};
}
function lockRecognitionGrids(L){
  const id=lockDigitGrid(L.id,'Số hiệu/SBD');
  const exam=lockDigitGrid(L.exam,'Mã đề');
  gridLockState={id,exam};
  return gridLockState;
}

// V4.13 — Answer Grid Auto Calibration
// Mã đề/SBD đã có Grid Lock từ trước, nhưng các cụm A/B/C/D và Đ/S chưa khóa vào
// tâm vòng tròn thật trên ảnh. Chỉ cần lệch vài px do in/scale/camera là lõi ô tô bị đọc hụt.
// Hàm dưới dùng chính viền tròn in sẵn để tìm độ dịch tối ưu cho từng cụm đáp án.
function answerRingScore(points,sampler,dx,dy,radiusSheet=5.55){
  if(!sampler||!points?.length)return 0;
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[-.707,.707],[.707,-.707],[-.707,-.707]];
  let sum=0,n=0;
  for(const p of points){
    for(const [ux,uy] of dirs){sum+=sampler(p.x+dx+ux*radiusSheet,p.y+dy+uy*radiusSheet);n++}
  }
  return n?sum/n:0;
}
function lockAnswerPointSet(points,label='answers'){
  if(!points?.length)return{dx:0,dy:0,score:0,baseScore:0,gain:0,locked:false,label};
  const sampler=makeSheetPatchSampler(points,16);
  if(!sampler)return{dx:0,dy:0,score:0,baseScore:0,gain:0,locked:false,label};
  const baseScore=answerRingScore(points,sampler,0,0);
  let best={dx:0,dy:0,score:baseScore};
  // ±4 sheet px đủ bù sai số camera/in nhưng không thể nhảy sang vòng bên cạnh.
  for(let dy=-4;dy<=4;dy+=1){
    for(let dx=-4;dx<=4;dx+=1){
      const score=answerRingScore(points,sampler,dx,dy);
      if(score>best.score)best={dx,dy,score};
    }
  }
  const gain=best.score-baseScore;
  // Chỉ dịch khi thấy viền vòng tròn đủ rõ. Gain nhỏ vẫn cho phép nếu score tuyệt đối tốt.
  const locked=best.score>=.105 && (gain>=.006 || baseScore>=.105);
  if(locked&&(best.dx||best.dy))for(const p of points){p.x+=best.dx;p.y+=best.dy}
  return{...best,baseScore,gain,locked,label};
}
function medianNumber(arr){
  const a=(arr||[]).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;
  const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
// V4.15 — TF lock ổn định: Phần II chỉ có 8 vòng/câu nên nếu tự tìm ±4px độc lập,
// một ô đã tô hoặc hai vòng chạm nhau có thể kéo Grid Lock sang vị trí khác giữa các frame.
// Vì Phần I đang ổn định, dùng median độ lệch của các cụm MC làm neo toàn trang,
// sau đó Phần II chỉ được tinh chỉnh rất nhỏ quanh neo đó.
function lockTFPointSet(points,label='TF',baseDx=0,baseDy=0){
  if(!points?.length)return{dx:0,dy:0,score:0,baseScore:0,gain:0,locked:false,label};
  const sampler=makeSheetPatchSampler(points,14);
  if(!sampler)return{dx:0,dy:0,score:0,baseScore:0,gain:0,locked:false,label};
  const baseScore=answerRingScore(points,sampler,0,0);
  baseDx=Math.max(-3,Math.min(3,Number(baseDx)||0));
  baseDy=Math.max(-3,Math.min(3,Number(baseDy)||0));
  let best={dx:baseDx,dy:baseDy,score:answerRingScore(points,sampler,baseDx,baseDy)};
  for(let ry=-1.25;ry<=1.251;ry+=.5){
    for(let rx=-1.25;rx<=1.251;rx+=.5){
      const dx=baseDx+rx,dy=baseDy+ry,score=answerRingScore(points,sampler,dx,dy);
      if(score>best.score)best={dx,dy,score};
    }
  }
  const gain=best.score-baseScore;
  // Nếu vòng in không đủ rõ, không cho phép một phép dịch lớn/ngẫu nhiên.
  const locked=best.score>=.09;
  if(locked&&(Math.abs(best.dx)>.01||Math.abs(best.dy)>.01))for(const p of points){p.x+=best.dx;p.y+=best.dy}
  return{...best,baseScore,gain,locked,label,anchorDx:baseDx,anchorDy:baseDy};
}
function lockAnswerGrids(L){
  const mc=[],tf=[];
  for(let gi=0;gi<(L.mcGroups||[]).length;gi++){
    const g=L.mcGroups[gi];
    const qs=(L.mc||[]).filter(q=>q.y>=g.y&&q.y<=g.y+g.h&&q.opts?.length===4);
    const pts=qs.flatMap(q=>q.opts);
    mc.push(lockAnswerPointSet(pts,`MC${gi+1}`));
  }
  const goodMc=mc.filter(x=>x.locked);
  const anchorDx=medianNumber(goodMc.map(x=>x.dx));
  const anchorDy=medianNumber(goodMc.map(x=>x.dy));
  for(let gi=0;gi<(L.tfGroups||[]).length;gi++){
    const g=L.tfGroups[gi];
    const qs=(L.tf||[]).filter(q=>q.x>=g.x-1&&q.x<=g.x+g.w+1&&q.y>=g.y-1&&q.y<=g.y+g.h+1);
    const pts=qs.flatMap(q=>q.items.flatMap(it=>[it.d,it.s]));
    tf.push(lockTFPointSet(pts,`TF${gi+1}`,anchorDx,anchorDy));
  }
  answerGridLockState={mc,tf,tfAnchor:{dx:anchorDx,dy:anchorDy}};
  return answerGridLockState;
}
function answerGridLockText(){
  const fmt=a=>(a||[]).map(x=>`${x.label}:${x.locked?'✓':'–'}(${x.dx>=0?'+':''}${x.dx},${x.dy>=0?'+':''}${x.dy})`).join(' ');
  return `MC ${fmt(answerGridLockState?.mc)} | Đ/S ${fmt(answerGridLockState?.tf)}`;
}
function fillDarknessAtSheet(x,y,rSheet=2.8){
  const p=mapSheet(x,y),sc=Math.max(.3,scaleAt(x,y));
  // Chỉ đo lõi trong vòng tròn, tránh ăn vào viền in.
  const coreSheet=Math.max(.75,Math.min(1.8,rSheet*.46));
  const r=Math.max(.75,coreSheet*sc);
  const x0=Math.max(0,Math.floor(p.x-r)),y0=Math.max(0,Math.floor(p.y-r));
  const x1=Math.min(canvas.width-1,Math.ceil(p.x+r)),y1=Math.min(canvas.height-1,Math.ceil(p.y+r));
  if(x1<x0||y1<y0)return 0;
  const data=ctx.getImageData(x0,y0,x1-x0+1,y1-y0+1).data;
  let sum=0,n=0,k=0;
  for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++,k+=4){
    const dx=xx-p.x,dy=yy-p.y;
    if(dx*dx+dy*dy<=r*r){
      const g=.299*data[k]+.587*data[k+1]+.114*data[k+2];
      sum+=(255-g)/255;n++;
    }
  }
  return n?sum/n:0;
}
// V4.13 — Bubble Ink Score
// Không chỉ nhìn đúng một lõi rất nhỏ ở tâm ô. Với bút chì/bút bi tô lệch tâm,
// cách cũ dễ coi là Trống dù học sinh đã tô. Điểm mực mới lấy vùng trong lớn hơn,
// ưu tiên các pixel tối và thử lệch nhẹ quanh tâm dự kiến để chịu được sai số phối cảnh.
function bubbleInkScoreAtSheet(x,y,rSheet=3.5){
  const sc=Math.max(.3,scaleAt(x,y));
  const innerSheet=Math.max(1.9,Math.min(3.05,rSheet*.76));
  const sampleAt=(sx,sy)=>{
    const p=mapSheet(sx,sy),r=Math.max(1.1,innerSheet*sc);
    const x0=Math.max(0,Math.floor(p.x-r)),y0=Math.max(0,Math.floor(p.y-r));
    const x1=Math.min(canvas.width-1,Math.ceil(p.x+r)),y1=Math.min(canvas.height-1,Math.ceil(p.y+r));
    if(x1<x0||y1<y0)return 0;
    const data=ctx.getImageData(x0,y0,x1-x0+1,y1-y0+1).data,arr=[];let k=0,sum=0,darkN=0,n=0;
    for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++,k+=4){
      const dx=xx-p.x,dy=yy-p.y;if(dx*dx+dy*dy>r*r)continue;
      const g=.299*data[k]+.587*data[k+1]+.114*data[k+2],d=(255-g)/255;
      arr.push(d);sum+=d;if(d>.20)darkN++;n++;
    }
    if(!n)return 0;
    arr.sort((a,b)=>a-b);
    const start=Math.floor(arr.length*.62);let top=0,tn=0;
    for(let i=start;i<arr.length;i++){top+=arr[i];tn++}
    const mean=sum/n,topMean=tn?top/tn:mean,darkRatio=darkN/n;
    return mean*.43+topMean*.42+darkRatio*.15;
  };
  // Tâm dự kiến có thể lệch nhẹ do camera nghiêng/cong giấy. Lệch 0.8 đơn vị
  // vẫn nằm xa viền in của vòng tròn 12px nên không hút nhầm đường viền.
  const d=.8,pts=[[0,0],[d,0],[-d,0],[0,d],[0,-d]];
  let best=0;for(const [dx,dy] of pts)best=Math.max(best,sampleAt(x+dx,y+dy));
  return best;
}
function adaptiveBubbleChoice(points,rSheet=3.5,strict=false){
  const vals=points.map(o=>bubbleInkScoreAtSheet(o.x,o.y,rSheet));
  const order=vals.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v);
  const best=order[0]||{v:0,i:-1},second=order[1]||{v:0,i:-1},sorted=[...vals].sort((a,b)=>a-b);

  // Hai lựa chọn Đ/S: so trực tiếp hai ô. Ngưỡng được hạ vừa đủ để nhận bút chì
  // nhưng vẫn yêu cầu độ chênh giữa hai ô nhằm tránh coi vòng tròn trắng là đã tô.
  if(vals.length===2){
    const baseline=second.v,delta=best.v-baseline;
    const minBest=strict?.115:.10,minDelta=strict?.034:.024;
    if(best.v>=minBest&&second.v>=minBest&&second.v>best.v*.86)
      return{idx:-2,state:'multi',vals,best:best.v,second:second.v,median:baseline,delta};
    if(best.v<minBest||delta<minDelta)
      return{idx:-1,state:'blank',vals,best:best.v,second:second.v,median:baseline,delta};
    return{idx:best.i,state:'one',vals,best:best.v,second:second.v,median:baseline,delta};
  }

  // Với 4 lựa chọn, nền nên lấy trung bình hai ô nhạt nhất thay vì phần tử giữa.
  // Cách này ổn định hơn khi một ô bị bóng/viền in hơi đậm.
  const baseline=sorted.length>=2?(sorted[0]+sorted[1])/2:(sorted[0]||0);
  const delta=best.v-baseline,minBest=strict?.125:.105,minDelta=strict?.040:.028;
  if(best.v<minBest||delta<minDelta)return{idx:-1,state:'blank',vals,best:best.v,second:second.v,median:baseline,delta};
  if(second.v>=minBest&&second.v>best.v*.87&&(second.v-baseline)>minDelta*.72)
    return{idx:-2,state:'multi',vals,best:best.v,second:second.v,median:baseline,delta};
  return{idx:best.i,state:'one',vals,best:best.v,second:second.v,median:baseline,delta};
}
function detectOne(points,rSheet=3.5){return adaptiveBubbleChoice(points,rSheet,false)}
function detectOneTuned(points,rSheet=3.1,minDark=.11,multiRatio=.80){return adaptiveBubbleChoice(points,rSheet,true)}
// V4.15 — Bộ đọc chuyên biệt Đúng/Sai.
// Mỗi ý bắt buộc so sánh một CẶP Đ/S, vì vậy độ chênh giữa hai lõi quan trọng hơn
// một ngưỡng tuyệt đối. Điều này giúp bút chì nhạt vẫn ổn định và giảm trạng thái lúc đúng lúc Trống.
function detectTFPair(points){
  const vals=points.map(o=>bubbleInkScoreAtSheet(o.x,o.y,2.8));
  const ranked=vals.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v);
  const best=ranked[0]||{v:0,i:-1},second=ranked[1]||{v:0,i:-1};
  const delta=best.v-second.v,ratio=best.v>0?second.v/best.v:1;
  // Hai ô cùng rất đậm và gần nhau: học sinh tô cả hai / tẩy chưa sạch nặng.
  if(best.v>=.145&&second.v>=.135&&ratio>=.86)
    return{idx:-2,state:'multi',vals,best:best.v,second:second.v,median:second.v,delta,selected:[0,1]};
  // Chỉ coi là trống khi cả hai rất nhạt hoặc gần như không phân biệt được.
  if((best.v<.072&&delta<.014)||delta<.010)
    return{idx:-1,state:'blank',vals,best:best.v,second:second.v,median:second.v,delta,selected:[]};
  // Với cặp Đ/S, nếu một ô tối hơn rõ ràng thì chọn ô đó, kể cả nét tô khá nhạt.
  if(delta>=.014 || (best.v>=.105&&delta>=.010))
    return{idx:best.i,state:'one',vals,best:best.v,second:second.v,median:second.v,delta,selected:[best.i]};
  return{idx:-1,state:'blank',vals,best:best.v,second:second.v,median:second.v,delta,selected:[]};
}
function readDigits(cols,robust=false){
  let s='',bad=false,states=[],confidence=[];
  for(const c of cols){
    const d=adaptiveBubbleChoice(c.vals,robust?2.8:3.0,robust);
    if(d.idx>=0)s+=c.vals[d.idx].label;else{bad=true;s+='?'}
    states.push(d.state);confidence.push({best:d.best??null,second:d.second??null,median:d.median??null,delta:d.delta??null});
  }
  return{value:s,bad,states,confidence}
}
function examCodeCheck(t,L=null){
  const layout=L||buildLayout(t),r=readDigits(layout.exam,true),exists=!r.bad&&t.versions.some(v=>v.code===r.value);
  return{...r,exists,expected:t.versions.map(v=>v.code)}
}

function bubbleSelection(points,rSheet=3.5){
  const d=adaptiveBubbleChoice(points,rSheet,false),median=d.median??0,minBest=.16,minDelta=.065;
  let selected=[];
  if(Array.isArray(d.vals))selected=d.vals.map((v,i)=>({v,i})).filter(o=>o.v>=minBest&&(o.v-median)>=minDelta*.85).map(o=>o.i);
  if(d.idx>=0&&!selected.includes(d.idx))selected=[d.idx];
  return{...d,selected};
}
function shortKeyMarks(q,key){
  const raw=normalizeShort(key),negative=raw.startsWith('-'),body=negative?raw.slice(1):raw,commaAt=body.indexOf(','),digits=body.replace(',',''),marks=[];
  if(negative)marks.push(q.sign);
  if(commaAt>=0){const c=q.commas.find(x=>x.gap===commaAt);if(c)marks.push(c)}
  for(let p=0;p<digits.length&&p<q.digits.length;p++){const v=q.digits[p].vals.find(x=>x.label===digits[p]);if(v)marks.push(v)}
  return marks;
}
function realtimeEvaluate(t,L,v,rexValue){
  const rid=readDigits(L.id,true),candidateId=rid.bad?'':normalizeCandidateCode(rid.value);
  let mc=[],tf=[],sh=[],mcCorrect=0,tfRaw=0,shCorrect=0;
  L.mc.filter(q=>q.active!==false).forEach((q,i)=>{
    const d=bubbleSelection(q.opts,3.7),ans=d.idx>=0?q.opts[d.idx].label:(d.idx===-2?'Nhiều ô':'Trống'),ok=d.idx>=0&&ans===v.mcKey[i];
    if(ok)mcCorrect++;mc.push({q:q.q,ans,key:v.mcKey[i],ok,selected:d.selected,keyIdx:'ABCD'.indexOf(v.mcKey[i]),layout:q,vals:d.vals||[],best:d.best??0,delta:d.delta??0,state:d.state});
  });
  L.tf.forEach((q,i)=>{
    let correctItems=0,det=[];
    q.items.forEach((it,j)=>{const d=detectTFPair([it.d,it.s]),a=d.idx===0?'Đ':d.idx===1?'S':d.idx===-2?'Nhiều':'Trống',ok=a===v.tfKey[i][j];if(ok)correctItems++;det.push({item:it.item,ans:a,key:v.tfKey[i][j],ok,selected:d.selected,keyIdx:v.tfKey[i][j]==='Đ'?0:1,points:[it.d,it.s],vals:d.vals||[],best:d.best??0,delta:d.delta??0,state:d.state})});
    const raw=+(correctItems*t.tfItemScore).toFixed(2);tfRaw+=raw;tf.push({q:q.q,correctItems,raw,det,layout:q});
  });
  L.short.forEach((q,i)=>{
    let bad=false,digitVals=[],digitSel=[];
    q.digits.forEach(c=>{const d=bubbleSelection(c.vals,2.3);digitSel.push({selected:d.selected,points:c.vals});if(d.idx>=0)digitVals.push(c.vals[d.idx].label);else if(d.idx===-1)digitVals.push('');else{digitVals.push('?');bad=true}});
    let last=-1;for(let k=digitVals.length-1;k>=0;k--)if(digitVals[k]!==''&&digitVals[k]!=='?'){last=k;break}
    if(last>=0){for(let k=0;k<=last;k++)if(digitVals[k]==='')bad=true}
    let digits=last>=0?digitVals.slice(0,last+1).join(''):'';
    const signDark=fillDarknessAtSheet(q.sign.x,q.sign.y,3.7)>.20,commaSel=q.commas.length?bubbleSelection(q.commas,2.3):{idx:-1,selected:[]};
    if(commaSel.idx===-2)bad=true;if(commaSel.idx>=0){const cp=q.commas[commaSel.idx].gap;if(cp>=digits.length)bad=true;else digits=digits.slice(0,cp)+','+digits.slice(cp)}
    if(signDark&&digits)digits='-'+digits;
    const ans=normalizeShort(digits),key=normalizeShort(v.shortKey[i]),ok=!bad&&ans!==''&&ans===key;if(ok)shCorrect++;
    sh.push({q:q.q,ans:ans||'Trống',key,ok,layout:q,digitSel,commaSelected:commaSel.selected,signDark,keyMarks:shortKeyMarks(q,key)});
  });
  const mcPts=t.mcCount?mcCorrect/t.mcCount*t.weights.mc:0,tfPts=tfRaw,shPts=t.shortCount?shCorrect/t.shortCount*t.weights.short:0;
  const possible=t.weights.mc+t.tfCount*4*t.tfItemScore+t.weights.short,totalRaw=mcPts+tfPts+shPts,total=+(possible?totalRaw/possible*t.maxScore:0).toFixed(2),scoreScale=possible?t.maxScore/possible:0;
  const mcPoints=+(mcPts*scoreScale).toFixed(2),tfPoints=+(tfPts*scoreScale).toFixed(2),shortPoints=+(shPts*scoreScale).toFixed(2);
  const scanCtx=assignmentContexts().find(x=>x.key===$('#scanContext').value),scanTarget=$('#scanSource').value==='assigned'?$('#scanTarget').value:'';
  const studentMatch=candidateId?rosterLookup(candidateId,t,scanTarget):null;let resolvedStudent='',resolvedClass='',resolvedRoom='';
  if(studentMatch&&!studentMatch._ambiguous){resolvedStudent=studentMatch.name||'';resolvedClass=studentMatch.className||'';resolvedRoom=normalizeRosterRoom(studentMatch.room)||(targetTypeForTemplate(t)==='room'?scanTarget:'')}
  const historyRow={time:new Date().toISOString(),templateId:t.id,templateName:t.name,testName:t.testName,subject:t.subject,targetType:scanCtx?.type||'',target:scanTarget,idMode:t.idMode,candidateId,studentFromRoster:resolvedStudent,studentClass:resolvedClass||(targetTypeForTemplate(t)==='class'?scanTarget:''),studentRoom:resolvedRoom,rosterMatched:!!resolvedStudent,examCode:rexValue,mcCorrect,mcTotal:t.mcCount,tfRaw:+tfRaw.toFixed(2),tfTotal:t.tfCount,shortCorrect:shCorrect,shortTotal:t.shortCount,score:total,max:t.maxScore,mcPoints,tfPoints,shortPoints,scanMode:scanQuality?.mode||'legacy',auxMarkers:scanQuality?.auxCount||0,localCorrection:!!scanQuality?.localCorrection,mc,tf,sh,liveCamera:true,liveRealtime:true};
  const signature=[candidateId,rexValue,mc.map(x=>x.ans).join(','),tf.flatMap(x=>x.det.map(y=>y.ans)).join(','),sh.map(x=>x.ans).join(',')].join('|');
  return{candidateId,resolvedStudent,resolvedClass,resolvedRoom,mc,tf,sh,mcCorrect,tfRaw,shCorrect,mcPts,tfPts,shPts,total,mcPoints,tfPoints,shortPoints,historyRow,signature};
}
function drawRealtimeRing(pt,color,width=3.3){
  if(!pt||!H)return;const p=mapSheet(pt.x,pt.y),r=Math.max(5,5.5*Math.max(.55,scaleAt(pt.x,pt.y)));ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function drawRealtimeAnswerOverlay(rt){
  const GREEN='#00d26a',RED='#ff3040',YELLOW='#ffd400';
  for(const x of rt.mc){const q=x.layout;if(x.ok&&x.selected.length===1)drawRealtimeRing(q.opts[x.selected[0]],GREEN);else{for(const i of x.selected)if(q.opts[i])drawRealtimeRing(q.opts[i],RED);if(x.keyIdx>=0)drawRealtimeRing(q.opts[x.keyIdx],YELLOW)}}
  for(const q of rt.tf)for(const x of q.det){if(x.ok&&x.selected.length===1)drawRealtimeRing(x.points[x.selected[0]],GREEN);else{for(const i of x.selected)if(x.points[i])drawRealtimeRing(x.points[i],RED);if(x.keyIdx>=0)drawRealtimeRing(x.points[x.keyIdx],YELLOW)}}
  for(const x of rt.sh){const detected=[];if(x.signDark)detected.push(x.layout.sign);x.commaSelected.forEach(i=>{if(x.layout.commas[i])detected.push(x.layout.commas[i])});x.digitSel.forEach(d=>d.selected.forEach(i=>{if(d.points[i])detected.push(d.points[i])}));if(x.ok){detected.forEach(p=>drawRealtimeRing(p,GREEN))}else{detected.forEach(p=>drawRealtimeRing(p,RED));x.keyMarks.forEach(p=>drawRealtimeRing(p,YELLOW))}}
}
function liveOverlayGeometry(){
  const out=$('#liveRealtimeCanvas'),video=$('#liveVideo');if(!out||!video||!canvas.width||!canvas.height)return null;
  const cw=Math.max(1,Math.round(video.clientWidth)),ch=Math.max(1,Math.round(video.clientHeight)),dpr=Math.min(1.25,window.devicePixelRatio||1);
  const ow=Math.round(cw*dpr),oh=Math.round(ch*dpr);if(out.width!==ow||out.height!==oh){out.width=ow;out.height=oh}
  const s=Math.min(cw/canvas.width,ch/canvas.height),dw=canvas.width*s,dh=canvas.height*s,dx=(cw-dw)/2,dy=(ch-dh)/2;
  return{out,g:out.getContext('2d'),cw,ch,dpr,s,dx,dy};
}
function liveScanToOverlay(p,geo){return{x:(geo.dx+p.x*geo.s)*geo.dpr,y:(geo.dy+p.y*geo.s)*geo.dpr}}
function liveSheetToOverlay(pt,geo){if(!pt||!H)return null;return liveScanToOverlay(mapSheet(pt.x,pt.y),geo)}
function drawLiveOverlayRing(g,p,color,dpr,width=3){if(!p)return;g.save();g.strokeStyle=color;g.lineWidth=Math.max(2,width*dpr);g.beginPath();g.arc(p.x,p.y,Math.max(5,5.5*dpr),0,Math.PI*2);g.stroke();g.restore()}
function presentLiveProcessedFrame(rt=null){
  // QUAN TRỌNG: không vẽ lại frame camera lên canvas này.
  // Video bên dưới tiếp tục phát ở FPS thật; canvas chỉ là lớp annotation trong suốt.
  const geo=liveOverlayGeometry();if(!geo)return;const {g,out,dpr}=geo;g.clearRect(0,0,out.width,out.height);
  if(markerPoints?.length===4){
    g.save();g.strokeStyle='rgba(34,197,94,.96)';g.fillStyle='rgba(34,197,94,.16)';g.lineWidth=Math.max(2,2.5*dpr);
    const poly=markerPoints.map(m=>liveScanToOverlay(m,geo));
    g.beginPath();g.moveTo(poly[0].x,poly[0].y);for(let i=1;i<poly.length;i++)g.lineTo(poly[i].x,poly[i].y);g.closePath();g.stroke();
    markerPoints.forEach(m=>{const p=liveScanToOverlay(m,geo);g.beginPath();g.arc(p.x,p.y,7*dpr,0,Math.PI*2);g.fill();g.stroke()});g.restore();
  }
  if(!rt)return;
  const GREEN='#00d26a',RED='#ff3040',YELLOW='#ffd400';
  for(const x of rt.mc){const q=x.layout;if(x.ok&&x.selected.length===1)drawLiveOverlayRing(g,liveSheetToOverlay(q.opts[x.selected[0]],geo),GREEN,dpr);else{for(const i of x.selected)if(q.opts[i])drawLiveOverlayRing(g,liveSheetToOverlay(q.opts[i],geo),RED,dpr);if(x.keyIdx>=0)drawLiveOverlayRing(g,liveSheetToOverlay(q.opts[x.keyIdx],geo),YELLOW,dpr)}}
  for(const q of rt.tf)for(const x of q.det){if(x.ok&&x.selected.length===1)drawLiveOverlayRing(g,liveSheetToOverlay(x.points[x.selected[0]],geo),GREEN,dpr);else{for(const i of x.selected)if(x.points[i])drawLiveOverlayRing(g,liveSheetToOverlay(x.points[i],geo),RED,dpr);if(x.keyIdx>=0)drawLiveOverlayRing(g,liveSheetToOverlay(x.points[x.keyIdx],geo),YELLOW,dpr)}}
  for(const x of rt.sh){const detected=[];if(x.signDark)detected.push(x.layout.sign);x.commaSelected.forEach(i=>{if(x.layout.commas[i])detected.push(x.layout.commas[i])});x.digitSel.forEach(d=>d.selected.forEach(i=>{if(d.points[i])detected.push(d.points[i])}));if(x.ok)detected.forEach(p=>drawLiveOverlayRing(g,liveSheetToOverlay(p,geo),GREEN,dpr));else{detected.forEach(p=>drawLiveOverlayRing(g,liveSheetToOverlay(p,geo),RED,dpr));x.keyMarks.forEach(p=>drawLiveOverlayRing(g,liveSheetToOverlay(p,geo),YELLOW,dpr))}}
}
function resetRealtimeResult(){
  realtimeSignature='';realtimeStableCount=0;realtimeLast=null;$('#liveRealtimeScore')?.classList.remove('show','locked');if($('#saveResult'))$('#saveResult').disabled=true;if($('#liveFreeSave'))$('#liveFreeSave').disabled=true;
}
function renderRealtimeResult(rt,examCode,stableEligible=true){
  if(!rt)return;
  if(!stableEligible){
    // Không xóa sạch tiến trình chỉ vì một frame rung nhẹ. Nếu kết quả OMR vẫn giống nhau,
    // giảm 1 nấc; chỉ reset hoàn toàn khi chính kết quả nhận dạng thay đổi.
    if(realtimeSignature===rt.signature)realtimeStableCount=Math.max(0,realtimeStableCount-1);
    else{realtimeSignature=rt.signature;realtimeStableCount=0}
  }
  else if(realtimeSignature===rt.signature)realtimeStableCount=Math.min(3,realtimeStableCount+1);else{realtimeSignature=rt.signature;realtimeStableCount=1}
  realtimeLast=rt;
  const t=cur($('#scanTpl').value);
  $('#liveRealtimeScore')?.classList.remove('locked');$('#liveRealtimeScore')?.classList.add('show');$('#liveRtExam').textContent=`ĐANG ĐỌC • Mã đề ${examCode}`;$('#liveRtP1').textContent=`P1: ${rt.mcPoints}`;$('#liveRtP2').textContent=`P2: ${rt.tfPoints}`;$('#liveRtP3').textContent=`P3: ${rt.shortPoints}`;$('#liveRtTotal').textContent=`Xem trước: ${rt.total}`;$('#liveRtStudent').textContent=[rt.candidateId?`${candidateLabelForTemplate(t)}: ${rt.candidateId}`:'',rt.resolvedStudent,rt.resolvedClass?`Lớp ${rt.resolvedClass}`:''].filter(Boolean).join(' • ');
  $('#detectedIdLabel').textContent=targetTypeForTemplate(t)==='room'?'SBD nhận được':'Số hiệu nhận được';$('#detectedId').textContent=rt.candidateId||'Không đọc được';$('#detectedExam').textContent=examCode;$('#scoreBox').textContent=`${rt.total} / ${t.maxScore}`;$('#mcScore').textContent=t.mcCount?`${rt.mcCorrect}/${t.mcCount}`:'—';$('#tfScore').textContent=t.tfCount?`${rt.tfRaw.toFixed(2)}/${(t.tfCount*4*t.tfItemScore).toFixed(2)}`:'—';$('#shortScore').textContent=t.shortCount?`${rt.shCorrect}/${t.shortCount}`:'—';
  if(rt.resolvedStudent){$('#studentName').value=rt.resolvedStudent;$('#studentLookupStatus').className='studentLookupStatus ok';$('#studentLookupStatus').textContent=`${rt.candidateId} → ${rt.resolvedStudent}${rt.resolvedClass?' • Lớp '+rt.resolvedClass:''}`}
  $('#gradeSummary').innerHTML=`Realtime OMR • Mã <b>${esc(examCode)}</b> • I <b>${rt.mcPoints}</b> • II <b>${rt.tfPoints}</b> • III <b>${rt.shortPoints}</b> • Tổng <b>${rt.total}</b>.`;
  setLiveHud(4,scanQuality?.auxCount??0,realtimeStableCount,'good',examCode,true);
  if(realtimeStableCount>=3){if($('#saveResult'))$('#saveResult').disabled=true;if(realtimeBuzzSignature!==rt.signature){realtimeBuzzSignature=rt.signature;if(navigator.vibrate)try{navigator.vibrate(70)}catch{}}}else if($('#saveResult'))$('#saveResult').disabled=true
}
function grade(){if($('#scanSource').value==='assigned'&&!$('#scanTarget').value){alert('Hãy chọn lớp hoặc phòng thi đã được phân công.');return}const t=cur($('#scanTpl').value);if(!t){alert('Chưa có mẫu');return}normalizeTemplate(t);if(!imgState){alert('Hãy chụp hoặc chọn ảnh bài làm.');return}if(markerPoints.length!==4||!H){const ok=autoDetectMarkers();if(!ok){drawOverlay();alert('Không nhận được đủ 4 marker chính. Hãy chụp lại hoặc chọn 4 marker thủ công.');return}}scanQuality=analyzeScanQuality();drawOverlay();updateScanQualityUI();if(!scanQuality.ok){setStatus('Ảnh chưa đạt chuẩn Auto OMR v2: '+scanQuality.message+' Hãy chụp lại.','err');alert('Ảnh chưa đạt để chấm chính xác. '+scanQuality.message+'\n\nHãy chụp lại, bảo đảm tờ giấy phẳng, đủ sáng và thấy đủ 4 góc.');return}restoreRawCanvas();
const L=buildLayout(t),gridLock=lockRecognitionGrids(L),answerLock=lockAnswerGrids(L),rid=readDigits(L.id,true),rex=examCodeCheck(t,L),candidateId=rid.bad?'':normalizeCandidateCode(rid.value);$('#detectedIdLabel').textContent=(targetTypeForTemplate(t)==='room'?'SBD nhận được':'Số hiệu nhận được');$('#detectedId').textContent=candidateId||'Không đọc được';$('#detectedExam').textContent=rex.bad?'Không đọc đủ':rex.value;if(rex.bad){setStatus('Không đọc đủ Mã đề. Hãy kiểm tra khối TÔ MÃ ĐỀ: mỗi cột phải tô đúng 1 vòng tròn. App không đọc 3 ô vuông viết tay ở đầu phiếu.','err');$('#gradeSummary').innerHTML='<b>Chưa chấm:</b> chưa đọc đủ Mã đề. Hãy tô đủ các vòng tròn trong khối <b>TÔ MÃ ĐỀ</b>, giữ phiếu phẳng và thử lại.';drawOverlay(L);return}const v=t.versions.find(x=>x.code===rex.value);if(!v){setStatus(`Đọc được mã ${rex.value}, nhưng mẫu hiện tại không có mã này. Các mã hợp lệ: ${rex.expected.join(', ')}.`,'err');$('#gradeSummary').innerHTML=`<b>Chưa chấm:</b> đọc được Mã đề <b>${esc(rex.value)}</b>, nhưng mẫu hiện tại chỉ có: <b>${esc(rex.expected.join(', '))}</b>.`;drawOverlay(L);return}
let mc=[],tf=[],sh=[],annMc=[],annTf=[],annSh=[],mcCorrect=0,tfRaw=0,shCorrect=0;L.mc.filter(q=>q.active!==false).forEach((q,i)=>{const d=bubbleSelection(q.opts,3.7),ans=d.idx>=0?q.opts[d.idx].label:(d.idx===-2?'Nhiều ô':'Trống'),ok=d.idx>=0&&ans===v.mcKey[i];if(ok)mcCorrect++;mc.push({q:q.q,ans,key:v.mcKey[i],ok,vals:d.vals||[],best:d.best??0,delta:d.delta??0,state:d.state});annMc.push({q:q.q,ok,selected:d.selected||[],keyIdx:'ABCD'.indexOf(v.mcKey[i]),layout:q})});L.tf.forEach((q,i)=>{let correctItems=0,det=[],annDet=[];q.items.forEach((it,j)=>{const d=detectTFPair([it.d,it.s]),a=d.idx===0?'Đ':d.idx===1?'S':d.idx===-2?'Nhiều':'Trống',ok=a===v.tfKey[i][j];if(ok)correctItems++;det.push({item:it.item,ans:a,key:v.tfKey[i][j],ok,vals:d.vals||[],best:d.best??0,delta:d.delta??0,state:d.state});annDet.push({item:it.item,ok,selected:d.selected||[],keyIdx:v.tfKey[i][j]==='Đ'?0:1,points:[it.d,it.s]})});const raw=+(correctItems*t.tfItemScore).toFixed(2);tfRaw+=raw;tf.push({q:q.q,correctItems,raw,det});annTf.push({q:q.q,det:annDet,layout:q})});L.short.forEach((q,i)=>{let bad=false,digitVals=[],digitSel=[];q.digits.forEach(c=>{const d=bubbleSelection(c.vals,3.7);digitSel.push({selected:d.selected||[],points:c.vals});if(d.idx>=0)digitVals.push(c.vals[d.idx].label);else if(d.idx===-1)digitVals.push('');else{digitVals.push('?');bad=true}});let last=-1;for(let k=digitVals.length-1;k>=0;k--)if(digitVals[k]!==''&&digitVals[k]!=='?'){last=k;break}if(last>=0){for(let k=0;k<=last;k++)if(digitVals[k]==='')bad=true}let digits=last>=0?digitVals.slice(0,last+1).join(''):'';const signDark=fillDarknessAtSheet(q.sign.x,q.sign.y,3.7)>.20,commaDet=q.commas.length?bubbleSelection(q.commas,3.7):{idx:-1,selected:[]};if(commaDet.idx===-2)bad=true;if(commaDet.idx>=0){const pos=q.commas[commaDet.idx].gap;if(pos>=digits.length)bad=true;else digits=digits.slice(0,pos)+','+digits.slice(pos)}if(signDark&&digits)digits='-'+digits;const ans=normalizeShort(digits),key=normalizeShort(v.shortKey[i]),ok=!bad&&ans!==''&&ans===key;if(ok)shCorrect++;sh.push({q:q.q,ans:ans||'Trống',key,ok});annSh.push({q:q.q,ok,layout:q,digitSel,commaSelected:commaDet.selected||[],signDark,keyMarks:shortKeyMarks(q,key)})});pendingGradeAnnotation={mc:annMc,tf:annTf,sh:annSh};
const scanCtx=assignmentContexts().find(x=>x.key===$('#scanContext').value),scanTarget=$('#scanSource').value==='assigned'?$('#scanTarget').value:'',studentMatch=candidateId?rosterLookup(candidateId,t,scanTarget):null;
let resolvedStudent='',resolvedClass='',resolvedRoom='';
if(studentMatch&&!studentMatch._ambiguous){resolvedStudent=studentMatch.name||'';resolvedClass=studentMatch.className||'';resolvedRoom=normalizeRosterRoom(studentMatch.room)||(targetTypeForTemplate(t)==='room'?scanTarget:'');$('#studentName').value=resolvedStudent;$('#studentLookupStatus').className='studentLookupStatus ok';$('#studentLookupStatus').textContent=`Đã nhận ${candidateLabelForTemplate(t)==='SBD'?'SBD':'Số hiệu'} ${candidateId} → ${resolvedStudent}${resolvedClass?' • Lớp '+resolvedClass:''}${resolvedRoom?' • Phòng '+resolvedRoom:''}.`}
else{$('#studentLookupStatus').className='studentLookupStatus warn';$('#studentLookupStatus').textContent=candidateId?`Đã đọc ${candidateLabelForTemplate(t)==='SBD'?'SBD':'Số hiệu'} ${candidateId} nhưng chưa tìm thấy học sinh duy nhất trong danh sách của ${scanTarget?assignmentDisplayTarget(targetTypeForTemplate(t),scanTarget):'đợt chấm này'}.`:'Không đọc được Số hiệu/SBD. Điểm vẫn có thể chấm nhưng tên học sinh sẽ không tự điền.'}
const mcPts=t.mcCount?mcCorrect/t.mcCount*t.weights.mc:0,tfPts=tfRaw,shPts=t.shortCount?shCorrect/t.shortCount*t.weights.short:0,possible=t.weights.mc+t.tfCount*4*t.tfItemScore+t.weights.short,totalRaw=mcPts+tfPts+shPts,total=+(possible?totalRaw/possible*t.maxScore:0).toFixed(2),scoreScale=possible?t.maxScore/possible:0,mcPoints=+(mcPts*scoreScale).toFixed(2),tfPoints=+(tfPts*scoreScale).toFixed(2),shortPoints=+(shPts*scoreScale).toFixed(2);lastGrade={time:new Date().toISOString(),templateId:t.id,templateName:t.name,testName:t.testName,subject:t.subject,targetType:scanCtx?.type||'',target:scanTarget,idMode:t.idMode,candidateId,studentFromRoster:resolvedStudent,studentClass:resolvedClass||(targetTypeForTemplate(t)==='class'?scanTarget:''),studentRoom:resolvedRoom,rosterMatched:!!resolvedStudent,examCode:rex.value,mcCorrect,mcTotal:t.mcCount,tfRaw:+tfRaw.toFixed(2),tfTotal:t.tfCount,shortCorrect:shCorrect,shortTotal:t.shortCount,score:total,max:t.maxScore,mcPoints,tfPoints,shortPoints,scanMode:scanQuality?.mode||'legacy',auxMarkers:scanQuality?.auxCount||0,localCorrection:!!scanQuality?.localCorrection,mc,tf,sh};$('#scoreBox').textContent=`${total} / ${t.maxScore}`;$('#mcScore').textContent=t.mcCount?`${mcCorrect}/${t.mcCount}`:'—';$('#tfScore').textContent=t.tfCount?`${tfRaw.toFixed(2)}/${(t.tfCount*4*t.tfItemScore).toFixed(2)}`:'—';$('#shortScore').textContent=t.shortCount?`${shCorrect}/${t.shortCount}`:'—';$('#gradeSummary').innerHTML=`${candidateId?`${candidateLabelForTemplate(t)==='SBD'?'SBD':'Số hiệu'} <b>${esc(candidateId)}</b>${resolvedStudent?` → <b>${esc(resolvedStudent)}</b>`:''}.<br>`:''}Đã tự chọn đáp án <b>mã ${esc(rex.value)}</b>. Điểm thô: I <b>${mcPts.toFixed(2)}</b> • II <b>${tfPts.toFixed(2)}</b> • III <b>${shPts.toFixed(2)}</b>.<br><b>Auto OMR v2:</b> ${scanQuality.mode==='v2'?`nhận ${scanQuality.auxCount}/6 marker phụ • hiệu chỉnh cục bộ ${scanQuality.localCorrection?'đã bật':'không cần'}`:'phiếu 4-marker kiểu cũ'}.<br><b>Grid Lock:</b> Số hiệu/SBD Δ(${gridLock.id.dx},${gridLock.id.dy}) • Mã đề Δ(${gridLock.exam.dx},${gridLock.exam.dy}).<br><b>Answer Lock:</b> ${esc(answerGridLockText())}.`;setStatus(scanQuality.mode==='v2'?'Chấm xong bằng Auto OMR v2. Ảnh đã qua kiểm tra chất lượng và hiệu chỉnh vùng.':'Chấm xong ở chế độ tương thích 4-marker. Nên dùng phiếu Auto OMR v2 cho độ ổn định cao hơn.','ok');$('#saveResult').disabled=false;if($('#liveFreeSave'))$('#liveFreeSave').disabled=false;let h='';if(mc.length)h+=`<h3>Phần I</h3><table class="table"><tr><th>Câu</th><th>Nhận dạng</th><th>Đáp án</th><th>KQ</th><th>OMR A/B/C/D</th></tr>${mc.map(x=>`<tr><td>${x.q}</td><td>${x.ans}</td><td>${x.key}</td><td class="${x.ok?'ok':'err'}">${x.ok?'Đúng':'Sai'}</td><td style="font-size:11px;white-space:nowrap">${(x.vals||[]).map(v=>Number(v).toFixed(3)).join(' / ')} • Δ${Number(x.delta||0).toFixed(3)}</td></tr>`).join('')}</table>`;if(tf.length)h+=`<h3>Phần II</h3><table class="table"><tr><th>Câu</th><th>Ý đúng</th><th>Điểm</th><th>Chi tiết</th></tr>${tf.map(x=>`<tr><td>${x.q}</td><td>${x.correctItems}/4</td><td>${x.raw}</td><td>${x.det.map(z=>`${z.item}:${z.ans}/${z.key} [${(z.vals||[]).map(v=>Number(v).toFixed(3)).join('/')} Δ${Number(z.delta||0).toFixed(3)}]`).join(' • ')}</td></tr>`).join('')}</table>`;if(sh.length)h+=`<h3>Phần III</h3><table class="table"><tr><th>Câu</th><th>Nhận dạng</th><th>Đáp án</th><th>KQ</th></tr>${sh.map(x=>`<tr><td>${x.q}</td><td>${esc(x.ans)}</td><td>${esc(x.key)}</td><td class="${x.ok?'ok':'err'}">${x.ok?'Đúng':'Sai'}</td></tr>`).join('')}</table>`;$('#detail').innerHTML=h;drawOverlay(L);drawRealtimeAnswerOverlay({mc:annMc,tf:annTf,sh:annSh});pendingAnnotatedGradeImage=null;makeAnnotatedGradeImage().then(x=>{pendingAnnotatedGradeImage=x}).catch(e=>{console.warn('Không tạo trước được ảnh đã chấm màu',e);pendingAnnotatedGradeImage=null})}
$('#gradeBtn').onclick=grade;$('#scanTpl').onchange=()=>{if($('#scanSource').value==='manual'){const t=cur($('#scanTpl').value);if(t&&$('#detectedIdLabel'))$('#detectedIdLabel').textContent=targetTypeForTemplate(t)==='room'?'SBD nhận được':'Số hiệu nhận được';clearResult()}};function clearResult(){lastGrade=null;clearPendingGradeImage();if($('#saveResult'))$('#saveResult').disabled=true;if($('#liveFreeSave'))$('#liveFreeSave').disabled=true;$('#scoreBox').textContent='-- / 10';$('#mcScore').textContent=$('#tfScore').textContent=$('#shortScore').textContent='--';$('#detectedId').textContent=$('#detectedExam').textContent='--';$('#studentLookupStatus').className='studentLookupStatus';$('#studentLookupStatus').textContent='Chưa nhận diện học sinh.';$('#studentName').value='';$('#gradeSummary').textContent='';$('#detail').innerHTML=''}$('#clearResult').onclick=clearResult;
$('#saveResult').onclick=async()=>{
  if(!lastGrade){alert('Chưa có kết quả để lưu.');return}
  const btn=$('#saveResult');btn.disabled=true;
  const resultId='r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const student=$('#studentName').value.trim()||lastGrade.studentFromRoster||'',mode=getImageMode();
  const row={...lastGrade,id:resultId,student,imageId:null,originalImageId:null,imageMode:mode,imageBytes:0,originalImageBytes:0};
  let imageMsg='Không lưu ảnh.';
  try{
    if(mode!=='none'){
      const originalPacked=await makeStoredImage(mode);
      let gradedPacked=pendingAnnotatedGradeImage;
      if(!gradedPacked)gradedPacked=await makeAnnotatedGradeImage();
      if(originalPacked){
        const originalId='img_'+resultId+'_original';
        await putGradeImage({id:originalId,resultId,variant:'original',createdAt:new Date().toISOString(),blob:originalPacked.blob,mime:originalPacked.mime,ownerUid:scopeId(),originalName:originalPacked.originalName,student,target:row.target,targetType:row.targetType,examCode:row.examCode,templateName:row.templateName,score:row.score});
        const verifyOriginal=await getGradeImageLocal(originalId);if(!verifyOriginal?.blob||verifyOriginal.blob.size<1000)throw new Error('Ảnh gốc chưa được ghi chắc chắn vào IndexedDB.');
        row.originalImageId=originalId;row.originalImageBytes=verifyOriginal.blob.size;if(currentUser&&firebaseCtx)row.originalImageCloudPath=await uploadCloudImage(originalId,verifyOriginal.blob);
      }
      if(gradedPacked){
        const gradedId='img_'+resultId+'_graded';
        await putGradeImage({id:gradedId,resultId,variant:'graded',createdAt:new Date().toISOString(),blob:gradedPacked.blob,mime:gradedPacked.mime,ownerUid:scopeId(),originalName:gradedPacked.originalName,student,target:row.target,targetType:row.targetType,examCode:row.examCode,templateName:row.templateName,score:row.score});
        const verifyGraded=await getGradeImageLocal(gradedId);if(!verifyGraded?.blob||verifyGraded.blob.size<1000)throw new Error('Ảnh đã chấm màu chưa được ghi chắc chắn vào IndexedDB.');
        row.imageId=gradedId;row.imageBytes=verifyGraded.blob.size;if(currentUser&&firebaseCtx)row.imageCloudPath=await uploadCloudImage(gradedId,verifyGraded.blob);
      }
      const kb=n=>Math.max(1,Math.round((n||0)/1024));
      imageMsg=`Đã lưu ${row.originalImageId?'ảnh gốc':''}${row.originalImageId&&row.imageId?' + ':''}${row.imageId?'ảnh đã chấm màu':''}${row.imageId?` (${kb(row.imageBytes)} KB)`:''}.`;
      if(row.imageCloudPath||row.originalImageCloudPath)imageMsg+=' Đã đồng bộ ảnh lên Firebase.';
    }
  }catch(err){
    row.imageError=String(err?.message||err);imageMsg='Kết quả đã lưu nhưng ảnh lưu chưa đầy đủ: '+row.imageError;console.error('Lưu ảnh bài chấm thất bại',err);
  }
  const his=getHistory();
  if(row.candidateId){const dup=his.find(h=>h.candidateId===row.candidateId&&h.targetType===row.targetType&&h.target===row.target&&h.testName===row.testName&&h.subject===row.subject);if(dup&&!confirm(`Đã có kết quả của ${row.student||row.candidateId} trong cùng lớp/phòng và đợt kiểm tra. Vẫn lưu thêm kết quả này?`)){btn.disabled=false;return}}
  his.unshift(row);saveHistory(his);
  await applyImageRetention();renderHistory();btn.disabled=false;
  if(row.liveRealtime){liveCurrentSaved=true;liveAwaitRemoval=true;liveRemovalMisses=0;if(!liveRemovalSince)liveRemovalSince=0;renderFinalLiveResult(lastGrade);if($('#liveFreeSave'))$('#liveFreeSave').disabled=true;setLiveStatus(`Đã lưu ${row.student||row.candidateId||'bài làm'} • ${row.score}/${row.max}. ${imageMsg} Lấy phiếu ra khỏi camera để quét bài tiếp theo.`,row.imageId||mode==='none'?'ok':'warn')}else alert(`Đã lưu kết quả trên thiết bị. ${imageMsg}${row.liveCamera?'\nBấm Quét bài tiếp theo để tiếp tục.':''}`);
}
function historyClassValue(h){return String(h?.studentClass||(h?.targetType==='class'?h.target:'')||'').trim()}
function historyRoomValue(h){return normalizeRosterRoom(h?.studentRoom||(h?.targetType==='room'?h.target:'')||'')}
function historyGroupLabel(h){const cls=historyClassValue(h),room=historyRoomValue(h);if(room&&cls)return`Phòng ${room} • Lớp ${cls}`;if(room)return`Phòng ${room}`;if(cls)return`Lớp ${cls}`;return''}
function historyDerivedKey(h,type=''){if(type==='class'){const v=historyClassValue(h);return v?`class::${v}`:''}if(type==='room'){const v=historyRoomValue(h);return v?`room::${v}`:''}if(h?.target)return`${h.targetType||''}::${h.target}`;return''}
function historyDerivedLabel(h,type=''){if(type==='class'){const v=historyClassValue(h);return v?`Lớp ${v}`:''}if(type==='room'){const v=historyRoomValue(h);return v?`Phòng ${v}`:''}return historyGroupLabel(h)}
function historyFilterState(){return{test:$('#historyFilterTest')?.value||'',subject:$('#historyFilterSubject')?.value||'',type:$('#historyFilterType')?.value||'',target:$('#historyFilterTarget')?.value||''}}
function historyFilteredRows(){const f=historyFilterState();return getHistory().filter(h=>{if(f.test&&String(h.testName||'')!==f.test)return false;if(f.subject&&String(h.subject||'')!==f.subject)return false;if(f.type&&!historyDerivedKey(h,f.type))return false;if(f.target&&historyDerivedKey(h,f.type)!==f.target)return false;return true})}
function setHistoryFilterOptions(id,items,placeholder,valueFn=x=>x,labelFn=x=>x){const el=$(id);if(!el)return;const old=el.value;el.innerHTML=`<option value="">${esc(placeholder)}</option>`+items.map(x=>`<option value="${esc(valueFn(x))}">${esc(labelFn(x))}</option>`).join('');if([...el.options].some(o=>o.value===old))el.value=old}
function refreshHistoryFilterOptions(){const his=getHistory(),tests=[...new Set(his.map(h=>String(h.testName||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')),subjects=[...new Set(his.map(h=>String(h.subject||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));setHistoryFilterOptions('#historyFilterTest',tests,'Tất cả kỳ kiểm tra');setHistoryFilterOptions('#historyFilterSubject',subjects,'Tất cả môn');const type=$('#historyFilterType')?.value||'',targets=[],seen=new Set();if(type){his.forEach(h=>{const key=historyDerivedKey(h,type);if(!key||seen.has(key))return;seen.add(key);targets.push({key,label:historyDerivedLabel(h,type)})})}else{his.forEach(h=>{const key=historyDerivedKey(h,'');if(!key||seen.has(key))return;seen.add(key);targets.push({key,label:historyDerivedLabel(h,'')})})}targets.sort((a,b)=>a.label.localeCompare(b.label,'vi',{numeric:true}));setHistoryFilterOptions('#historyFilterTarget',targets,'Tất cả lớp / phòng',x=>x.key,x=>x.label);const rows=historyFilteredRows(),status=$('#historyExportStatus'),groupType=type||'';if(status){const groups=new Set(rows.map(h=>historyDerivedKey(h,groupType)).filter(Boolean)).size;status.textContent=rows.length?`Đang hiển thị ${rows.length}/${his.length} kết quả • ${groups} nhóm. Excel sẽ xuất đúng dữ liệu đang lọc.`:'Không có kết quả phù hợp bộ lọc.'}}
function historySectionScores(h){
  if([h.mcPoints,h.tfPoints,h.shortPoints].some(v=>Number.isFinite(+v)))return{p1:Number.isFinite(+h.mcPoints)?+h.mcPoints:null,p2:Number.isFinite(+h.tfPoints)?+h.tfPoints:null,p3:Number.isFinite(+h.shortPoints)?+h.shortPoints:null};
  const t=templates.find(x=>x.id===h.templateId)||templates.find(x=>x.name===h.templateName);
  if(!t)return{p1:null,p2:Number.isFinite(+h.tfRaw)?+h.tfRaw:null,p3:null};
  normalizeTemplate(t);
  const raw1=h.mcTotal?((+h.mcCorrect||0)/(+h.mcTotal||1))*(+t.weights?.mc||0):0;
  const raw2=Number.isFinite(+h.tfRaw)?+h.tfRaw:0;
  const raw3=h.shortTotal?((+h.shortCorrect||0)/(+h.shortTotal||1))*(+t.weights?.short||0):0;
  const possible=(+t.weights?.mc||0)+(+t.tfCount||0)*4*(+t.tfItemScore||0)+(+t.weights?.short||0);
  const scale=possible>0?(+h.max||+t.maxScore||10)/possible:1;
  return{p1:+(raw1*scale).toFixed(2),p2:+(raw2*scale).toFixed(2),p3:+(raw3*scale).toFixed(2)};
}
function historyExcelAoa(rows){
  const head=['STT','Họ và tên','Lớp','Phòng thi','Số hiệu / SBD','Kỳ kiểm tra','Môn','Mã đề','Mẫu','Đúng Phần I','Tổng câu I','Điểm Phần I','Điểm Phần II','Đúng Phần III','Tổng câu III','Điểm Phần III','Điểm OMR','Thang điểm','Thời gian chấm','Chế độ quét','Marker phụ','Ảnh'];
  const body=rows.map((h,i)=>{
    const p=historySectionScores(h);
    return[i+1,h.student||'',historyClassValue(h),historyRoomValue(h),h.candidateId||'',h.testName||'',h.subject||'',h.examCode||'',h.templateName||'',h.mcCorrect??'',h.mcTotal??'',p.p1??'',p.p2??'',h.shortCorrect??'',h.shortTotal??'',p.p3??'',Number.isFinite(+h.score)?+h.score:'',Number.isFinite(+h.max)?+h.max:'',new Date(h.time).toLocaleString('vi-VN'),h.scanMode||'',h.auxMarkers??'',(h.imageId||h.originalImageId)?'Có':'Không'];
  });
  return[head,...body];
}
function historyStatsAoa(rows,groupType=''){const mp=new Map();rows.forEach(h=>{const key=historyDerivedKey(h,groupType)||'unassigned',name=historyDerivedLabel(h,groupType)||'Chưa phân nhóm';if(!mp.has(key))mp.set(key,{name,count:0,sum:0,n:0,hi:null,lo:null});const a=mp.get(key);a.count++;const sc=Number(h.score);if(Number.isFinite(sc)){a.sum+=sc;a.n++;a.hi=a.hi===null?sc:Math.max(a.hi,sc);a.lo=a.lo===null?sc:Math.min(a.lo,sc)}});const data=[...mp.values()].sort((a,b)=>a.name.localeCompare(b.name,'vi',{numeric:true}));return[['Nhóm','Số bài','Điểm trung bình','Cao nhất','Thấp nhất'],...data.map(a=>[a.name,a.count,a.n?+(a.sum/a.n).toFixed(2):'',a.hi??'',a.lo??''])]}
function uniqueExcelSheetName(base,used){
  let name=String(base||'Sheet').replace(/[\\/?*\[\]:]/g,'_').slice(0,31)||'Sheet',n=2;
  const root=name;
  while(used.has(name)){const suf='_'+n++;name=(root.slice(0,31-suf.length)+suf)}
  used.add(name);return name;
}
async function exportHistoryExcel(){
  const rows=historyFilteredRows(),status=$('#historyExportStatus');
  if(!rows.length){alert('Không có kết quả phù hợp bộ lọc để xuất.');return}
  if(status)status.textContent='Đang tạo file Excel…';
  try{
    const XLSX=await loadSheetJs(),wb=XLSX.utils.book_new(),used=new Set();
    const add=(name,aoa)=>{
      const ws=XLSX.utils.aoa_to_sheet(aoa);
      const colCount=Math.max(...aoa.map(r=>r.length));
      ws['!cols']=Array.from({length:colCount},(_,i)=>({wch:Math.min(34,Math.max(10,...aoa.slice(0,120).map(r=>String(r[i]??'').length+2)))}));
      XLSX.utils.book_append_sheet(wb,ws,uniqueExcelSheetName(name,used));
    };
    add('Tong hop',historyExcelAoa(rows));
    const f=historyFilterState(),groupType=f.type||'';add('Thong ke',historyStatsAoa(rows,groupType));
    const groups=new Map();
    rows.forEach(h=>{const key=historyDerivedKey(h,groupType);if(!key)return;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(h)});
    [...groups.entries()].sort((a,b)=>historyDerivedLabel(a[1][0],groupType).localeCompare(historyDerivedLabel(b[1][0],groupType),'vi',{numeric:true})).forEach(([key,arr])=>{
      const label=historyDerivedLabel(arr[0],groupType),prefix=(groupType==='class'||key.startsWith('class::'))?'Lop_':(groupType==='room'||key.startsWith('room::'))?'Phong_':'Nhom_';add(prefix+safeKeyFileName(label.replace(/^Lớp |^Phòng /,'')),historyExcelAoa(arr));
    });
    const parts=['OMR_Diem'];
    if(f.test)parts.push(safeKeyFileName(f.test));
    if(f.subject)parts.push(safeKeyFileName(f.subject));
    if(f.target){const h=rows[0];parts.push(safeKeyFileName(historyGroupLabel(h)))}
    else if(f.type)parts.push(f.type==='class'?'Theo_lop':'Theo_phong');
    parts.push(new Date().toISOString().slice(0,10));
    XLSX.writeFile(wb,parts.join('_')+'.xlsx');
    if(status)status.textContent=`Đã xuất ${rows.length} kết quả ra Excel • ${groups.size} lớp/phòng.`;
  }catch(e){console.error(e);if(status)status.textContent='Xuất Excel thất bại.';alert('Không xuất được Excel: '+(e?.message||e))}
}

function clearHistoryThumbUrls(){historyThumbUrls.forEach(u=>{try{URL.revokeObjectURL(u)}catch{}});historyThumbUrls=[]}
async function hydrateHistoryThumbnails(){
  clearHistoryThumbUrls();
  const imgs=[...document.querySelectorAll('img.historyThumb[data-image-id]')];
  await Promise.all(imgs.map(async img=>{
    const id=img.dataset.imageId;if(!id)return;
    try{
      const rec=await getGradeImage(id),wrap=img.closest('.historyThumbBtn');
      if(!rec?.blob){if(wrap){wrap.classList.add('missing');const sp=wrap.querySelector('span');if(sp)sp.textContent='Ảnh không còn';}return}
      const u=URL.createObjectURL(rec.blob);historyThumbUrls.push(u);img.src=u;img.onload=()=>{img.classList.add('ready');const sp=wrap?.querySelector('span');if(sp)sp.style.display='none'};
    }catch(e){const wrap=img.closest('.historyThumbBtn');if(wrap){wrap.classList.add('missing');const sp=wrap.querySelector('span');if(sp)sp.textContent='Không tải được ảnh'}}
  }));
}
function renderHistory(){
  renderRosterManager();
  refreshHistoryFilterOptions();
  const his=historyFilteredRows();
  $('#historyBody').innerHTML=his.map(h=>{
    const primaryId=h.imageId||h.originalImageId;
    const imageCell=primaryId
      ?`<div class="historyImageWrap"><button class="historyThumbBtn" onclick="viewGradeImage('${esc(primaryId)}','${esc(h.id||'')}','${h.imageId?'graded':'original'}')" title="Mở ảnh bài làm"><img class="historyThumb" data-image-id="${esc(primaryId)}" alt="Ảnh bài làm"><span>Đang tải ảnh…</span></button><div class="historyImageActions">${h.imageId?`<button class="imgViewBtn graded" onclick="viewGradeImage('${esc(h.imageId)}','${esc(h.id||'')}','graded')">Đã chấm</button>`:''}${h.originalImageId?`<button class="imgViewBtn original" onclick="viewGradeImage('${esc(h.originalImageId)}','${esc(h.id||'')}','original')">Ảnh gốc</button>`:''}<button class="imgDownloadBtn" onclick="downloadGradeImage('${esc(primaryId)}','${esc(h.id||'')}','${h.imageId?'graded':'original'}')">Tải</button><button class="imgDeleteBtn" onclick="removeGradeImages('${esc(h.id||'')}')">Xóa ảnh</button></div></div>`
      :`<span class="noImageBadge" title="${esc(h.imageError||'')}">${h.imageExpired?'Đã tự xóa':h.imageError?'Lỗi lưu ảnh':'Không có ảnh'}</span>`;
    return `<tr><td>${new Date(h.time).toLocaleString('vi-VN')}</td><td>${esc(h.student||'')}</td><td>${esc(historyGroupLabel(h))}</td><td>${esc(h.candidateId||'')}</td><td>${esc(h.examCode||'')}</td><td>${esc(h.templateName)}</td><td>${h.mcCorrect}/${h.mcTotal}</td><td>${h.tfRaw}/${h.tfTotal}</td><td>${h.shortCorrect}/${h.shortTotal}</td><td>${h.score}/${h.max}</td><td>${imageCell}</td></tr>`
  }).join('');
  void hydrateHistoryThumbnails();
  refreshPdfGroupOptions();
}

function closeImageViewer(){
  $('#imageViewer').classList.remove('open');
  $('#imageViewerImg').removeAttribute('src');
  if(currentViewerUrl){URL.revokeObjectURL(currentViewerUrl);currentViewerUrl=null}
  currentViewerImageId=null;currentViewerKind='graded';currentViewerResultId='';
}
$('#closeImageViewer').onclick=closeImageViewer;
$('#imageViewer').onclick=e=>{if(e.target===$('#imageViewer'))closeImageViewer()};
window.viewGradeImage=async(imageId,resultId='',kind='graded')=>{
  try{
    const rec=await getGradeImage(imageId);if(!rec){alert('Ảnh không còn trên thiết bị.');return}
    if(currentViewerUrl)URL.revokeObjectURL(currentViewerUrl);currentViewerUrl=URL.createObjectURL(rec.blob);currentViewerImageId=imageId;
    const h=getHistory().find(x=>x.id===resultId);currentViewerKind=kind;currentViewerResultId=resultId;
    const label=kind==='original'?'Ảnh gốc':'Ảnh đã chấm màu';$('#imageViewerTitle').textContent=h?`${label} • ${h.student||'Học sinh'} • Mã ${h.examCode||''} • ${h.score}/${h.max}`:label;
    $('#imageViewerImg').src=currentViewerUrl;$('#imageViewer').classList.add('open');
    if($('#viewerGradedBtn'))$('#viewerGradedBtn').disabled=!h?.imageId;if($('#viewerOriginalBtn'))$('#viewerOriginalBtn').disabled=!h?.originalImageId;
  }catch(e){alert('Không mở được ảnh: '+(e?.message||e))}
};
window.downloadGradeImage=async(imageId,resultId='',kind='graded')=>{
  try{const rec=await getGradeImage(imageId);if(!rec){alert('Ảnh không còn trên thiết bị.');return}const h=getHistory().find(x=>x.id===resultId)||{},a=document.createElement('a'),u=URL.createObjectURL(rec.blob);a.href=u;a.download=(kind==='original'?'Goc_':'Da_cham_')+historyImageFileName(h,rec);document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}catch(e){alert('Không tải được ảnh: '+(e?.message||e))}
};
window.removeGradeImages=async(resultId='')=>{
  if(!confirm('Xóa cả ảnh gốc và ảnh đã chấm màu của bài này? Kết quả điểm vẫn được giữ lại.'))return;
  try{const his=getHistory(),h=his.find(x=>x.id===resultId);if(!h)return;for(const id of [h.imageId,h.originalImageId].filter(Boolean))await deleteGradeImage(id);for(const cp of [h.imageCloudPath,h.originalImageCloudPath].filter(Boolean))await deleteCloudImage(cp);h.imageId=null;h.originalImageId=null;h.imageCloudPath=null;h.originalImageCloudPath=null;h.imageDeleted=true;saveHistory(his);renderHistory();if(currentViewerResultId===resultId)closeImageViewer()}catch(e){alert('Không xóa được ảnh: '+(e?.message||e))}
};
window.removeGradeImage=(imageId,resultId='')=>window.removeGradeImages(resultId||getHistory().find(x=>x.imageId===imageId||x.originalImageId===imageId)?.id||'');
$('#downloadViewerImage').onclick=()=>{if(currentViewerImageId)downloadGradeImage(currentViewerImageId,currentViewerResultId,currentViewerKind)};
if($('#viewerGradedBtn'))$('#viewerGradedBtn').onclick=()=>{const h=getHistory().find(x=>x.id===currentViewerResultId);if(h?.imageId)viewGradeImage(h.imageId,h.id,'graded')};
if($('#viewerOriginalBtn'))$('#viewerOriginalBtn').onclick=()=>{const h=getHistory().find(x=>x.id===currentViewerResultId);if(h?.originalImageId)viewGradeImage(h.originalImageId,h.id,'original')};

$('#downloadRosterTemplate').onclick=downloadRosterTemplate;
$('#importRosterBtn').onclick=()=>$('#rosterFileInput').click();
$('#rosterFileInput').onchange=async e=>{const f=e.target.files?.[0];if(f)await importRosterFile(f);e.target.value=''};
$('#applyRosterHistory').onclick=applyRosterToExistingHistory;
$('#clearRosterBtn').onclick=()=>{if(studentRoster.length&&confirm('Xóa toàn bộ danh sách học sinh đã nhập?')){studentRoster=[];saveRoster();renderHistory()}};
$('#historyFilterTest').onchange=renderHistory;
$('#historyFilterSubject').onchange=renderHistory;
$('#historyFilterType').onchange=()=>{$('#historyFilterTarget').value='';renderHistory()};
$('#historyFilterTarget').onchange=renderHistory;
$('#clearHistoryFilter').onclick=()=>{['historyFilterTest','historyFilterSubject','historyFilterType','historyFilterTarget'].forEach(id=>{$('#'+id).value=''});renderHistory()};
$('#exportHistoryExcel').onclick=exportHistoryExcel;

$('#exportCsv').onclick=()=>{const his=getHistory();let csv='\ufeffThời gian,Học sinh,Lớp,Phòng,Số hiệu/SBD,Loại kiểm tra,Môn,Mã đề,Mẫu,Đúng phần I,Tổng I,Điểm phần II,Số câu II,Đúng phần III,Tổng III,Điểm tổng,Thang điểm,Ảnh đã lưu\n'+his.map(h=>[new Date(h.time).toLocaleString('vi-VN'),h.student,historyClassValue(h),historyRoomValue(h),h.candidateId||'',h.testName||'',h.subject||'',h.examCode,h.templateName,h.mcCorrect,h.mcTotal,h.tfRaw,h.tfTotal,h.shortCorrect,h.shortTotal,h.score,h.max,(h.imageId||h.originalImageId)?'Có':'Không'].map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='ket_qua_OMR_auto.csv';a.click()}
window.addEventListener('resize',fitSheet);
lockAppToLogin('Đang kết nối hệ thống…');
bindSectionToggle('mcEnabled','mcConfigRow');bindSectionToggle('tfEnabled','tfConfigRow');bindSectionToggle('shortEnabled','shortConfigRow');
updateExamOrganizationUI();loadAssignments();migrate();templates.forEach(normalizeTemplate);cleanupAssignments();saveAll();
currentProfile={};renderAccountState();initImageSettings();refreshSelects();fitSheet();renderRosterManager();
applyImageRetention().then(()=>renderHistory()).catch(()=>{});
initFirebaseFromSaved().then(ok=>{if(!ok)lockAppToLogin('Không kết nối được Firebase. Vui lòng kiểm tra mạng hoặc liên hệ Super Admin.')});
