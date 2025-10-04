import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_POSITION = [40.7128, -74.006];
const USER_LOCATION_ZOOM = 13;

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng });
    }
  });
  return null;
}

function EventMarker({ event, isSelected, onSelectEvent, onJoin, joining, alreadyJoined }) {
  const popupRef = useRef(null);
  const map = useMap();
  const isTicketmaster = event.source === 'ticketmaster';
  const ticketmasterUrl = event.externalUrl || 'https://www.ticketmaster.com/';

  useEffect(() => {
    if (isSelected && popupRef.current) {
      popupRef.current.openOn(map);
      map.flyTo([event.location.lat, event.location.lng], map.getZoom(), { duration: 0.5 });
    }
  }, [event.location.lat, event.location.lng, isSelected, map]);

  return (
    <Marker
      position={[event.location.lat, event.location.lng]}
      eventHandlers={{ click: () => onSelectEvent(event.id) }}
    >
      <Popup ref={popupRef} className="event-popup">
        <div className="popup-content">
          <h4>{event.name}</h4>
          {isTicketmaster && <span className="badge badge-ticketmaster">Ticketmaster</span>}
          <p>{new Date(event.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
          {isTicketmaster ? (
            <>
              {event.venueName && <p className="muted">Venue: {event.venueName}</p>}
              <a
                href={ticketmasterUrl}
                target="_blank"
                rel="noreferrer"
                className="join-button ticketmaster-link"
              >
                View tickets
              </a>
            </>
          ) : (
            <>
              <p className="muted">{event.attendees.length} attending</p>
              <button
                type="button"
                className="join-button"
                onClick={() => onJoin(event.id)}
                disabled={alreadyJoined || joining}
              >
                {alreadyJoined ? 'You joined' : joining ? 'Joining…' : 'Join event'}
              </button>
            </>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

export default function EventMap({
  events,
  onMapClick,
  newEventLocation,
  selectedEventId,
  onSelectEvent,
  onJoin,
  currentUserId,
  joiningIds
}) {
  const [mapInstance, setMapInstance] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const autoLocateAttemptedRef = useRef(false);
  const locatingRef = useRef(false);

  const locateUser = useCallback(
    ({ silent = false } = {}) => {
      if (!mapInstance || typeof navigator === 'undefined' || !navigator.geolocation) {
        return;
      }

      if (locatingRef.current) {
        return;
      }

      locatingRef.current = true;
      if (!silent) {
        setIsLocating(true);
      }

      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          locatingRef.current = false;
          if (!silent) {
            setIsLocating(false);
          }

          const targetZoom = Math.max(mapInstance.getZoom(), USER_LOCATION_ZOOM);
          mapInstance.flyTo([coords.latitude, coords.longitude], targetZoom, { duration: 0.75 });
        },
        (error) => {
          locatingRef.current = false;
          if (!silent) {
            setIsLocating(false);
          }
          console.warn('Unable to determine user location', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    },
    [mapInstance]
  );

  useEffect(() => {
    if (!mapInstance || autoLocateAttemptedRef.current) {
      return;
    }

    autoLocateAttemptedRef.current = true;
    locateUser({ silent: true });
  }, [locateUser, mapInstance]);

  return (
    <div className="map-wrapper">
      <MapContainer
        center={DEFAULT_POSITION}
        zoom={12}
        scrollWheelZoom
        className="map"
        whenCreated={setMapInstance}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onMapClick={onMapClick} />
        {events.map((event) => (
          <EventMarker
            key={event.id}
            event={event}
            isSelected={event.id === selectedEventId}
            onSelectEvent={onSelectEvent}
            onJoin={onJoin}
            joining={joiningIds.has(event.id)}
            alreadyJoined={event.attendees.includes(currentUserId)}
          />
        ))}
        {newEventLocation && (
          <Marker position={[newEventLocation.lat, newEventLocation.lng]}>
            <Popup>New event location</Popup>
          </Marker>
        )}
      </MapContainer>
      <button
        type="button"
        className="locate-button"
        onClick={() => locateUser()}
        disabled={isLocating}
        aria-label="Locate nearby events"
      >
        {isLocating ? 'Locating…' : 'Locate'}
      </button>
    </div>
  );
}
