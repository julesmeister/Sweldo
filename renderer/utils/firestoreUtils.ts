import { Timestamp } from "firebase/firestore";

/**
 * Type guard to check if a model is Firestore-enabled
 */
export function isFirestoreEnabled<T>(model: T): model is T & {
  syncToFirestore: () => Promise<void>;
  syncFromFirestore: () => Promise<void>;
} {
  return "syncToFirestore" in model && "syncFromFirestore" in model;
}

/**
 * Get the Firestore collection name for a model
 */
export function getFirestoreCollection(modelName: string): string {
  return modelName.toLowerCase().replace(/_firestore$/, "");
}

/**
 * Check if a model name has a Firestore implementation
 */
export function hasFirestoreImplementation(modelName: string): boolean {
  return modelName.endsWith("_firestore.ts");
}

/**
 * Convert a model name to its Firestore implementation name
 */
export function toFirestoreModelName(modelName: string): string {
  return modelName.replace(/\.ts$/, "_firestore.ts");
}

/**
 * Convert a Firestore model name to its base model name
 */
export function toBaseModelName(firestoreModelName: string): string {
  return firestoreModelName.replace(/_firestore\.ts$/, ".ts");
}

/**
 * List of all Firestore-enabled models
 */
export const FIRESTORE_ENABLED_MODELS = [
  "attendance",
  "compensation",
  "employee",
  "settings",
  "holiday",
  "leave",
  "loan",
  "missingTime",
  "payroll",
  "role",
  "shorts",
  "statistics",
] as const;

export type FirestoreEnabledModel = (typeof FIRESTORE_ENABLED_MODELS)[number];

/**
 * Check if a model name is in the list of Firestore-enabled models
 */
export function isFirestoreEnabledModel(
  modelName: string
): modelName is FirestoreEnabledModel {
  return FIRESTORE_ENABLED_MODELS.includes(modelName as FirestoreEnabledModel);
}
