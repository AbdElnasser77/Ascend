import { House, ListChecks, LogOut } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { User } from "../lib/api";
import type { Route } from "../lib/useRoute";

const LINKS: { route: Route; href: string; label: string; icon: typeof House }[] = [
  { route: "home", href: "#/", label: "Home", icon: House },
  { route: "plan", href: "#/plan", label: "Plan", icon: ListChecks },
];

export function Sidebar({ route, user, onSignOut }: { route: Route; user: User; onSignOut: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const label = user.name || user.email;

  // measure the active tab so the highlight can slide to it (it lays out as a column on desktop, a row on phones)
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number; animate: boolean } | null>(null);
  useLayoutEffect(() => {
    const measure = (animate: boolean) => {
      const el = navRef.current?.querySelector<HTMLElement>(".nav-item.active");
      if (!el) return setPill(null);
      setPill({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, animate });
    };
    // the first placement doesn't slide in from nowhere; later tab changes do
    setPill((prev) => {
      const el = navRef.current?.querySelector<HTMLElement>(".nav-item.active");
      return el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, animate: prev !== null } : null;
    });
    const onResize = () => measure(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [route]);

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/brand/ascend-icon.png" alt="Ascend" className="brand-logo" />
      </div>

      <nav className={`nav ${pill ? "has-pill" : ""}`} ref={navRef}>
        {/* one highlight that slides to the active tab */}
        {pill && (
          <span
            className={`nav-pill ${pill.animate ? "animate" : ""}`}
            aria-hidden="true"
            style={{ width: pill.w, height: pill.h, transform: `translate(${pill.x}px, ${pill.y}px)` }}
          />
        )}
        {LINKS.map(({ route: r, href, label, icon: Icon }) => (
          <a key={r} className={`nav-item ${route === r ? "active" : ""}`} href={href} aria-current={route === r ? "page" : undefined}>
            <Icon size={18} aria-hidden="true" />
            {label}
          </a>
        ))}
      </nav>

      <div className="sidebar-user">
        <span className="sidebar-avatar" aria-hidden="true">
          {label.charAt(0).toUpperCase()}
        </span>
        <span className="sidebar-who">
          <b>{label}</b>
          {user.name && <small>{user.email}</small>}
        </span>
        <button
          type="button"
          className="sidebar-out"
          disabled={leaving}
          onClick={() => {
            setLeaving(true);
            onSignOut();
          }}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={17} aria-hidden="true" />
        </button>
      </div>

      <p className="sidebar-foot">
        a product by <b>Metamorphix</b>
      </p>
    </aside>
  );
}
