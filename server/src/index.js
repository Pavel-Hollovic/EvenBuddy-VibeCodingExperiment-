import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import { z } from 'zod';
import { CATEGORIES } from './constants.js';
import {
  upsertProfile,
  createEvent,
  listEvents,
  joinEvent,
  getProfile,
  getEvent,
  getProfileByEmail
} from './store.js';
import { seedInitialData } from './seed.js';

seedInitialData();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const profileSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(80, 'Name must be 80 characters or fewer')
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, 'Name cannot be empty'),
  email: z
    .string()
    .email('Email must be a valid address')
    .transform((val) => val.trim().toLowerCase())
});

const eventSchema = z.object({
  name: z
    .string()
    .min(1, 'Event name is required')
    .max(120, 'Event name must be 120 characters or fewer'),
  category: z.enum(CATEGORIES, {
    errorMap: () => ({ message: 'Invalid category' })
  }),
  dateTime: z
    .string()
    .refine((val) => dayjs(val).isValid(), 'dateTime must be a valid ISO 8601 string'),
  location: z.object({
    lat: z.coerce.number({ invalid_type_error: 'lat must be a number' }).min(-90).max(90),
    lng: z.coerce.number({ invalid_type_error: 'lng must be a number' }).min(-180).max(180)
  }),
  creatorUserId: z.string().uuid('creatorUserId must be a valid UUID')
});

const joinSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID')
});

const querySchema = z.object({
  categories: z.union([z.string(), z.array(z.string())]).optional(),
  start: z.string().optional(),
  end: z.string().optional()
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/categories', (_req, res) => {
  res.json({ categories: CATEGORIES });
});

app.post('/api/profiles', (req, res) => {
  const result = profileSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'validation_error', details: result.error.issues });
  }

  const { name, email } = result.data;
  const existing = getProfileByEmail(email);
  const profile = upsertProfile({ name, email });

  return res.status(existing ? 200 : 201).json(profile);
});

app.get('/api/profiles/:profileId', (req, res) => {
  const profile = getProfile(req.params.profileId);
  if (!profile) {
    return res.status(404).json({ error: 'profile_not_found' });
  }
  res.json(profile);
});

app.post('/api/events', (req, res) => {
  const result = eventSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'validation_error', details: result.error.issues });
  }

  const { creatorUserId, dateTime } = result.data;
  const profile = getProfile(creatorUserId);
  if (!profile) {
    return res.status(404).json({ error: 'creator_not_found' });
  }

  const normalizedDateTime = dayjs(dateTime).toISOString();
  const event = createEvent({ ...result.data, dateTime: normalizedDateTime });
  res.status(201).json(event);
});

app.get('/api/events', (req, res) => {
  const parseResult = querySchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'validation_error', details: parseResult.error.issues });
  }

  const { categories: categoriesParam, start, end } = parseResult.data;
  const categoryValues = categoriesParam
    ? Array.isArray(categoriesParam)
      ? categoriesParam
      : [categoriesParam]
    : null;
  const categorySet = categoryValues
    ? new Set(
        categoryValues
          .map((item) => item.trim())
          .filter((item) => CATEGORIES.includes(item))
      )
    : null;

  const startTime = start ? dayjs(start) : null;
  const endTime = end ? dayjs(end) : null;

  if (startTime && !startTime.isValid()) {
    return res.status(400).json({ error: 'invalid_start_time' });
  }
  if (endTime && !endTime.isValid()) {
    return res.status(400).json({ error: 'invalid_end_time' });
  }
  if (startTime && endTime && endTime.isBefore(startTime)) {
    return res.status(400).json({ error: 'invalid_time_range' });
  }

  const events = listEvents({ categories: categorySet, startTime, endTime });
  res.json({ events });
});

app.get('/api/events/:eventId', (req, res) => {
  const event = getEvent(req.params.eventId);
  if (!event) {
    return res.status(404).json({ error: 'event_not_found' });
  }
  res.json(event);
});

app.post('/api/events/:eventId/join', (req, res) => {
  const validation = joinSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'validation_error', details: validation.error.issues });
  }

  const { eventId } = req.params;
  const { userId } = validation.data;
  const { error, event } = joinEvent({ eventId, userId });
  if (error === 'event_not_found') {
    return res.status(404).json({ error });
  }
  if (error === 'profile_not_found') {
    return res.status(404).json({ error });
  }

  res.json(event);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_server_error' });
});

app.listen(PORT, () => {
  console.log(`Event Buddy API listening on port ${PORT}`);
});
