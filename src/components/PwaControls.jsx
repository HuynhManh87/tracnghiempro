import { useEffect, useMemo, useState } from 'react';
import { activatePwaUpdate, isPwaStandalone, requestPwaInstall } from '../pwa';

function isiOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isSafari(){
  return /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(navigator.userAgent);
}

export default function PwaControls(){
  const [installed,setInstalled]=useState(()=>isPwaStandalone());
  const [canPrompt,setCanPrompt]=useState(()=>!!window.__PWA_INSTALL_PROMPT__);
  const [hasUpdate,setHasUpdate]=useState(()=>!!window.__PWA_UPDATE_REG__?.waiting);
  const iosSafari=useMemo(()=>isiOS() && isSafari(),[]);

  useEffect(()=>{
    const onInstall=()=>setCanPrompt(true);
    const onInstalled=()=>{setInstalled(true);setCanPrompt(false);};
    const onUpdate=()=>setHasUpdate(true);
    const media=window.matchMedia?.('(display-mode: standalone)');
    const onMode=()=>setInstalled(isPwaStandalone());
    window.addEventListener('pwa-install-available',onInstall);
    window.addEventListener('pwa-installed',onInstalled);
    window.addEventListener('pwa-update-available',onUpdate);
    media?.addEventListener?.('change',onMode);
    return ()=>{
      window.removeEventListener('pwa-install-available',onInstall);
      window.removeEventListener('pwa-installed',onInstalled);
      window.removeEventListener('pwa-update-available',onUpdate);
      media?.removeEventListener?.('change',onMode);
    };
  },[]);

  const install=async()=>{
    const result=await requestPwaInstall();
    if(result.available) return;
    if(iosSafari){
      alert('Trên iPhone/iPad: mở app bằng Safari → bấm nút Chia sẻ → chọn “Thêm vào Màn hình chính”.');
      return;
    }
    alert('Trình duyệt chưa phát tín hiệu cài PWA. Hãy mở menu trình duyệt và chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”. Nếu đã cài, hãy mở OMR Mobile từ biểu tượng ngoài màn hình chính.');
  };

  const update=()=>{
    if(!activatePwaUpdate()){
      setHasUpdate(false);
      window.location.reload();
    }
  };

  return (
    <>
      {!installed && (canPrompt || iosSafari) && (
        <button className="pwaInstallBtn" type="button" onClick={install}>Cài ứng dụng</button>
      )}
      {installed && <span className="pwaInstalledBadge">PWA</span>}
      {hasUpdate && (
        <button className="pwaUpdateBtn" type="button" onClick={update}>Có bản mới</button>
      )}
    </>
  );
}
