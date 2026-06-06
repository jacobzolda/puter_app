import { useEffect, useState } from 'react';

export default function DailyChecklist({ data, loading, error, dailyState, onUpdateState }) {
  const [manageMode, setManageMode] = useState(false);
  // Local optimistic copy of checked/hidden; synced from prop, overridden on tap.
  const [localState, setLocalState] = useState(null);
  const [notices, setNotices] = useState({});

  // Keep localState in sync whenever the server state arrives or updates.
  useEffect(() => {
    if (dailyState) setLocalState(dailyState);
  }, [dailyState]);

  const checked = localState?.checked ?? [];
  const hidden = localState?.hidden ?? [];

  async function handleCheck(id, isChecked) {
    const nextValue = !isChecked;
    // Optimistic
    setLocalState(s => ({
      ...s,
      checked: nextValue ? [...(s.checked), id] : s.checked.filter(x => x !== id),
    }));
    setNotices(n => ({ ...n, [id]: null }));
    try {
      await onUpdateState('check', id, nextValue);
    } catch {
      // Revert to last confirmed server state
      setLocalState(dailyState);
      setNotices(n => ({ ...n, [id]: 'Save failed — try again' }));
    }
  }

  async function handleHide(id, isHidden) {
    const nextValue = !isHidden;
    setLocalState(s => ({
      ...s,
      hidden: nextValue ? [...(s.hidden), id] : s.hidden.filter(x => x !== id),
    }));
    setNotices(n => ({ ...n, [id]: null }));
    try {
      await onUpdateState('hide', id, nextValue);
    } catch {
      setLocalState(dailyState);
      setNotices(n => ({ ...n, [id]: 'Save failed — try again' }));
    }
  }

  return (
    <section className="section" aria-labelledby="today-title">
      <div className="section-header">
        <h2 className="section-title" id="today-title">Today — Daily Checklist</h2>
        {data && (
          <button
            className={`manage-btn${manageMode ? ' is-active' : ''}`}
            onClick={() => setManageMode(m => !m)}
            aria-pressed={manageMode}
            type="button"
          >
            {manageMode ? 'Done' : 'Manage'}
          </button>
        )}
      </div>

      {loading && <p className="state-loading">Loading…</p>}
      {error && <p className="state-warning">Could not load daily checklist: {error}</p>}

      {data && data.sections.length === 0 && (
        <p className="state-empty">No checklist sections found.</p>
      )}

      {data && data.sections.map((section, i) => {
        const visibleItems = manageMode
          ? section.items
          : section.items.filter(item => !item.id || !hidden.includes(item.id));

        if (!manageMode && visibleItems.length === 0) return null;

        return (
          <div key={i} className="subsection">
            <h3 className="subsection-title">{section.name}</h3>
            {visibleItems.length === 0 ? (
              <p className="state-empty">No items.</p>
            ) : (
              <ul className="checklist">
                {visibleItems.map((item, j) => {
                  const noId = item.id === null;
                  const isChecked = !noId && checked.includes(item.id);
                  const isHidden = !noId && hidden.includes(item.id);
                  const notice = !noId ? notices[item.id] : null;

                  return (
                    <li
                      key={j}
                      className={[
                        'checklist-item',
                        isChecked ? 'is-checked' : '',
                        manageMode && isHidden ? 'is-hidden-item' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={noId || !localState}
                        aria-label={item.text}
                        onChange={noId ? undefined : () => handleCheck(item.id, isChecked)}
                      />
                      <span className="item-text">{item.text}</span>
                      {notice && <span className="item-notice">{notice}</span>}
                      {manageMode && !noId && (
                        <button
                          className={`hide-btn${isHidden ? ' is-unhide' : ''}`}
                          type="button"
                          onClick={() => handleHide(item.id, isHidden)}
                          aria-label={isHidden ? `Unhide ${item.text}` : `Hide ${item.text} for today`}
                        >
                          {isHidden ? 'Unhide' : 'Hide'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {section.note && <p className="subsection-note">{section.note}</p>}
          </div>
        );
      })}

      {data && data.parseWarnings.length > 0 && (
        <div className="state-warning">
          Parse notices: {data.parseWarnings.join('; ')}
        </div>
      )}
    </section>
  );
}
