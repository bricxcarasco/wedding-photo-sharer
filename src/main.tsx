import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './theme.css';
import App from './App';
import { ToastProvider } from './components/Toast';
import { uploadEngine } from './lib/uploadEngine';
import { getGuestId } from './lib/guest';

// Mint/resolve the anonymous guest id early, then boot the upload engine so a
// persisted queue resumes on return.
void getGuestId().then(() => uploadEngine.start());

// Register the service worker (PWA shell + Android background-sync nudge).
// Progressive enhancement only — the app is fully usable without it.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW optional; ignore failures */
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
