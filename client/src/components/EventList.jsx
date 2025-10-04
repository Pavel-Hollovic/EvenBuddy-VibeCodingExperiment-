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

export default function EventList({
  events,
  onJoin,
  currentUserId,
  joiningIds,
  onSelectEvent,
  onShowDetails
}) {
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
          const isTicketmaster = event.source === 'ticketmaster';
          const attendees = Array.isArray(event.attendees) ? event.attendees : [];
          const alreadyJoined = currentUserId ? attendees.includes(currentUserId) : false;
          const joining = joiningIds.has(event.id);
          const ticketmasterUrl = event.externalUrl || 'https://www.ticketmaster.com/';
          const categoryLabel = typeof event.category === 'string' && event.category.trim() ? event.category : 'Other';
          const categoryClass = `pill pill-${categoryLabel
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')}`;
          return (
            <li key={event.id} className={isTicketmaster ? 'ticketmaster-event' : ''}>
              <button type="button" className="stack" onClick={() => onSelectEvent(event.id)}>
                <div className="event-header">
                  <strong>{event.name}</strong>
                  <span className="event-badges">
                    {isTicketmaster && <span className="badge badge-ticketmaster">Ticketmaster</span>}
                    <span className={categoryClass}>{categoryLabel}</span>
                  </span>
                </div>
                <span className="muted">{formatDate(event.dateTime)}</span>
                {isTicketmaster ? (
                  <span className="muted venue">{event.venueName ? `Venue: ${event.venueName}` : 'Official listing'}</span>
                ) : (
                  <span className="muted attendees">{attendees.length} going</span>
                )}
              </button>
              <div className="event-actions">
                {isTicketmaster ? (
                  <a
                    href={ticketmasterUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="join-button ticketmaster-link"
                  >
                    View tickets
                  </a>
                ) : (
                  <button
                    type="button"
                    className="join-button"
                    onClick={() => onJoin(event.id)}
                    disabled={alreadyJoined || joining}
                  >
                    {alreadyJoined ? 'You joined' : joining ? 'Joining…' : 'Join event'}
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onShowDetails?.(event.id)}
                >
                  More
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
