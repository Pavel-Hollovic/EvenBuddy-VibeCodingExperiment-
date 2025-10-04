# Event Buddy Deployment Guide

This repository contains a Vite-powered React client (`client/`) and a Node/Express API (`server/`). The steps below walk through how to deploy the front-end to [Firebase Hosting](https://firebase.google.com/products/hosting).

## Prerequisites

- Node.js 18 or newer installed locally.
- A Google account for Firebase.
- (Optional) An existing Firebase project. If you do not already have one, the initialization process will prompt you to create it.

## Install dependencies

From the repo root, install dependencies for both the client and the server:

```bash
cd client
npm install
cd ../server
npm install
```

## Build the client

Firebase Hosting will serve the static build output created by Vite. When you are ready to deploy, build the client application:

```bash
cd client
npm run build
```

This produces the production files in `client/dist/`.

## Initialize Firebase Hosting

1. Install the Firebase CLI if you have not already:
   ```bash
   npm install -g firebase-tools
   ```
2. Log in to your Google account:
   ```bash
   firebase login
   ```
3. In the repository root, start the Firebase Hosting setup:
   ```bash
   cd /path/to/EvenBuddy-VibeCodingExperiment-
   firebase init hosting
   ```
4. When prompted by the CLI:
   - Select your Firebase project (or create one when prompted).
   - Set the **public directory** to `client/dist`.
   - Choose **Yes** when asked to configure as a single-page app so that Firebase rewrites all routes to `index.html`.
   - Decline GitHub Action setup unless you plan to use CI/CD.

The CLI creates a `firebase.json` and `.firebaserc` file in the repo. Commit these files so the configuration is tracked in version control.

## Deploy

After initialization and a successful client build, deploy with:

```bash
firebase deploy --only hosting
```

Firebase will upload the contents of `client/dist` and give you a hosting URL. Run `firebase deploy` again whenever you want to publish a fresh build.

## Deploying the API (optional)

Firebase Hosting only handles static assets. To run the Express server in `server/`, consider deploying it separately (for example, to Render, Railway, Google Cloud Run, or Firebase Cloud Functions). Update the client code to call the deployed API URL once the backend is hosted.

## Need project access?

If you are collaborating with a teammate, ensure they are added to the Firebase project via the [Firebase console](https://console.firebase.google.com/) so they can deploy with their own credentials.
