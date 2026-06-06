import { useCallback, useEffect, useState } from 'react';
import DailyChecklist from './components/DailyChecklist';
import ThisWeek from './components/ThisWeek';
import Goals from './components/Goals';
import './index.css';

const FOCUS_IDS = new Set(['CAR', 'HST', 'FIT']);

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function useApi(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchJson(path)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]);

  return { data, loading, error };
}

export default function App() {
  const daily = useApi('/api/daily');
  const week = useApi('/api/week');
  const goals = useApi('/api/goals');

  const [dailyState, setDailyState] = useState(null);

  useEffect(() => {
    fetchJson('/api/state').then(setDailyState).catch(() => {});
  }, []);

  const updateDailyState = useCallback(async (endpoint, id, value) => {
    const next = await fetchJson(`/api/state/${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, value }),
    });
    setDailyState(next);
    return next;
  }, []);

  // Health check drives the top-level reachability state.
  // null = still checking, true = server up, false = unreachable.
  const [serverUp, setServerUp] = useState(null);
  useEffect(() => {
    fetch('/api/health')
      .then(r => setServerUp(r.ok))
      .catch(() => setServerUp(false));
  }, []);

  let mainContent;
  if (serverUp === false) {
    mainContent = (
      <div className="offline-state" role="status" aria-live="polite">
        <p className="offline-title">Can't reach P.U.T.E.R.</p>
        <p className="offline-message">Is the PC on and connected to the same Wi-Fi?</p>
      </div>
    );
  } else if (serverUp === null) {
    mainContent = <p className="state-loading">Connecting…</p>;
  } else {
    mainContent = (
      <>
        <DailyChecklist {...daily} dailyState={dailyState} onUpdateState={updateDailyState} />
        <ThisWeek {...week} />
        <Goals {...goals} focusIds={FOCUS_IDS} />
      </>
    );
  }

  return (
    <>
      <header className="app-header">
        <h1 className="app-title">P.U.T.E.R.</h1>
        <span className="app-subtitle">Personal Utility To Enhance Relaxation</span>
        <span className="readonly-badge" aria-label="Source files are read-only">source read-only</span>
      </header>

      <main>{mainContent}</main>
    </>
  );
}
