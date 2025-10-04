import admin from 'firebase-admin';
import { Firestore } from '@google-cloud/firestore';

const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'eventbuddy';
const defaultProjectId =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  'eventbuddy-2260c';

const computedDatabaseUrl = process.env.FIREBASE_DATABASE_URL || `https://${defaultProjectId}-default-rtdb.firebaseio.com`;

const existingApp = admin.apps.length ? admin.app() : null;
const app = existingApp || admin.initializeApp({ databaseURL: computedDatabaseUrl });

const db = new Firestore({
  projectId: app.options.projectId,
  databaseId: FIRESTORE_DATABASE_ID
});

db.settings({ ignoreUndefinedProperties: true });

const realtimeDb = admin.database(app);

export { admin, db, realtimeDb };
