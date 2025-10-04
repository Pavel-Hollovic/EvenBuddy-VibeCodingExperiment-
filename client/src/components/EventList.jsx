function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  } catch {
    return isoString;
  }
}

export default function EventList({ events, onJoin, currentUserId, joiningIds, onSelectEvent }) {
  if (!events.length) {
    return (
      <div className="card event-list">
        <h3>Events</h3>
        <p className="muted">No events match your filters yet. Try widening your search or add a new one.</p>
      </div>
    );
  }

  return (
    <div className="card event-list">
      <h3>Events</h3>
      <ul>
        {events.map((event) => {
          const alreadyJoined = event.attendees.includes(currentUserId);
          const joining = joiningIds.has(event.id);
          return (
            <li key={event.id}>
              <button type="button" className="stack" onClick={() => onSelectEvent(event.id)}>
                <div className="event-header">
                  <strong>{event.name}</strong>
                  <span className={`pill pill-${event.category.toLowerCase()}`}>{event.category}</span>
                </div>
                <span className="muted">{formatDate(event.dateTime)}</span>
                <span className="muted attendees">{event.attendees.length} going</span>
              </button>
              <button
                type="button"
                className="join-button"
                onClick={() => onJoin(event.id)}
                disabled={alreadyJoined || joining}
              >
                {alreadyJoined ? 'You joined' : joining ? 'Joining…' : 'Join event'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
