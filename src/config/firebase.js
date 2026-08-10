// src/config/firebase.js
const admin = require('firebase-admin');
const logger = require('./logger');

let firebaseApp = null;

function initFirebase() {
  if (firebaseApp) return firebaseApp;

  if (!process.env.FIREBASE_PROJECT_ID) {
    logger.warn('Firebase not configured - push notifications disabled');
    return null;
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    logger.info('✅ Firebase initialized');
    return firebaseApp;
  } catch (error) {
    logger.error('Firebase initialization failed:', error.message);
    return null;
  }
}

async function sendPushNotification(fcmToken, { title, body, data = {} }) {
  if (!firebaseApp) return { success: false, error: 'Firebase not configured' };

  try {
    const message = {
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high' },
      apns: { payload: { aps: { badge: 1, sound: 'default' } } },
    };
    const result = await admin.messaging().send(message);
    return { success: true, messageId: result };
  } catch (error) {
    logger.error('Push notification error:', error.message);
    return { success: false, error: error.message };
  }
}

async function sendMulticastNotification(fcmTokens, { title, body, data = {} }) {
  if (!firebaseApp || !fcmTokens.length) return;

  try {
    const message = {
      tokens: fcmTokens,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    };
    const result = await admin.messaging().sendEachForMulticast(message);
    logger.info(`Multicast sent: ${result.successCount}/${fcmTokens.length} succeeded`);
    return result;
  } catch (error) {
    logger.error('Multicast notification error:', error.message);
  }
}

module.exports = { initFirebase, sendPushNotification, sendMulticastNotification };
