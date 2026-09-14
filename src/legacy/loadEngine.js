let enginePromise;
export function loadOmrEngine(){
  if(window.__OMR_ENGINE_READY__) return Promise.resolve();
  if(enginePromise) return enginePromise;
  enginePromise = new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-omr-engine="v4"]');
    if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
    const s=document.createElement('script');
    s.src='/omr-engine-v4.js?v=4.17-short-match-mc';
    s.async=false;
    s.dataset.omrEngine='v4';
    s.onload=()=>{window.__OMR_ENGINE_READY__=true;resolve();};
    s.onerror=()=>reject(new Error('Không tải được OMR Engine v4.17'));
    document.body.appendChild(s);
  });
  return enginePromise;
}
