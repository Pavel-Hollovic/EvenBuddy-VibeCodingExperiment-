import { v4 as uuid } from 'uuid';
import dayjs from 'dayjs';
import { admin, db } from './firebaseAdmin.js';

const profilesCollection = db.collection('profiles');
const eventsCollection = db.collection('Events');

function toProfile(doc) {
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
    creatorUserId: data.creatorUserId,
    attendees: data.attendees || []
  };
}

export async function upsertProfile({ name, email }) {
  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  const existingQuery = await profilesCollection.where('email', '==', normalizedEmail).limit(1).get();

  if (!existingQuery.empty) {
    const doc = existingQuery.docs[0];
    const current = doc.data();
    if (current.name !== trimmedName) {
      await doc.ref.update({ name: trimmedName, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    return { profile: toProfile(doc), existed: true };
  }

  const id = uuid();
  const docRef = profilesCollection.doc(id);
  const profile = {
    name: trimmedName,
    email: normalizedEmail,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  await docRef.set(profile);
  const created = await docRef.get();
  return { profile: toProfile(created), existed: false };
}

export async function getProfile(id) {
  const snapshot = await profilesCollection.doc(id).get();
  return toProfile(snapshot);
}

export async function getProfileByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingQuery = await profilesCollection.where('email', '==', normalizedEmail).limit(1).get();
  if (existingQuery.empty) {
    return null;
  }
  return toProfile(existingQuery.docs[0]);
}

export async function createEvent({ name, category, dateTime, location, creatorUserId }) {
  const eventId = uuid();
  const eventRef = eventsCollection.doc(eventId);
  const eventPayload = {
    name,
    category,
    dateTime,
    location: { ...location },
    creatorUserId,
    attendees: [creatorUserId],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
