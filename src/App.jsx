import { useEffect } from 'react';
import AppHeader from './components/AppHeader';
import AppTabs from './components/AppTabs';
import AuthGate from './components/AuthGate';
import ImageViewer from './components/ImageViewer';
import AdminTeacherDetail from './components/AdminTeacherDetail';
import TemplatesPanel from './components/panels/TemplatesPanel';
import AnswerKeysPanel from './components/panels/AnswerKeysPanel';
import PrintPanel from './components/panels/PrintPanel';
import CameraPanel from './components/panels/CameraPanel';
import HistoryPanel from './components/panels/HistoryPanel';
import AccountPanel from './components/panels/AccountPanel';
import AdminPanel from './components/panels/AdminPanel';
import { loadOmrEngine } from './legacy/loadEngine';

export default function App(){
  useEffect(()=>{
    loadOmrEngine().catch(err=>{
      console.error(err);
      const el=document.getElementById('gateStatus');
      if(el) el.textContent='Không khởi động được OMR Engine. Vui lòng tải lại trang.';
    });
  },[]);

  return (
    <>
      <div id="appShell">
        <AppHeader/>
        <div className="wrap">
          <AppTabs/>
          <TemplatesPanel/>
          <AnswerKeysPanel/>
          <PrintPanel/>
          <CameraPanel/>
          <HistoryPanel/>
          <AdminPanel/>
          <AccountPanel/>
          <ImageViewer/>
        </div>
        <AdminTeacherDetail/>
      </div>
      <AuthGate/>
    </>
  );
}
