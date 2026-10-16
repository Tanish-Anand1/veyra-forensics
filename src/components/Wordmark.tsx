export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`veyra-wordmark ${className}`}
      role="img"
      aria-label="VEYRA"
    >
      <span aria-hidden="true">
        <span>V</span>
        <span>E</span>
        <span>Y</span>
        <span>R</span>
        <span>A</span>
      </span>
    </span>
  );
}
