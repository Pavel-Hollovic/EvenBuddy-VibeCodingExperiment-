import { v4 as uuid } from 'uuid';
import dayjs from 'dayjs';
import bcrypt from 'bcryptjs';
import { admin, db } from './firebaseAdmin.js';

const PASSWORD_SALT_ROUNDS = Number(process.env.PASSWORD_SALT_ROUNDS || 12);
const profilesCollection = db.collection('profiles');
const eventsCollection = db.collection('Events');

function sanitizeProfile(doc) {
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    email: data.email
  };
}

function toEvent(doc) {
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    category: data.category,
    dateTime: data.dateTime,
    location: data.location,
    creatorUserId: data.creatorUserId || null,
    attendees: Array.isArray(data.attendees) ? data.attendees : [],
    source: data.source || 'user',
    externalId: data.externalId || null,
    externalUrl: data.externalUrl || null,
    venueName: data.venueName || null
  };
}

async function findProfileDocByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const snapshot = await profilesCollection.where('email', '==', normalizedEmail).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0];
}

export async function registerProfile({ name, email, password }) {
  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

  const existingDoc = await findProfileDocByEmail(normalizedEmail);
  if (existingDoc) {
    const error = new Error('email_already_registered');
    error.code = 'email_exists';
    throw error;
  }

  const id = uuid();
  const docRef = profilesCollection.doc(id);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await docRef.set({
    name: trimmedName,
    email: normalizedEmail,
    passwordHash,
    createdAt: now,
    updatedAt: now
  });

  const created = await docRef.get();
  return sanitizeProfile(created);
}

export async function authenticateProfile({ email, password }) {
  const doc = await findProfileDocByEmail(email);
  if (!doc) {
    const error = new Error('invalid_credentials');
    error.code = 'invalid_credentials';
    throw error;
  }

  const data = doc.data();
  const storedHash = data.passwordHash || '';
  const match = await bcrypt.compare(password, storedHash);
  if (!match) {
    const error = new Error('invalid_credentials');
    error.code = 'invalid_credentials';
    throw error;
  }

  return sanitizeProfile(doc);
}

export async function ensureProfile({ name, email, password }) {
  const existingDoc = await findProfileDocByEmail(email);
  if (existingDoc) {
    return sanitizeProfile(existingDoc);
  }
  return registerProfile({ name, email, password });
}

export async function updateProfileName({ profileId, name }) {
  const trimmedName = name.trim();
  const docRef = profilesCollection.doc(profileId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return null;
  }
  await docRef.update({
    name: trimmedName,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  const updated = await docRef.get();
  return sanitizeProfile(updated);
}

export async function getProfile(id) {
  const snapshot = await profilesCollection.doc(id).get();
  return sanitizeProfile(snapshot);
}

export async function getProfileByEmail(email) {
  const doc = await findProfileDocByEmail(email);
  if (!doc) {
    return null;
  }
  return sanitizeProfile(doc);
}

export async function createEvent({ name, category, dateTime, location, creatorUserId }) {
  const eventId = uuid();
  const eventRef = eventsCollection.doc(eventId);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const eventPayload = {
    name,
    category,
    dateTime,
    location: { ...location },
    creatorUserId,
    attendees: [creatorUserId],
    source: 'user',
    createdAt: now,
    updatedAt: now
  };
  await eventRef.set(eventPayload);
  const created = await eventRef.get();
  return toEvent(created);
}

export async function getEvent(id) {
  const snapshot = await eventsCollection.doc(id).get();
  return toEvent(snapshot);
}

export async function listEvents({ categories = null, startTime = null, endTime = null } = {}) {
  const snapshot = await eventsCollection.get();
  const events = snapshot.docs
    .map(toEvent)
    .filter(Boolean)
    .filter((event) => {
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
    })
    .sort((a, b) => dayjs(a.dateTime).valueOf() - dayjs(b.dateTime).valueOf());

  return events;
}

export async function joinEvent({ eventId, userId }) {
  const eventRef = eventsCollection.doc(eventId);
  const profileRef = profilesCollection.doc(userId);

  return db.runTransaction(async (transaction) => {
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists) {
      return { error: 'event_not_found' };
    }

    const profileSnap = await transaction.get(profileRef);
    if (!profileSnap.exists) {
      return { error: 'profile_not_found' };
    }

    const data = eventSnap.data();
    const attendees = new Set(data.attendees || []);

    if (!attendees.has(userId)) {
      attendees.add(userId);
      transaction.update(eventRef, {
        attendees: Array.from(attendees),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return { event: { ...toEvent(eventSnap), attendees: Array.from(attendees) } };
  });
}

export async function upsertTicketmasterEvents(events) {
  const normalizedEvents = Array.isArray(events) ? events.filter(Boolean) : [];
  const snapshot = await eventsCollection.where('source', '==', 'ticketmaster').get();
  const existingDocs = new Map(snapshot.docs.map((doc) => [doc.id, doc]));
  const incomingIds = new Set();
  const batch = db.batch();
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  for (const event of normalizedEvents) {
    if (!event.externalId) {
      continue;
    }

    const docId = `ticketmaster-${event.externalId}`;
    incomingIds.add(docId);
    const docRef = eventsCollection.doc(docId);
    const basePayload = {
      name: event.name,
      category: event.category,
      dateTime: event.dateTime,
      location: { ...event.location },
      source: 'ticketmaster',
      externalId: event.externalId,
      externalUrl: event.externalUrl || null,
      venueName: event.venueName || null,
      updatedAt: serverTimestamp,
      lastSyncedAt: serverTimestamp
    };

    if (existingDocs.has(docId)) {
      batch.set(docRef, basePayload, { merge: true });
    } else {
      batch.set(
        docRef,
        {
          ...basePayload,
          attendees: [],
          createdAt: serverTimestamp
        },
        { merge: false }
      );
    }
  }

  for (const [docId, doc] of existingDocs.entries()) {
    if (!incomingIds.has(docId)) {
      batch.delete(doc.ref);
    }
  }

  let writeCount = normalizedEvents.length;
  writeCount += Array.from(existingDocs.keys()).filter((id) => !incomingIds.has(id)).length;

  if (writeCount === 0) {
    return { updated: 0, removed: 0 };
  }

  await batch.commit();
  return { updated: incomingIds.size, removed: existingDocs.size - incomingIds.size };
}
