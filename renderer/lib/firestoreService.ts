import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  getDocs,
  Firestore,
  DocumentData,
  DocumentReference,
  QueryConstraint,
  serverTimestamp,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { useSettingsStore } from "../stores/settingsStore";

// Initialize Firebase with your config
// In production, these values should be environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log("[FIREBASE CONFIG]", {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

// Centralized variable to cache company name
let cachedCompanyName: string | null = null;

/**
 * Initializes Firebase if it hasn't been initialized yet
 * @returns Firebase app instance
 */
export const initializeFirebase = (): FirebaseApp => {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }
  return initializeApp(firebaseConfig);
};

/**
 * Gets Firestore instance
 * @returns Firestore instance
 */
export const getFirestoreInstance = (): Firestore => {
  initializeFirebase();
  return getFirestore();
};

/**
 * Determines if the application is running in Electron or web environment
 * @returns boolean indicating if app is running in web environment
 */
export const isWebEnvironment = (): boolean => {
  return typeof window !== "undefined" && !window.electron;
};

/**
 * Manually sets the company name for Firestore operations
 * This function can be used during initialization or when switching companies
 * @param name The company name to use for Firestore operations
 */
export const setFirestoreCompanyName = (name: string): void => {
  if (!name) {
    console.warn(
      "Attempted to set empty company name for Firestore operations"
    );
    return;
  }
  cachedCompanyName = name;
  console.log(`Company name for Firestore operations set to: ${name}`);
};

/**
 * Gets the company name from the settings store
 * @returns Company name
 */
export const getCompanyName = async (): Promise<string> => {
  // First check if we have a cached company name
  if (cachedCompanyName) {
    return cachedCompanyName;
  }

  try {
    // Try to get company name from settings store
    const settingsStore = useSettingsStore.getState();

    if (settingsStore && settingsStore.companyName) {
      cachedCompanyName = settingsStore.companyName;
      return settingsStore.companyName;
    }

    // Fall back to environment variable if settings store doesn't have it
    const envCompanyName = process.env.NEXT_PUBLIC_COMPANY_NAME;
    if (envCompanyName) {
      cachedCompanyName = envCompanyName;
      return envCompanyName;
    }

    // Last resort - use a default name
    console.warn(
      "No company name found in settings or environment. Using default."
    );
    return "DefaultCompany";
  } catch (error) {
    console.error("Error fetching company name:", error);
    return "DefaultCompany";
  }
};

/**
 * Constructs a document path for a specific collection and document
 * @param subcollection - The subcollection name (e.g., 'employees', 'attendances')
 * @param docId - The document ID
 * @param companyName - Optional company name, will be fetched if not provided
 * @returns Full document path
 */
export const constructDocPath = async (
  subcollection: string,
  docId: string,
  companyName?: string
): Promise<string> => {
  const company = companyName || (await getCompanyName());
  return `companies/${company}/${subcollection}/${docId}`;
};

/**
 * Creates document ID for time-based data (attendances, leaves, etc.)
 * @param employeeId - Employee ID
 * @param year - Year
 * @param month - Month (1-12)
 * @returns Document ID in format employeeId_year_month
 */
export const createTimeBasedDocId = (
  employeeId: string,
  year: number,
  month: number
): string => {
  return `${employeeId}_${year}_${month}`;
};

/**
 * Fetches a document from Firestore
 * @param subcollection - The subcollection name
 * @param docId - The document ID
 * @param companyName - Optional company name
 * @returns Document data or null if not found
 */
export const fetchDocument = async <T>(
  subcollection: string,
  docId: string,
  companyName?: string
): Promise<T | null> => {
  try {
    const db = getFirestoreInstance();
    const company = companyName || (await getCompanyName());
    const docRef = doc(db, `companies/${company}/${subcollection}/${docId}`);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as T;
    }
    return null;
  } catch (error) {
    console.error(
      `Error fetching document from ${subcollection}/${docId}:`,
      error
    );
    throw error;
  }
};

/**
 * Saves a document to Firestore
 * @param subcollection - The subcollection name
 * @param docId - The document ID
 * @param data - The data to save
 * @param companyName - Optional company name
 * @param merge - Whether to merge with existing data or overwrite
 * @returns Promise that resolves when save is complete
 */
export const saveDocument = async <T extends DocumentData>(
  subcollection: string,
  docId: string,
  data: T,
  companyName?: string,
  merge: boolean = true
): Promise<void> => {
  try {
    const db = getFirestoreInstance();
    const company = companyName || (await getCompanyName());
    const docRef = doc(db, `companies/${company}/${subcollection}/${docId}`);

    // Add last modified timestamp
    const dataWithTimestamp = {
      ...data,
      lastModified: serverTimestamp(),
    };

    await setDoc(docRef, dataWithTimestamp, { merge });
  } catch (error) {
    console.error(`Error saving document to ${subcollection}/${docId}:`, error);
    throw error;
  }
};

/**
 * Updates a document in Firestore
 * @param subcollection - The subcollection name
 * @param docId - The document ID
 * @param data - The data to update
 * @param companyName - Optional company name
 * @returns Promise that resolves when update is complete
 */
export const updateDocument = async <T extends DocumentData>(
  subcollection: string,
  docId: string,
  data: Partial<T>,
  companyName?: string
): Promise<void> => {
  try {
    const db = getFirestoreInstance();
    const company = companyName || (await getCompanyName());
    const docRef = doc(db, `companies/${company}/${subcollection}/${docId}`);

    // Add last modified timestamp
    const dataWithTimestamp = {
      ...data,
      lastModified: serverTimestamp(),
    };

    await updateDoc(docRef, dataWithTimestamp);
  } catch (error) {
    console.error(
      `Error updating document in ${subcollection}/${docId}:`,
      error
    );
    throw error;
  }
};

/**
 * Deletes a document from Firestore
 * @param subcollection - The subcollection name
 * @param docId - The document ID
 * @param companyName - Optional company name
 * @returns Promise that resolves when delete is complete
 */
export const deleteDocument = async (
  subcollection: string,
  docId: string,
  companyName?: string
): Promise<void> => {
  try {
    const db = getFirestoreInstance();
    const company = companyName || (await getCompanyName());
    const docRef = doc(db, `companies/${company}/${subcollection}/${docId}`);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(
      `Error deleting document from ${subcollection}/${docId}:`,
      error
    );
    throw error;
  }
};

/**
 * Queries documents in a subcollection
 * @param subcollection - The subcollection name
 * @param constraints - Query constraints (where, orderBy, etc.)
 * @param companyName - Optional company name
 * @returns Array of documents matching the query
 */
export const queryDocuments = async <T>(
  subcollection: string,
  constraints: QueryConstraint[],
  companyName?: string
): Promise<T[]> => {
  try {
    const db = getFirestoreInstance();
    const company = companyName || (await getCompanyName());
    const collectionRef = collection(
      db,
      `companies/${company}/${subcollection}`
    );
    const q = query(collectionRef, ...constraints);
    const querySnapshot = await getDocs(q);

    const results: T[] = [];
    querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
      results.push({ id: doc.id, ...doc.data() } as T);
    });

    return results;
  } catch (error) {
    console.error(`Error querying documents in ${subcollection}:`, error);
    throw error;
  }
};

/**
 * Fetches a time-based document (attendance, leaves, etc.)
 * @param subcollection - The subcollection name
 * @param employeeId - Employee ID
 * @param year - Year
 * @param month - Month (1-12)
 * @param companyName - Optional company name
 * @returns Document data or null if not found
 */
export const fetchTimeBasedDocument = async <T>(
  subcollection: string,
  employeeId: string,
  year: number,
  month: number,
  companyName?: string
): Promise<T | null> => {
  const docId = createTimeBasedDocId(employeeId, year, month);
  return fetchDocument<T>(subcollection, docId, companyName);
};

/**
 * Saves a time-based document (attendance, leaves, etc.)
 * @param subcollection - The subcollection name
 * @param employeeId - Employee ID
 * @param year - Year
 * @param month - Month (1-12)
 * @param data - The data to save
 * @param companyName - Optional company name
 * @returns Promise that resolves when save is complete
 */
export const saveTimeBasedDocument = async <T extends DocumentData>(
  subcollection: string,
  employeeId: string,
  year: number,
  month: number,
  data: T,
  companyName?: string
): Promise<void> => {
  const docId = createTimeBasedDocId(employeeId, year, month);
  return saveDocument<T>(subcollection, docId, data, companyName);
};

/**
 * Query time-based documents for an employee
 * @param subcollection - The subcollection name
 * @param employeeId - Employee ID
 * @param year - Optional year to filter by
 * @param month - Optional month to filter by
 * @param companyName - Optional company name
 * @returns Array of matching documents
 */
export const queryTimeBasedDocuments = async <T>(
  subcollection: string,
  employeeId: string,
  year?: number,
  month?: number,
  companyName?: string
): Promise<T[]> => {
  const constraints: QueryConstraint[] = [
    where("employeeId", "==", employeeId),
  ];

  if (year !== undefined) {
    constraints.push(where("year", "==", year));
  }

  if (month !== undefined) {
    constraints.push(where("month", "==", month));
  }

  return queryDocuments<T>(subcollection, constraints, companyName);
};

// Helper function for migrating existing data to Firestore
export const migrateToFirestore = async <T extends DocumentData>(
  data: T[],
  subcollection: string,
  docIdFn: (item: T) => string,
  companyName?: string
): Promise<void> => {
  try {
    for (const item of data) {
      const docId = docIdFn(item);
      await saveDocument(subcollection, docId, item, companyName, false);
    }
  } catch (error) {
    console.error(`Error migrating data to ${subcollection}:`, error);
    throw error;
  }
};

/**
 * Fetches an entire collection from Firestore
 * @param subcollection - The subcollection name
 * @param companyName - Optional company name
 * @returns Array of all documents in the collection
 */
export const fetchCollection = async <T>(
  subcollection: string,
  companyName?: string
): Promise<T[]> => {
  try {
    const db = getFirestoreInstance();
    const company = companyName || (await getCompanyName());
    const collectionRef = collection(
      db,
      `companies/${company}/${subcollection}`
    );
    const querySnapshot = await getDocs(collectionRef);

    const results: T[] = [];
    querySnapshot.forEach((doc) => {
      results.push(doc.data() as T);
    });

    return results;
  } catch (error) {
    console.error(`Error fetching collection ${subcollection}:`, error);
    throw error;
  }
};

/**
 * Export the deleteField function from Firebase for use in document updates
 */
export { deleteField } from "firebase/firestore";

/**
 * Queries documents in a subcollection with array of query conditions
 * @param subcollection - The subcollection name
 * @param conditions - Array of condition arrays [field, operator, value]
 * @param companyName - Optional company name
 * @returns Array of documents matching the query
 */
export const queryCollection = async <T>(
  subcollection: string,
  conditions: [string, string, any][],
  companyName?: string
): Promise<T[]> => {
  try {
    const db = getFirestoreInstance();
    const company = companyName || (await getCompanyName());
    const collectionRef = collection(
      db,
      `companies/${company}/${subcollection}`
    );

    // Convert conditions to QueryConstraints
    const constraints: QueryConstraint[] = conditions.map(
      ([field, op, value]) => where(field, op as any, value)
    );

    const q = query(collectionRef, ...constraints);
    const querySnapshot = await getDocs(q);

    const results: T[] = [];
    querySnapshot.forEach((doc) => {
      results.push(doc.data() as T);
    });

    return results;
  } catch (error) {
    console.error(`Error querying collection ${subcollection}:`, error);
    throw error;
  }
};
