import { useEffect, useState } from 'react';
import DailyChecklist from './components/DailyChecklist';
import ThisWeek from './components/ThisWeek';
import Goals from './components/Goals';
import './index.css';

const FOCUS_IDS = new Set(['CAR', 'HST', 'FIT']);

async function fetchJson(url) {
  const res = await fetch(url);
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

  return (
    <>
      <header className="app-header">
        <h1 className="app-title">P.U.T.E.R.</h1>
        <span className="app-subtitle">Personal Utility To Enhance Relaxation</span>
        <span className="readonly-badge" aria-label="Read-only view">read-only</span>
      </header>

      <main>
        <DailyChecklist {...daily} />
        <ThisWeek {...week} />
        <Goals {...goals} focusIds={FOCUS_IDS} />
      </main>
    </>
  );
}
