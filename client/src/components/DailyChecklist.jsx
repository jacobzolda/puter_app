export default function DailyChecklist({ data, loading, error }) {
  return (
    <section className="section" aria-labelledby="today-title">
      <h2 className="section-title" id="today-title">Today — Daily Checklist</h2>

      {loading && <p className="state-loading">Loading…</p>}
      {error && <p className="state-warning">Could not load daily checklist: {error}</p>}

      {data && data.sections.length === 0 && (
        <p className="state-empty">No checklist sections found.</p>
      )}

      {data && data.sections.map((section, i) => (
        <div key={i} className="subsection">
          <h3 className="subsection-title">{section.name}</h3>
          {section.items.length === 0 ? (
            <p className="state-empty">No items.</p>
          ) : (
            <ul className="checklist">
              {section.items.map((item, j) => (
                <li key={j} className={`checklist-item${item.checked ? ' is-checked' : ''}`}>
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
          {section.note && <p className="subsection-note">{section.note}</p>}
        </div>
      ))}

      {data && data.parseWarnings.length > 0 && (
        <div className="state-warning">
          Parse notices: {data.parseWarnings.join('; ')}
        </div>
      )}
    </section>
  );
}
