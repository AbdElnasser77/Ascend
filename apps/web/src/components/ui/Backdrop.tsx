/**
 * App-wide background: a black-to-purple radial wash
 * with a soft glow in the top-right corner. Fixed behind everything.
 */
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop-glow" />
    </div>
  );
}
