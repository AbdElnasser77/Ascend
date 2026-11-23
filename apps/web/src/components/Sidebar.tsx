import { House, ListChecks } from "lucide-react";
import type { Route } from "../lib/useRoute";

const LINKS: { route: Route; href: string; label: string; icon: typeof House }[] = [
  { route: "home", href: "#/", label: "Home", icon: House },
  { route: "plan", href: "#/plan", label: "Plan", icon: ListChecks },
];

export function Sidebar({ route }: { route: Route }) {
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
        {LINKS.map(({ route: r, href, label, icon: Icon }) => (
          <a key={r} className={`nav-item ${route === r ? "active" : ""}`} href={href} aria-current={route === r ? "page" : undefined}>
            <Icon size={18} aria-hidden="true" />
            {label}
          </a>
        ))}
      </nav>

      <p className="sidebar-foot">
        a product by <b>Metamorphix</b>
      </p>
    </aside>
  );
}
