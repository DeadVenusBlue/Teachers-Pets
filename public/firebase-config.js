// Firebase web configuration is a public project identifier, not a credential.
// Access is enforced by Authentication plus firestore.rules.
export const LIVE_PROJECT_ID = 'erins-proj-788fe';
export const EMULATOR_PROJECT_ID = 'demo-my-art-pets';

export function isLocalEmulatorHost(hostname = window.location.hostname) {
  return hostname === '127.0.0.1' || hostname === 'localhost';
}

export function firebaseConfig(hostname = window.location.hostname) {
  if (isLocalEmulatorHost(hostname)) {
    return {
      apiKey: 'demo-my-art-pets-key',
      authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
      projectId: EMULATOR_PROJECT_ID
    };
  }
  return {
    apiKey: 'AIzaSyBOEJxzBtvsjjuTsU29AqXulXwzXFx8uz0',
    authDomain: 'erins-proj-788fe.firebaseapp.com',
    messagingSenderId: '980559869247',
    projectId: LIVE_PROJECT_ID,
    storageBucket: 'erins-proj-788fe.firebasestorage.app'
  };
}
