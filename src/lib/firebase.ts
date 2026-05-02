import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
// import localConfig from '../../firebase-applet-config.json';

// Prioritize environment variables (standard for GitHub/Vercel/etc)
// Fallback to local config file for AI Studio development
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_APPLET_CONFIG_API_KEY.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_APPLET_CONFIG_API_KEY.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || import.meta.env.VITE_FIREBASE_APPLET_CONFIG_API_KEY.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_APPLET_CONFIG_API_KEY.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_APPLET_CONFIG_API_KEY.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || import.meta.env.VITE_FIREBASE_APPLET_CONFIG_API_KEY.appId,
};

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || import.meta.env.VITE_FIREBASE_APPLET_CONFIG_API_KEY.firestoreDatabaseId || '(default)';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);

// Connection test
async function testConnection() {
  try {
    console.log("🌐 [Lumina] Initializing Firestore connection check...");
    // Attempting a server-side fetch to verify database existence
    // Use a unique ID to avoid overlapping with user data
    await getDocFromServer(doc(db, '_lumina_system_', 'connectivity_check'));
    console.log("✅ [Lumina] Firestore connection established successfully.");
  } catch (error) {
    const err = error as any;
    if (err.message?.includes('offline') || err.code === 'unavailable') {
      console.error("❌ [Lumina] CRITICAL: Could not reach Firestore backend.");
      console.error(`Project ID: ${firebaseConfig.projectId}`);
      console.error("Action Required: Please open your Firebase Console and ensure 'Cloud Firestore' is created and the database ID matches '(default)'.");
    } else if (err.code === 'permission-denied') {
      // Permission denied still means we REACHED the server, so connection is OK
      console.info("✅ [Lumina] Firestore connectivity confirmed (Access controlled by rules).");
    } else {
      console.warn("⚠️ [Lumina] Unexpected connectivity check result:", err.code, err.message);
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  
  // Custom guidance for common setup issues
  let enhancedMessage = message;
  if (message.includes('offline') || message.includes('unavailable')) {
    enhancedMessage = `Firebase connection failed (Client Offline). Please ensure you have: 1. Created the Firestore Database in your Firebase console. 2. Enabled the correct region. 3. Checked your internet connection. (Original error: ${message})`;
  }

  const errInfo: FirestoreErrorInfo = {
    error: enhancedMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  
  if (process.env.NODE_ENV !== 'production') {
    console.error('🔥 [Lumina] Firestore Error Details:', errInfo);
  }

  // If it's an offline error, we log it but don't necessarily want to break the whole UI if we can help it
  // however, for debugging we throw it so the developer sees it.
  throw new Error(JSON.stringify(errInfo));
}
