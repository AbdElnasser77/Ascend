import { Sidebar } from "./components/Sidebar";
import { todayISO } from "./lib/dates";
import { useStoredState } from "./lib/useStoredState";
import { Home } from "./pages/Home";
import { Onboarding } from "./pages/Onboarding";

export function App() {
  // Day 1 is set once, when onboarding finishes. Until then, there is no journey yet.
  const [journeyStart, setJourneyStart] = useStoredState<string | null>("ascend.journeyStart", null);

  if (!journeyStart) return <Onboarding today={todayISO()} onBegin={() => setJourneyStart(todayISO())} />;

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Home start={journeyStart} />
      </main>
    </div>
  );
}
