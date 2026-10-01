import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  onCapture: (file: File) => void;
  onClose: () => void;
}

/**
 * Live camera via getUserMedia. If it isn't available/permitted, the parent
 * should fall back to a native <input capture> picker. We prefer the rear
 * camera (facingMode: environment) and let the guest take MANY photos without
 * leaving — each capture fires onCapture and the viewfinder stays open.
 */
export function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 } },
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
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const snap = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
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
  }, [onCapture]);

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
      <video ref={videoRef} className="camera-video" playsInline muted aria-label="Camera viewfinder" />
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
        <span style={{ width: 72, textAlign: 'center', color: 'var(--ink-soft)', fontSize: '0.8rem' }}>
          {count > 0 ? `${count} taken` : ''}
        </span>
      </div>
    </div>
  );
}
