import { v4 as uuid } from 'uuid';
import dayjs from 'dayjs';

const profiles = new Map();
const emailIndex = new Map();
const events = new Map();

function cloneEvent(event) {
  return {
    ...event,
    location: { ...event.location },
    attendees: [...event.attendees]
  };
}

function cloneProfile(profile) {
  return { ...profile };
}

export function upsertProfile({ name, email }) {
  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const existingId = emailIndex.get(normalizedEmail);

  if (existingId) {
    const currentProfile = profiles.get(existingId);
    if (currentProfile) {
      const updated = { ...currentProfile, name: trimmedName };
      profiles.set(existingId, updated);
      return cloneProfile(updated);
    }
  }

  const profile = { id: uuid(), name: trimmedName, email: normalizedEmail };
  profiles.set(profile.id, profile);
  emailIndex.set(normalizedEmail, profile.id);
  return cloneProfile(profile);
}

export function getProfile(id) {
  const profile = profiles.get(id);
  return profile ? cloneProfile(profile) : null;
}

export function getProfileByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const profileId = emailIndex.get(normalizedEmail);
  if (!profileId) {
    return null;
  }
  return getProfile(profileId);
}

export function createEvent({ name, category, dateTime, location, creatorUserId }) {
  const event = {
    id: uuid(),
    name,
    category,
    dateTime,
    location: { ...location },
    creatorUserId,
    attendees: [creatorUserId]
  };
  events.set(event.id, event);
  return cloneEvent(event);
}

export function getEvent(id) {
  const event = events.get(id);
  return event ? cloneEvent(event) : null;
}

export function listEvents({ categories = null, startTime = null, endTime = null } = {}) {
  const filtered = Array.from(events.values()).filter((event) => {
    if (categories && categories.size && !categories.has(event.category)) {
      return false;
    }

    const eventTime = dayjs(event.dateTime);
    if (!eventTime.isValid()) {
      return false;
    }

    if (startTime && startTime.isValid() && eventTime.isBefore(startTime)) {
      return false;
    }

    if (endTime && endTime.isValid() && eventTime.isAfter(endTime)) {
      return false;
    }

    return true;
  });

  return filtered
    .sort((a, b) => dayjs(a.dateTime).valueOf() - dayjs(b.dateTime).valueOf())
    .map(cloneEvent);
}

export function joinEvent({ eventId, userId }) {
  const event = events.get(eventId);
  if (!event) {
    return { error: 'event_not_found' };
  }
  if (!profiles.has(userId)) {
    return { error: 'profile_not_found' };
  }
  if (!event.attendees.includes(userId)) {
    event.attendees.push(userId);
  }
  return { event: cloneEvent(event) };
}
