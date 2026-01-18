import { initializeApp } from "firebase/app";
import { getAnalytics, logEvent } from "firebase/analytics";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD8QJwPeRF7IMp_4Pi37vWhE_iigHplN44",
  authDomain: "oxinot-d329b.firebaseapp.com",
  projectId: "oxinot-d329b",
  storageBucket: "oxinot-d329b.firebasestorage.app",
  messagingSenderId: "805231034095",
  appId: "1:805231034095:web:2dc6afbc3554a87898a51a",
  measurementId: "G-4H10RDHSK1",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

/**
 * Log an analytics event
 * @param eventName - Name of the event
 * @param eventParams - Event parameters (optional)
 */
export const trackEvent = (
  eventName: string,
  eventParams?: Record<string, unknown>
) => {
  try {
    logEvent(analytics, eventName, eventParams);
  } catch (error) {
    console.error("Failed to log analytics event:", error);
  }
};

export { analytics, app };
