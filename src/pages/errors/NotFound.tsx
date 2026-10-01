import { ErrorState } from './ErrorState';

export default function NotFound() {
  return (
    <ErrorState
      emoji="🕊️"
      title="Page not found"
      message="That page floated away like confetti. Let's get you back to the celebration."
    />
  );
}
