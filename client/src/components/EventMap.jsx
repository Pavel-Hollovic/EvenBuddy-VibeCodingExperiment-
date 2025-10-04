import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { divIcon, Icon } from 'leaflet';

const DEFAULT_POSITION = [40.7128, -74.006];
const USER_LOCATION_ZOOM = 13;
const MARKER_ICON_BASE = {
  iconSize: [30, 41],
  iconAnchor: [15, 40],
  popupAnchor: [0, -36]
};

const CATEGORY_GLYPHS = {
  sport: '🏅',
  sports: '🏅',
  culture: '🎭',
  party: '🎉',
  music: '🎵',
  concert: '🎵',
  food: '🍽️',
  dining: '🍽️',
  fitness: '💪',
  health: '💪',
  art: '🎨',
  arts: '🎨',
  networking: '🤝',
  community: '🤝',
  education: '📚',
  learning: '📚'
};

const markerIconCache = new Map();
const userEventMarkerIconCache = new Map();

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeCategory(category) {
  if (!category) {
    return '';
  }
  return String(category).trim().toLowerCase();
}

function getCategoryGlyph(category) {
  const key = normalizeCategory(category);
  if (!key) {
    return '★';
  }
  if (CATEGORY_GLYPHS[key]) {
    return CATEGORY_GLYPHS[key];
  }
  const wordCandidates = key
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
  for (const word of wordCandidates) {
    if (CATEGORY_GLYPHS[word]) {
      return CATEGORY_GLYPHS[word];
    }
  }
  for (const candidate of Object.keys(CATEGORY_GLYPHS)) {
    if (key.includes(candidate)) {
      return CATEGORY_GLYPHS[candidate];
    }
  }
  return key[0] ? key[0].toUpperCase() : '★';
}

function createMarkerIcon({ glyph, variant }) {
  const cacheKey = `${variant}::${glyph}`;
  if (markerIconCache.has(cacheKey)) {
    return markerIconCache.get(cacheKey);
  }

  const icon = divIcon({
    className: `custom-marker custom-marker--${variant}`,
    html: `<span class="custom-marker__pin"><span class="custom-marker__glyph">${escapeHtml(glyph)}</span></span>`,
    ...MARKER_ICON_BASE
  });

  markerIconCache.set(cacheKey, icon);
  return icon;
}

function getUserEventMarkerIcon(category) {
  const glyph = getCategoryGlyph(category);
  if (!userEventMarkerIconCache.has(glyph)) {
    userEventMarkerIconCache.set(glyph, createMarkerIcon({ glyph, variant: 'user' }));
  }
  return userEventMarkerIconCache.get(glyph);
}

const draftEventMarkerIcon = createMarkerIcon({ glyph: '+', variant: 'draft' });
const ticketmasterMarkerIcon = new Icon.Default();

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
  const attendees = Array.isArray(event.attendees) ? event.attendees : [];
  const markerIcon = isTicketmaster ? ticketmasterMarkerIcon : getUserEventMarkerIcon(event.category);

  useEffect(() => {
    if (isSelected && popupRef.current) {
      popupRef.current.openOn(map);
      map.flyTo([event.location.lat, event.location.lng], map.getZoom(), { duration: 0.5 });
    }
  }, [event.location.lat, event.location.lng, isSelected, map]);

  return (
    <Marker
      position={[event.location.lat, event.location.lng]}
      icon={markerIcon}
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
              <p className="muted">{attendees.length} attending</p>
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
    if (!mapInstance || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    const permissions = navigator.permissions;
    if (!permissions?.query) {
      return;
    }

    let cancelled = false;

    permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled || status.state !== 'granted') {
          return;
        }
        locateUser({ silent: true });
      })
      .catch(() => {
        // ignore permission check failures, user can still use the manual button
      });

    return () => {
      cancelled = true;
    };
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
        {events.map((event) => {
          const attendees = Array.isArray(event.attendees) ? event.attendees : [];
          return (
            <EventMarker
              key={event.id}
              event={event}
              isSelected={event.id === selectedEventId}
              onSelectEvent={onSelectEvent}
              onJoin={onJoin}
              joining={joiningIds.has(event.id)}
              alreadyJoined={currentUserId ? attendees.includes(currentUserId) : false}
            />
          );
        })}
        {newEventLocation && (
          <Marker
            position={[newEventLocation.lat, newEventLocation.lng]}
            icon={draftEventMarkerIcon}
          >
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
