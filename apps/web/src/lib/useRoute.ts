import { useEffect, useState } from "react";

export type Route = "home" | "plan";

const read = (): Route => (window.location.hash.replace(/^#\/?/, "") === "plan" ? "plan" : "home");

/** tiny hash router: #/ is Home, #/plan is the Plan page */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
