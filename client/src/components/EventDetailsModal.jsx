import { useMemo } from 'react';
import EventDiscussion from './EventDiscussion.jsx';

function formatDateTime(isoString) {
  try {
    return new Date(isoString).toLocaleString([], {
      dateStyle: 'full',
      timeStyle: 'short'
    });
  } catch (error) {
    console.warn('Failed to format event date', error);
    return isoString;
  }
}

function formatLatLng(location) {
  if (!location) {
    return null;
  }

  const { lat, lng } = location;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return null;
  }

  const roundedLat = lat.toFixed(4);
  const roundedLng = lng.toFixed(4);
  return `${roundedLat}, ${roundedLng}`;
}

export default function EventDetailsModal({
  event,
  onClose,
  currentUserId,
  currentUserName
}) {
  const isTicketmaster = event?.source === 'ticketmaster';
  const formattedDate = useMemo(() => (event ? formatDateTime(event.dateTime) : ''), [event]);
  const formattedLocation = useMemo(() => formatLatLng(event?.location), [event?.location]);

  if (!event) {
    return null;
  }

  const handleOverlayClick = (overlayEvent) => {
    if (overlayEvent.target === overlayEvent.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick} role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={`${event.name} details`}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <header className="modal-header">
          <div className="modal-title">
            <h2>{event.name}</h2>
            <span className={`pill pill-${event.category.toLowerCase()}`}>{event.category}</span>
            {isTicketmaster && <span className="badge badge-ticketmaster">Ticketmaster</span>}
          </div>
          <p className="muted modal-datetime">{formattedDate}</p>
        </header>

        <section className="modal-details">
          {!isTicketmaster && (
            <p className="muted">
              <strong className="modal-detail-label">Attendees:</strong> {event.attendees.length}
            </p>
          )}
          {formattedLocation && (
            <p className="muted">
              <strong className="modal-detail-label">Location:</strong> {formattedLocation}
            </p>
          )}
          {isTicketmaster && event.venueName && (
            <p className="muted">
              <strong className="modal-detail-label">Venue:</strong> {event.venueName}
            </p>
          )}
          {isTicketmaster && event.externalUrl && (
            <a
              href={event.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="modal-link"
            >
              View official listing
            </a>
          )}
        </section>

        <EventDiscussion
          event={event}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
        />
      </div>
    </div>
  );
}
