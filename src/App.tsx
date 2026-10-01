import { Suspense, lazy, useMemo } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { Confetti } from './components/Confetti';
import { ErrorState } from './pages/errors/ErrorState';
import { useRipple } from './hooks/useRipple';
import { detectCapabilities } from './lib/capabilities';
import Landing from './pages/Landing';

// Code-split the heavier routes so the landing page loads fast on arrival.
const Upload = lazy(() => import('./pages/Upload'));
const MyPhotos = lazy(() => import('./pages/MyPhotos'));
const Gallery = lazy(() => import('./pages/Gallery'));
const UploadStatus = lazy(() => import('./pages/UploadStatus'));
const NotFound = lazy(() => import('./pages/errors/NotFound'));

export default function App() {
  const { pathname } = useLocation();
  const hideTabs = pathname === '/'; // landing has its own big actions
  const caps = useMemo(() => detectCapabilities(), []);
  useRipple();

  if (!caps.usable) {
    return (
      <div className="app-shell">
        <ErrorState
          emoji="🧭"
          title="This browser needs an update"
          message="Your browser is missing features we need to share photos. Please open this page in the latest Safari or Chrome, and it'll work beautifully."
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Confetti />
      <Suspense fallback={<div className="page" aria-busy="true" />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/photos" element={<MyPhotos />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/upload-status" element={<UploadStatus />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {!hideTabs && <TabBar />}
    </div>
  );
}
