import { Timestamp } from "firebase/firestore";

export async function processInBatches<T>(
  items: T[],
  batchSize: number,
  processFn: (item: T) => Promise<void>,
  onProgress?: (message: string) => void
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processFn));
    onProgress?.(
      `Processed batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(
        items.length / batchSize
      )}`
    );
  }
}

export function transformToFirestoreFormat<T>(data: T): any {
  if (data instanceof Date) {
    return Timestamp.fromDate(data);
  }
  if (typeof data === "string" && !isNaN(Date.parse(data))) {
    return Timestamp.fromDate(new Date(data));
  }
  if (Array.isArray(data)) {
    return data.map(transformToFirestoreFormat);
  }
  if (typeof data === "object" && data !== null) {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        transformToFirestoreFormat(value),
      ])
    );
  }
  return data;
}

export function transformFromFirestoreFormat<T>(data: any): T {
  if (data instanceof Timestamp) {
    return data.toDate() as T;
  }
  if (Array.isArray(data)) {
    return data.map(transformFromFirestoreFormat) as T;
  }
  if (typeof data === "object" && data !== null) {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        transformFromFirestoreFormat(value),
      ])
    ) as T;
  }
  return data as T;
}
