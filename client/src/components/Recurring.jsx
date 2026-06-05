export default function Recurring({ data, loading, error }) {
  return (
    <section className="section" aria-labelledby="recurring-title">
      <h2 className="section-title" id="recurring-title">Recurring</h2>

      {loading && <p className="state-loading">Loading…</p>}
      {error && <p className="state-warning">Could not load recurring items: {error}</p>}

      {data && data.items.length === 0 && (
        <p className="state-empty">No recurring items found.</p>
      )}

      {data && data.items.length > 0 && (
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

      {data && data.parseWarnings.length > 0 && (
        <div className="state-warning">
          Parse notices: {data.parseWarnings.join('; ')}
        </div>
      )}
    </section>
  );
}
