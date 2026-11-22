export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/brand/ascend-icon.png" alt="Ascend" className="brand-logo" />
        <p className="brand-slogan">
          Don’t count the days.
          <br />
          <span className="gradient-text">Make the days count.</span>
        </p>
      </div>

      <nav className="nav">
        <a className="nav-item active" href="/" aria-current="page">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          Home
        </a>
      </nav>

      <p className="sidebar-foot">
        a product by <b>Metamorphix</b>
      </p>
    </aside>
  );
}
