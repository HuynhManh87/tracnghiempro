let initialized = false;
let reloadingForUpdate = false;

export function isPwaStandalone(){
  return window.matchMedia?.('(display-mode: standalone)').matches === true || window.navigator.standalone === true;
}

function emit(name, detail={}){
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function initPwa(){
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.__PWA_INSTALL_PROMPT__ = window.__PWA_INSTALL_PROMPT__ || null;
  window.__PWA_UPDATE_REG__ = window.__PWA_UPDATE_REG__ || null;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    window.__PWA_INSTALL_PROMPT__ = event;
    emit('pwa-install-available');
  });

  window.addEventListener('appinstalled', () => {
    window.__PWA_INSTALL_PROMPT__ = null;
    emit('pwa-installed');
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
        window.__PWA_REGISTRATION__ = reg;

        if (reg.waiting && navigator.serviceWorker.controller) {
          window.__PWA_UPDATE_REG__ = reg;
          emit('pwa-update-available');
        }

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              window.__PWA_UPDATE_REG__ = reg;
              emit('pwa-update-available');
            }
          });
        });
      } catch (err) {
        console.warn('PWA Service Worker registration failed:', err);
      }
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloadingForUpdate) return;
      reloadingForUpdate = false;
      window.location.reload();
    });
  }
}

export async function requestPwaInstall(){
  const promptEvent = window.__PWA_INSTALL_PROMPT__;
  if (!promptEvent) return { available:false };
  promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  if (choice?.outcome === 'accepted') window.__PWA_INSTALL_PROMPT__ = null;
  return { available:true, outcome:choice?.outcome || 'unknown' };
}

export function activatePwaUpdate(){
  const reg = window.__PWA_UPDATE_REG__;
  const worker = reg?.waiting;
  if (!worker) return false;
  reloadingForUpdate = true;
  worker.postMessage({ type:'SKIP_WAITING' });
  return true;
}
