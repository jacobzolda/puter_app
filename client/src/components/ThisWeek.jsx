export default function ThisWeek({ data, loading, error }) {
  return (
    <section className="section" aria-labelledby="week-title">
      <h2 className="section-title" id="week-title">This Week</h2>

      {loading && <p className="state-loading">Loading…</p>}
      {error && <p className="state-warning">Could not load this week: {error}</p>}

      {data && (
        <>
          <p className="week-of">
            Week of: <span>{data.weekOf || '—'}</span>
          </p>

          {data.items.length === 0 ? (
            <p className="state-empty">No items set for this week.</p>
          ) : (
            <ul className="checklist">
              {data.items.map((item, i) => (
                <li key={i} className={`checklist-item${item.checked ? ' is-checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    readOnly
                    aria-label={item.text}
                    tabIndex={-1}
                  />
                  <span className="item-text">{item.text}</span>
                </li>
              ))}
            </ul>
          )}

          {data.parseWarnings.length > 0 && (
            <div className="state-warning">
              Parse notices: {data.parseWarnings.join('; ')}
            </div>
          )}
        </>
      )}
    </section>
  );
}
