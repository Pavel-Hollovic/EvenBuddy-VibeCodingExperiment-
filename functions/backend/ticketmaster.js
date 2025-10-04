import dayjs from 'dayjs';
import { upsertTicketmasterEvents } from './store.js';

const API_KEY = process.env.TICKETMASTER_API_KEY || 'dejl1yvYcanCLRs3MJwi1PPcxSd8t2PA';
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';
const DEFAULT_COORDINATES = { lat: 40.7128, lng: -74.006 };
const DEFAULT_RADIUS_MILES = Number(process.env.TICKETMASTER_RADIUS_MILES || 50);
const DEFAULT_SIZE = Number(process.env.TICKETMASTER_EVENT_LIMIT || 100);

const CATEGORY_MAP = new Map([
  ['sports', 'Sport'],
  ['music', 'Culture'],
  ['arts & theatre', 'Culture'],
  ['arts', 'Culture'],
  ['film', 'Culture'],
  ['family', 'Culture'],
  ['community/other', 'Party'],
  ['miscellaneous', 'Party']
]);

function mapCategory(classifications = []) {
  for (const classification of classifications) {
    const segmentName = classification?.segment?.name;
    if (!segmentName) continue;
    const mapped = CATEGORY_MAP.get(segmentName.toLowerCase());
    if (mapped) {
      return mapped;
    }
  }
  return 'Party';
}

function toIsoDate(start = {}) {
  if (start.dateTime) {
    const instant = dayjs(start.dateTime);
    return instant.isValid() ? instant.toISOString() : null;
  }
  if (start.localDate) {
    const combined = `${start.localDate}${start.localTime ? `T${start.localTime}` : 'T00:00:00'}`;
    const instant = dayjs(combined);
    return instant.isValid() ? instant.toISOString() : null;
  }
  return null;
}

function extractLocation(embedded = {}) {
  const venue = embedded.venues?.[0];
  if (!venue) return null;
  const location = venue.location;
  if (!location || location.latitude === undefined || location.longitude === undefined) {
    return null;
  }
  const lat = Number(location.latitude);
  const lng = Number(location.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }
  return {
    lat,
    lng,
    venueName: venue.name || null
  };
}

function normalizeEvent(raw) {
  if (!raw?.id) {
    return null;
  }
  const startDate = toIsoDate(raw?.dates?.start);
  if (!startDate) {
    return null;
  }

  const location = extractLocation(raw?._embedded);
  if (!location) {
    return null;
  }

  return {
    externalId: raw.id,
    name: raw.name,
    category: mapCategory(raw.classifications || []),
    dateTime: startDate,
    location: { lat: location.lat, lng: location.lng },
    externalUrl: raw.url || null,
    venueName: location.venueName
  };
}

export async function fetchTicketmasterEvents({ lat = DEFAULT_COORDINATES.lat, lng = DEFAULT_COORDINATES.lng, radius = DEFAULT_RADIUS_MILES, size = DEFAULT_SIZE } = {}) {
  if (!API_KEY) {
    throw new Error('Ticketmaster API key is not configured. Set TICKETMASTER_API_KEY.');
  }

  const url = new URL(BASE_URL);
  url.searchParams.set('apikey', API_KEY);
  url.searchParams.set('latlong', `${lat},${lng}`);
  url.searchParams.set('radius', radius);
  url.searchParams.set('unit', 'miles');
  url.searchParams.set('sort', 'date,asc');
  url.searchParams.set('size', Math.min(size, 200));
  url.searchParams.set('locale', '*');
  url.searchParams.set('startDateTime', dayjs().subtract(1, 'hour').toISOString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error(`Ticketmaster API request failed with status ${response.status}`);
    error.details = errorBody;
    throw error;
  }

  const payload = await response.json();
  const events = payload?._embedded?.events || [];
  return events.map(normalizeEvent).filter(Boolean);
}

let currentSync = null;

export async function syncTicketmasterEvents(options = {}) {
  if (currentSync) {
    return currentSync;
  }

  currentSync = (async () => {
    try {
      const events = await fetchTicketmasterEvents(options);
      if (!events.length) {
        console.info('Ticketmaster sync: no events returned');
        await upsertTicketmasterEvents([]);
        return { fetched: 0 };
      }
      const result = await upsertTicketmasterEvents(events);
      console.info('Ticketmaster sync completed', { fetched: events.length, ...result });
      return { fetched: events.length, ...result };
    } catch (error) {
      console.error('Ticketmaster sync failed', {
        message: error?.message,
        stack: error?.stack,
        status: error?.status,
        details: error?.details
      });
      throw error;
    } finally {
      currentSync = null;
    }
  })();

  return currentSync;
}
