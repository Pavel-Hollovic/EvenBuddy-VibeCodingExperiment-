import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import { z } from 'zod';
import { CATEGORIES } from './constants.js';
import {
  registerProfile,
  authenticateProfile,
  updateProfileName,
  createEvent,
  listEvents,
  joinEvent,
  getProfile,
  getEvent
} from './store.js';
import { seedInitialData } from './seed.js';
import { syncTicketmasterEvents } from './ticketmaster.js';

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

let seedReady = null;
let ticketmasterSyncStarted = false;

function ensureSeedReady() {
  if (!seedReady) {
    seedReady = seedInitialData();
  }
  return seedReady;
}

function ensureTicketmasterSync() {
  if (ticketmasterSyncStarted) {
    return;
  }
  ticketmasterSyncStarted = true;

  ensureSeedReady()
    ?.catch((error) => {
      console.error('Ticketmaster sync waiting for seed failed', {
        message: error?.message,
        stack: error?.stack
      });
    })
    .finally(() => {
      syncTicketmasterEvents().catch((error) => {
        console.error('Initial Ticketmaster sync failed', {
          message: error?.message,
          stack: error?.stack
        });
      });
    });
}

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  ensureTicketmasterSync();

  app.use((req, res, next) => {
    const promise = ensureSeedReady();
    if (!promise) {
      return next();
    }
    promise.then(() => next()).catch(next);
  });

  const nameSchema = z
    .string()
    .min(1, 'Name is required')
    .max(80, 'Name must be 80 characters or fewer')
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, 'Name cannot be empty');

  const emailSchema = z
    .string()
    .email('Email must be a valid address')
    .transform((val) => val.trim().toLowerCase());

  const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must be 128 characters or fewer');

  const registerSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema
  });

  const loginSchema = z.object({
    email: emailSchema,
    password: passwordSchema
  });

  const profileUpdateSchema = z.object({
    name: nameSchema.optional()
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

  app.post(
    '/api/auth/register',
    asyncHandler(async (req, res) => {
      const result = registerSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'validation_error', details: result.error.issues });
      }

      const { name, email, password } = result.data;
      try {
        const profile = await registerProfile({ name, email, password });
        res.status(201).json(profile);
      } catch (error) {
        if (error.code === 'email_exists') {
          return res.status(409).json({ error: 'email_already_registered' });
        }
        throw error;
      }
    })
  );

  app.post(
    '/api/auth/login',
    asyncHandler(async (req, res) => {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'validation_error', details: result.error.issues });
      }

      const { email, password } = result.data;
      try {
        const profile = await authenticateProfile({ email, password });
        res.json(profile);
      } catch (error) {
        if (error.code === 'invalid_credentials') {
          return res.status(401).json({ error: 'invalid_credentials' });
        }
        throw error;
      }
    })
  );

  app.patch(
    '/api/profiles/:profileId',
    asyncHandler(async (req, res) => {
      const result = profileUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'validation_error', details: result.error.issues });
      }

      const { name } = result.data;
      if (!name) {
        return res.status(400).json({ error: 'nothing_to_update' });
      }

      const updated = await updateProfileName({ profileId: req.params.profileId, name });
      if (!updated) {
        return res.status(404).json({ error: 'profile_not_found' });
      }
      res.json(updated);
    })
  );

  app.get(
    '/api/profiles/:profileId',
    asyncHandler(async (req, res) => {
      const profile = await getProfile(req.params.profileId);
      if (!profile) {
        return res.status(404).json({ error: 'profile_not_found' });
      }
      res.json(profile);
    })
  );

  app.post(
    '/api/events',
    asyncHandler(async (req, res) => {
      const result = eventSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'validation_error', details: result.error.issues });
      }

      const { creatorUserId, dateTime } = result.data;
      const profile = await getProfile(creatorUserId);
      if (!profile) {
        return res.status(404).json({ error: 'creator_not_found' });
      }

      const normalizedDateTime = dayjs(dateTime).toISOString();
      const event = await createEvent({ ...result.data, dateTime: normalizedDateTime });
      res.status(201).json(event);
    })
  );

  app.get(
    '/api/events',
    asyncHandler(async (req, res) => {
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

      const events = await listEvents({ categories: categorySet, startTime, endTime });
      res.json({ events });
    })
  );

  app.get(
    '/api/events/:eventId',
    asyncHandler(async (req, res) => {
      const event = await getEvent(req.params.eventId);
      if (!event) {
        return res.status(404).json({ error: 'event_not_found' });
      }
      res.json(event);
    })
  );

  app.post(
    '/api/events/:eventId/join',
    asyncHandler(async (req, res) => {
      const validation = joinSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'validation_error', details: validation.error.issues });
      }

      const { eventId } = req.params;
      const { userId } = validation.data;
      const result = await joinEvent({ eventId, userId });
      if (result.error === 'event_not_found') {
        return res.status(404).json({ error: result.error });
      }
      if (result.error === 'profile_not_found') {
        return res.status(404).json({ error: result.error });
      }

      res.json(result.event);
    })
  );

  app.use((err, _req, res, _next) => {
    console.error('API error', {
      message: err?.message,
      code: err?.code,
      stack: err?.stack
    });
    res.status(500).json({ error: 'internal_server_error' });
  });

  return app;
}
