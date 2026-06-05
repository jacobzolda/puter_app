const TIER_ORDER = ['Top Priority', 'Medium Priority', 'Low Priority'];

function groupByTier(goals) {
  const map = {};
  for (const goal of goals) {
    const tier = goal.tier || 'Unknown';
    if (!map[tier]) map[tier] = [];
    map[tier].push(goal);
  }
  // Return in canonical tier order, then any unknown tiers after
  const result = [];
  for (const tier of TIER_ORDER) {
    if (map[tier]) result.push({ tier, goals: map[tier] });
  }
  for (const tier of Object.keys(map)) {
    if (!TIER_ORDER.includes(tier)) result.push({ tier, goals: map[tier] });
  }
  return result;
}

export default function Goals({ data, loading, error, focusIds }) {
  const tiers = data ? groupByTier(data.goals) : [];

  return (
    <section className="section" aria-labelledby="goals-title">
      <h2 className="section-title" id="goals-title">Goals</h2>

      {loading && <p className="state-loading">Loading…</p>}
      {error && <p className="state-warning">Could not load goals: {error}</p>}

      {data && tiers.length === 0 && (
        <p className="state-empty">No goals found.</p>
      )}

      {data && tiers.map(({ tier, goals }) => (
        <div key={tier} className="tier-group">
          <h3 className="tier-label">{tier}</h3>
          {goals.map(goal => {
            const isFocus = focusIds.has(goal.id);
            return (
              <article key={goal.id} className="goal-card">
                <div className="goal-header">
                  <span className={`goal-id${isFocus ? ' is-focus' : ''}`}>{goal.id}</span>
                  <span className="goal-name">{goal.name}</span>
                  {isFocus && <span className="focus-marker">focus</span>}
                </div>
                {goal.body && <p className="goal-body">{goal.body}</p>}
              </article>
            );
          })}
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
