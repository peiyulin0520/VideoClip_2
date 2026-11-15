import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/styles.css';
import { registerAppWorker } from './app/appRecovery';
import { useUI } from './store/uiStore';

registerAppWorker(() => useUI.setState({ appUpdateReady: true }));
window.addEventListener('vite:preloadError', (event) => {
  const error = (event as Event & { payload?: unknown }).payload;
  useUI.setState({
    previewLoad: {
      progress: useUI.getState().previewLoad?.progress ?? 80,
      message: '程式元件尚未就緒',
      error: `Importing a module script failed. ${String(error ?? '')}`,
      canSkip: false,
    },
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
