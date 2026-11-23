import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { LaunchLoader } from "./components/LaunchLoader";
import { Sidebar } from "./components/Sidebar";
import { Backdrop } from "./components/ui/Backdrop";
import { todayISO } from "./lib/dates";
import { useRoute } from "./lib/useRoute";
import { useStoredState } from "./lib/useStoredState";
import { Onboarding } from "./pages/Onboarding";

// the dashboard is its own chunk: it loads while setup finishes, not up front
const loadHome = () => import("./pages/Home");
const Home = lazy(() => loadHome().then((m) => ({ default: m.Home })));
const Plan = lazy(() => import("./pages/Plan").then((m) => ({ default: m.Plan })));

export function App() {
  // Day 1 is set once, when onboarding finishes. Until then, there is no journey yet.
  const [journeyStart, setJourneyStart] = useStoredState<string | null>("ascend.journeyStart", null);
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

  const finishPreparing = useCallback(() => setPreparing(false), []);

  if (!journeyStart)
    return (
      <>
        <Backdrop />
        <Onboarding
          today={todayISO()}
          onBegin={() => {
            setPreparing(true);
            setJourneyStart(todayISO());
          }}
        />
      </>
    );

  if (preparing)
    return (
      <>
        <Backdrop />
        <LaunchLoader setup ready={homeReady} onDone={finishPreparing} />
      </>
    );

  return (
    <>
      <Backdrop />
      <div className="app">
        <Sidebar route={route} />
        <main className="main">
          <Suspense fallback={<LaunchLoader />}>
            {route === "plan" ? <Plan start={journeyStart} /> : <Home start={journeyStart} />}
          </Suspense>
        </main>
      </div>
    </>
  );
}
