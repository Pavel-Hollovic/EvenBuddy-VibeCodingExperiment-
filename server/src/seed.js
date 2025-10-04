import dayjs from 'dayjs';
import { CATEGORIES } from './constants.js';
import { upsertProfile, createEvent } from './store.js';

let seeded = false;

export function seedInitialData() {
  if (seeded) return;

  const alice = upsertProfile({ name: 'Alice Explorer', email: 'alice@example.com' });
  const ben = upsertProfile({ name: 'Ben Musician', email: 'ben@example.com' });
  const carla = upsertProfile({ name: 'Carla Runner', email: 'carla@example.com' });

  createEvent({
    name: 'Sunset Park Run',
    category: CATEGORIES[0],
    dateTime: dayjs().add(1, 'day').hour(18).minute(0).second(0).millisecond(0).toISOString(),
    location: { lat: 40.6602, lng: -73.969 },
    creatorUserId: carla.id
  });

  createEvent({
    name: 'Jazz Jam Night',
    category: CATEGORIES[1],
    dateTime: dayjs().add(2, 'day').hour(20).minute(0).second(0).millisecond(0).toISOString(),
    location: { lat: 40.7209, lng: -74.0007 },
    creatorUserId: ben.id
  });

  createEvent({
    name: 'Rooftop Social',
    category: CATEGORIES[2],
    dateTime: dayjs().add(3, 'day').hour(19).minute(30).second(0).millisecond(0).toISOString(),
    location: { lat: 40.7419, lng: -73.9894 },
    creatorUserId: alice.id
  });

  seeded = true;
}
