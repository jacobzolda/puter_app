import { useEffect, useRef, useState } from 'react';

export default function DailyChecklist({
  data, loading, error,
  dailyState, onUpdateState,
  onStructureEdit, onReload,
}) {
  const [manageMode, setManageMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Local optimistic copy of checked/hidden for Phase 3 interactions.
  const [localState, setLocalState] = useState(null);
  const [notices, setNotices] = useState({});

  // Edit mode: per-item text drafts and per-section add-row drafts.
  const [drafts, setDrafts] = useState({});
  const [addDrafts, setAddDrafts] = useState({});

  // Track "last confirmed saved text" to prevent double-saves from blur+Enter.
  const savedTextsRef = useRef({});

  useEffect(() => {
    if (dailyState) setLocalState(dailyState);
  }, [dailyState]);

  // When data changes (e.g. after a structural edit), initialize drafts for any
  // new items that appeared while edit mode is already open.
  useEffect(() => {
    if (editMode && data) {
      setDrafts(prev => {
        const next = { ...prev };
        data.sections.forEach(s =>
          s.items.forEach(item => {
            if (item.id && !(item.id in next)) {
              next[item.id] = item.text;
              savedTextsRef.current[item.id] = item.text;
            }
          })
        );
        return next;
      });
    }
  }, [data, editMode]);

  const checked = localState?.checked ?? [];
  const hidden = localState?.hidden ?? [];

  // Helper: find an item object by id across all sections.
  function findItem(id) {
    if (!data) return null;
    for (const s of data.sections) {
      const item = s.items.find(i => i.id === id);
      if (item) return item;
    }
    return null;
  }

  // --- Phase 3: check / hide ---

  async function handleCheck(id, isChecked) {
    const nextValue = !isChecked;
    setLocalState(s => ({
      ...s,
      checked: nextValue ? [...s.checked, id] : s.checked.filter(x => x !== id),
    }));
    setNotices(n => ({ ...n, [id]: null }));
    try {
      await onUpdateState('check', id, nextValue);
    } catch {
      setLocalState(dailyState);
      setNotices(n => ({ ...n, [id]: 'Save failed — try again' }));
    }
  }

  async function handleHide(id, isHidden) {
    const nextValue = !isHidden;
    setLocalState(s => ({
      ...s,
      hidden: nextValue ? [...s.hidden, id] : s.hidden.filter(x => x !== id),
    }));
    setNotices(n => ({ ...n, [id]: null }));
    try {
      await onUpdateState('hide', id, nextValue);
    } catch {
      setLocalState(dailyState);
      setNotices(n => ({ ...n, [id]: 'Save failed — try again' }));
    }
  }

  // --- Phase 3.5: structural edits ---

  function enterEditMode() {
    const d = {};
    savedTextsRef.current = {};
    if (data) {
      data.sections.forEach(s =>
        s.items.forEach(item => {
          if (item.id) {
            d[item.id] = item.text;
            savedTextsRef.current[item.id] = item.text;
          }
        })
      );
    }
    setDrafts(d);
    setAddDrafts({});
    setConflict(false);
    setEditMode(true);
    setManageMode(false);
  }

  function exitEditMode() {
    setEditMode(false);
    setDrafts({});
    setAddDrafts({});
    setConflict(false);
  }

  function handleReloadAfterConflict() {
    setConflict(false);
    setEditMode(false);
    setDrafts({});
    setAddDrafts({});
    onReload();
  }

  async function handleTextSave(id) {
    if (isSaving) return;
    const draft = drafts[id];
    const lastSaved = savedTextsRef.current[id] ?? findItem(id)?.text;
    if (!draft || !lastSaved || draft.trim() === '' || draft.trim() === lastSaved) return;

    const trimmed = draft.trim();
    setIsSaving(true);
    try {
      await onStructureEdit('text', { id, text: trimmed });
      savedTextsRef.current[id] = trimmed;
      setDrafts(d => ({ ...d, [id]: trimmed }));
    } catch (e) {
      if (e.conflict) {
        setConflict(true);
      } else {
        // Revert draft to last confirmed saved text
        setDrafts(d => ({ ...d, [id]: lastSaved }));
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReorder(id, direction) {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onStructureEdit('reorder', { id, direction });
    } catch (e) {
      if (e.conflict) setConflict(true);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id, text) {
    if (isSaving) return;
    if (!window.confirm(`Delete "${text}"?`)) return;
    setIsSaving(true);
    try {
      await onStructureEdit('delete', { id });
      setDrafts(d => { const n = { ...d }; delete n[id]; return n; });
      delete savedTextsRef.current[id];
    } catch (e) {
      if (e.conflict) setConflict(true);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAdd(sectionName) {
    if (isSaving) return;
    const text = (addDrafts[sectionName] ?? '').trim();
    if (!text) return;
    setIsSaving(true);
    try {
      const result = await onStructureEdit('add', { section: sectionName, text });
      setAddDrafts(d => ({ ...d, [sectionName]: '' }));
      if (result?.newId) {
        setDrafts(d => ({ ...d, [result.newId]: text }));
        savedTextsRef.current[result.newId] = text;
      }
    } catch (e) {
      if (e.conflict) setConflict(true);
    } finally {
      setIsSaving(false);
    }
  }

  // --- Render ---

  return (
    <section className="section" aria-labelledby="today-title">
      <div className="section-header">
        <h2 className="section-title" id="today-title">
          Today — Daily Checklist
          {isSaving && <span className="saving-text"> saving…</span>}
        </h2>
        {data && (
          <div className="header-buttons">
            <button
              className={`manage-btn${editMode ? ' is-active' : ''}`}
              onClick={editMode ? exitEditMode : enterEditMode}
              disabled={manageMode || isSaving}
              aria-pressed={editMode}
              type="button"
            >
              {editMode ? 'Done' : 'Edit list'}
            </button>
            <button
              className={`manage-btn${manageMode ? ' is-active' : ''}`}
              onClick={() => setManageMode(m => !m)}
              disabled={editMode}
              aria-pressed={manageMode}
              type="button"
            >
              {manageMode ? 'Done' : 'Manage'}
            </button>
          </div>
        )}
      </div>

      {conflict && (
        <div className="conflict-banner" role="alert">
          <span>PUTER.md changed on disk — reload to continue editing</span>
          <button type="button" className="conflict-reload-btn" onClick={handleReloadAfterConflict}>
            Reload
          </button>
        </div>
      )}

      {loading && <p className="state-loading">Loading…</p>}
      {error && <p className="state-warning">Could not load daily checklist: {error}</p>}

      {data && data.sections.length === 0 && (
        <p className="state-empty">No checklist sections found.</p>
      )}

      {data && data.sections.map((section, i) => {
        const visibleItems = (manageMode || editMode)
          ? section.items
          : section.items.filter(item => !item.id || !hidden.includes(item.id));

        if (!manageMode && !editMode && visibleItems.length === 0) return null;

        return (
          <div key={i} className="subsection">
            <h3 className="subsection-title">{section.name}</h3>

            {visibleItems.length === 0 && !editMode ? (
              <p className="state-empty">No items.</p>
            ) : (
              <ul className="checklist">
                {visibleItems.map((item, j) => {
                  const noId = item.id === null;
                  const isChecked = !noId && checked.includes(item.id);
                  const isHidden = !noId && hidden.includes(item.id);
                  const notice = !noId ? notices[item.id] : null;

                  if (editMode && !noId) {
                    const draft = drafts[item.id] ?? item.text;
                    const isDirty = draft !== (savedTextsRef.current[item.id] ?? item.text);
                    const isFirst = j === 0;
                    const isLast = j === section.items.length - 1;

                    return (
                      <li key={j} className="checklist-item is-edit">
                        <button
                          className="arrow-btn"
                          type="button"
                          disabled={isFirst || isSaving}
                          onClick={() => handleReorder(item.id, 'up')}
                          aria-label={`Move "${item.text}" up`}
                        >↑</button>
                        <button
                          className="arrow-btn"
                          type="button"
                          disabled={isLast || isSaving}
                          onClick={() => handleReorder(item.id, 'down')}
                          aria-label={`Move "${item.text}" down`}
                        >↓</button>
                        <input
                          className={`item-edit-input${isDirty ? ' is-dirty' : ''}`}
                          type="text"
                          value={draft}
                          onChange={e => setDrafts(d => ({ ...d, [item.id]: e.target.value }))}
                          onBlur={() => handleTextSave(item.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleTextSave(item.id);
                            }
                          }}
                          disabled={isSaving}
                          aria-label={`Edit text for "${item.text}"`}
                        />
                        <button
                          className="delete-btn"
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleDelete(item.id, item.text)}
                          aria-label={`Delete "${item.text}"`}
                        >Delete</button>
                      </li>
                    );
                  }

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

            {editMode && (
              <div className="add-item-row">
                <input
                  className="add-item-input"
                  type="text"
                  placeholder="New item…"
                  value={addDrafts[section.name] ?? ''}
                  onChange={e => setAddDrafts(d => ({ ...d, [section.name]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(section.name); } }}
                  disabled={isSaving}
                  aria-label={`Add item to ${section.name}`}
                />
                <button
                  className="add-btn"
                  type="button"
                  disabled={isSaving || !(addDrafts[section.name] ?? '').trim()}
                  onClick={() => handleAdd(section.name)}
                  aria-label={`Add item to ${section.name}`}
                >+</button>
              </div>
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
