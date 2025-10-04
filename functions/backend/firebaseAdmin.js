import admin from 'firebase-admin';
import 'firebase-admin/database';
import { Firestore } from '@google-cloud/firestore';

const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'eventbuddy';
const fallbackProjectId =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  'eventbuddy-2260c';

let app = null;
if (admin.apps.length) {
  app = admin.app();
} else if (process.env.FIREBASE_DATABASE_URL) {
  app = admin.initializeApp({ databaseURL: process.env.FIREBASE_DATABASE_URL });
} else {
  app = admin.initializeApp();
}

const projectId = app.options.projectId || fallbackProjectId;

const db = new Firestore({
  projectId,
  databaseId: FIRESTORE_DATABASE_ID
});

db.settings({ ignoreUndefinedProperties: true });

const realtimeDb = admin.database(app);

export { admin, db, realtimeDb };
