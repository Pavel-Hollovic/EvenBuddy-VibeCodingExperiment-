import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { createApp } from './backend/app.js';

setGlobalOptions({ region: 'europe-west1' });

const app = createApp();

export const api = onRequest({ invoker: 'public' }, app);
