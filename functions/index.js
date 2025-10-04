import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import { createApp } from './backend/app.js';
import { syncTicketmasterEvents } from './backend/ticketmaster.js';

setGlobalOptions({ region: 'europe-west1' });

const app = createApp();

export const api = onRequest({ invoker: 'public' }, app);

export const nightlyTicketmasterSync = onSchedule(
  {
    schedule: '0 2 * * *',
    timeZone: 'UTC'
  },
  async () => {
    await syncTicketmasterEvents();
  }
);
