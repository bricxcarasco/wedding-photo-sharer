interface Props {
  size?: number;
  className?: string;
}

/**
 * Custom "switch camera" icon with a sage-green wedding motif: a little camera
 * body wrapped by two curved rotation arrows that suggest flipping between the
 * front and back lenses. Uses `currentColor` so the parent controls the hue
 * (we drive it with the sage palette), with a soft sage fill on the lens.
 */
export function CameraFlipIcon({ size = 26, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="presentation"
      aria-hidden="true"
    >
      {/* Camera body — kept compact in the center band so the arrows can wrap
          around it with clear breathing room above and below. */}
      <path d="M9 13.5h2.3l1.15-1.8a0.9 0.9 0 0 1 .76-.42h5.68a0.9 0.9 0 0 1 .76.42L21.7 13.5H23a1.3 1.3 0 0 1 1.3 1.3v4.9a1.3 1.3 0 0 1-1.3 1.3H9A1.3 1.3 0 0 1 7.7 19.7v-4.9A1.3 1.3 0 0 1 9 13.5Z" />
      {/* Lens — soft sage fill */}
      <circle cx="16" cy="17.2" r="2.5" fill="var(--sage-light)" stroke="currentColor" />
      {/* Rotation arrows wrapping the camera, pushed out to the edges so they
          don't overlap the camera body. */}
      <path d="M8 5.6a10 10 0 0 1 13 1" />
      <path d="M21.4 3.3l.5 3.6-3.6.5" />
      <path d="M24 28.4a10 10 0 0 1-13-1" />
      <path d="M10.6 30.7l-.5-3.6 3.6-.5" />
    </svg>
  );
}
