import admin from 'firebase-admin';
import { Firestore } from '@google-cloud/firestore';

const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'eventbuddy';

const app = admin.apps.length ? admin.app() : admin.initializeApp();

const db = new Firestore({
  projectId: app.options.projectId,
  databaseId: FIRESTORE_DATABASE_ID
});

db.settings({ ignoreUndefinedProperties: true });

export { admin, db };
