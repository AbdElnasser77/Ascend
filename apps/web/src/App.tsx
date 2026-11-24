import { X } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { BeforeDayOne } from "./components/BeforeDayOne";
import { LaunchLoader } from "./components/LaunchLoader";
import { Sidebar } from "./components/Sidebar";
import { Backdrop } from "./components/ui/Backdrop";
import { onSessionChange, restoreSession, signOut, type User } from "./lib/api";
import { todayISO } from "./lib/dates";
import { JourneyProvider, useJourney } from "./lib/journey";
import { useRoute } from "./lib/useRoute";
import { Auth } from "./pages/Auth";
import { Onboarding } from "./pages/Onboarding";

// the dashboard is its own chunk: it loads while setup finishes, not up front
const loadHome = () => import("./pages/Home");
const Home = lazy(() => loadHome().then((m) => ({ default: m.Home })));
const loadPlan = () => import("./pages/Plan");
const Plan = lazy(() => loadPlan().then((m) => ({ default: m.Plan })));

/** Journeys used to live in localStorage. The database is the only copy now; remove the old data from this browser. */
function clearLegacyStorage() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith("ascend.")) localStorage.removeItem(key);
  } catch {
    /* storage blocked: nothing to clear */
  }
}

type AuthState = { status: "checking" } | { status: "out"; notice?: string } | { status: "in"; user: User };

export function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "checking" });

  useEffect(() => {
    clearLegacyStorage();
    let alive = true;
    restoreSession().then((u) => alive && setAuth(u ? { status: "in", user: u } : { status: "out" }));
    const off = onSessionChange((u) => {
      if (!u) setAuth((a) => (a.status === "out" ? a : { status: "out", notice: "Your session has ended. Sign in again." }));
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  const leave = useCallback(async () => {
    await signOut();
    setAuth({ status: "out" });
  }, []);

  if (auth.status === "checking")
    return (
      <>
        <Backdrop />
        <LaunchLoader />
      </>
    );

  if (auth.status === "out")
    return (
      <>
        <Backdrop />
        <Auth notice={auth.notice} onAuthed={(user) => setAuth({ status: "in", user })} />
      </>
    );

  // keyed so switching accounts starts from a clean slate
  return (
    <JourneyProvider
      key={auth.user.id}
      loading={
        <>
          <Backdrop />
          <LaunchLoader />
        </>
      }
    >
      <Journey user={auth.user} onSignOut={leave} />
    </JourneyProvider>
  );
}

function Journey({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { data, error, dismissError } = useJourney();
  // Day 1 is set once, when onboarding finishes. Until then, there is no journey yet.
  const journeyStart = data.profile.journeyStart;
  // true between finishing setup and the dashboard being ready
  const [preparing, setPreparing] = useState(false);
  const [homeReady, setHomeReady] = useState(false);
  const route = useRoute();

  useEffect(() => {
    if (!preparing) return;
    let alive = true;
    loadHome().then(() => alive && setHomeReady(true));
    return () => {
      alive = false;
    };
  }, [preparing]);

  // a failed save shows briefly, then clears
  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(dismissError, 6000);
    return () => window.clearTimeout(id);
  }, [error, dismissError]);

  const finishPreparing = useCallback(() => setPreparing(false), []);

  // fetch both tabs' code once the dashboard is up, so switching tabs never shows a loader
  useEffect(() => {
    if (!journeyStart || preparing) return;
    const id = window.setTimeout(() => {
      loadHome();
      loadPlan();
    }, 600);
    return () => window.clearTimeout(id);
  }, [journeyStart, preparing]);

  if (preparing)
    return (
      <>
        <Backdrop />
        <LaunchLoader setup ready={homeReady} onDone={finishPreparing} />
      </>
    );

  if (!journeyStart)
    return (
      <>
        <Backdrop />
        <Onboarding today={todayISO()} name={user.name} onBegin={() => setPreparing(true)} />
      </>
    );

  return (
    <>
      <Backdrop />
      <div className="app">
        <Sidebar route={route} user={user} onSignOut={onSignOut} />
        <main className="main">
          <Suspense fallback={<LaunchLoader />}>
            {/* keyed by tab, so each switch plays the page's entrance */}
            <div key={route} className="page-enter">
              {route === "plan" ? (
                <Plan start={journeyStart} />
              ) : journeyStart > todayISO() ? (
                <BeforeDayOne start={journeyStart} name={user.name} />
              ) : (
                <Home start={journeyStart} />
              )}
            </div>
          </Suspense>
        </main>
      </div>
      {error && (
        <div className="save-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={dismissError} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
