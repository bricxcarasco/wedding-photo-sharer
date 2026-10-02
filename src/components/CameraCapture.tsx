import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraFlipIcon } from './CameraFlipIcon';

interface Props {
  onCapture: (file: File) => void;
  onClose: () => void;
}

type Facing = 'environment' | 'user';

/**
 * Live camera via getUserMedia. If it isn't available/permitted, the parent
 * should fall back to a native <input capture> picker. We start on the rear
 * camera (facingMode: environment) and let the guest flip between the back and
 * front cameras, and take MANY photos without leaving — each capture fires
 * onCapture and the viewfinder stays open.
 */
export function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [facing, setFacing] = useState<Facing>('environment');

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        // Stop any existing stream before switching cameras.
        stopStream();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 2560 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (e) {
        setError(
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Camera permission was denied. You can still choose photos from your library.'
            : 'This browser blocked live camera access. You can still choose photos from your library.'
        );
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facing, stopStream]);

  const flipCamera = useCallback(() => {
    setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
  }, []);

  const snap = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror front-camera captures so the saved photo matches the preview.
    if (facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCount((c) => c + 1);
        onCapture(file);
      },
      'image/jpeg',
      0.95
    );
  }, [onCapture, facing]);

  if (error) {
    return (
      <div className="card" role="alert">
        <p style={{ margin: '0 0 12px', color: 'var(--ink-soft)' }}>{error}</p>
        <button className="btn secondary" onClick={onClose}>
          Choose from library instead
        </button>
      </div>
    );
  }

  return (
    <div>
      <video
        ref={videoRef}
        className={`camera-video${facing === 'user' ? ' mirror' : ''}`}
        playsInline
        muted
        aria-label="Camera viewfinder"
      />
      <div className="cam-controls">
        <button className="btn ghost" style={{ width: 'auto' }} onClick={onClose}>
          Done
        </button>
        <button
          className="shutter"
          aria-label="Take photo"
          disabled={!ready}
          onClick={snap}
        />
        <button
          className="cam-flip"
          aria-label={facing === 'environment' ? 'Switch to front camera' : 'Switch to back camera'}
          title={facing === 'environment' ? 'Switch to front camera' : 'Switch to back camera'}
          onClick={flipCamera}
        >
          <CameraFlipIcon />
        </button>
      </div>
      {count > 0 && (
        <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: '0.8rem', marginTop: 8 }}>
          {count} taken
        </p>
      )}
    </div>
  );
}
