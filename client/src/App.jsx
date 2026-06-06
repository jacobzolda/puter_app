import { useCallback, useEffect, useRef, useState } from 'react';
import DailyChecklist from './components/DailyChecklist';
import ThisWeek from './components/ThisWeek';
import Goals from './components/Goals';
import './index.css';

const FOCUS_IDS = new Set(['CAR', 'HST', 'FIT']);

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = new Error(`${res.status} ${res.statusText}`);
    err.status = res.status;
    try { Object.assign(err, await res.json()); } catch {}
    throw err;
  }
  return res.json();
}

function useApi(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    setLoading(true);
    fetchJson(path)
      .then(d => { if (!cancelRef.current) { setData(d); setError(null); setLoading(false); } })
      .catch(e => { if (!cancelRef.current) { setError(e.message); setLoading(false); } });
    return () => { cancelRef.current = true; };
  }, [path, version]);

  const refetch = useCallback(() => setVersion(v => v + 1), []);
  const forceData = useCallback(d => setData(d), []);
  return { data, setData: forceData, loading, error, refetch };
}

// Map op name to HTTP method + URL.
const STRUCTURE_OP = {
  add:     { method: 'POST',   url: '/api/structure/add' },
  text:    { method: 'PUT',    url: '/api/structure/text' },
  reorder: { method: 'PUT',    url: '/api/structure/reorder' },
  delete:  { method: 'DELETE', url: '/api/structure/item' },
};

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

  // Phase 3.5: structure edit handler.
  // Sends op + params + current fingerprint; updates daily data on success.
  // Throws on 409 conflict so DailyChecklist can show the conflict banner.
  const onStructureEdit = useCallback(async (op, params) => {
    const fingerprint = daily.data?.fingerprint;
    if (!fingerprint) throw Object.assign(new Error('No fingerprint — reload first'), { reload: true });

    const { method, url } = STRUCTURE_OP[op] ?? (() => { throw new Error(`Unknown op "${op}"`); })();
    const body = { ...params, ...fingerprint };

    let res;
    try {
      res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error('Network error — check connection');
    }

    if (res.status === 409) {
      const err = new Error('PUTER.md changed on disk');
      err.conflict = true;
      throw err;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    daily.setData(data);
    return data;
  }, [daily]);

  const onReload = useCallback(() => {
    daily.refetch();
  }, [daily]);

  // Health check drives the top-level reachability state.
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
        <DailyChecklist
          {...daily}
          dailyState={dailyState}
          onUpdateState={updateDailyState}
          onStructureEdit={onStructureEdit}
          onReload={onReload}
        />
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
