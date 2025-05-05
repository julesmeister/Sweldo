// Mock Firestore Timestamp
class MockTimestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  toDate(): Date {
    return new Date(this.seconds * 1000);
  }

  static fromDate(date: Date): MockTimestamp {
    return new MockTimestamp(Math.floor(date.getTime() / 1000), 0);
  }
}

// Mock the firebase/firestore module
jest.mock("firebase/firestore", () => ({
  Timestamp: MockTimestamp,
}));

import {
  processInBatches,
  transformToFirestoreFormat,
  transformFromFirestoreFormat,
} from "../utils/firestoreSyncUtils";

describe("Firestore Sync Utilities", () => {
  describe("processInBatches", () => {
    it("should process items in batches", async () => {
      const items = [1, 2, 3, 4, 5];
      const processedItems: number[] = [];
      const processFn = async (item: number) => {
        processedItems.push(item);
      };

      await processInBatches(items, 2, processFn);

      expect(processedItems).toEqual([1, 2, 3, 4, 5]);
    });

    it("should call onProgress for each batch", async () => {
      const items = [1, 2, 3, 4, 5];
      const progressMessages: string[] = [];
      const onProgress = (message: string) => {
        progressMessages.push(message);
      };

      await processInBatches(items, 2, async () => {}, onProgress);

      expect(progressMessages).toContain("Processed batch 1 of 3");
      expect(progressMessages).toContain("Processed batch 2 of 3");
      expect(progressMessages).toContain("Processed batch 3 of 3");
    });
  });

  describe("transformToFirestoreFormat", () => {
    it("should convert Date objects to Firestore Timestamps", () => {
      const date = new Date("2024-01-01");
      const result = transformToFirestoreFormat(date);

      expect(result).toBeInstanceOf(MockTimestamp);
      expect(result.seconds).toBe(Math.floor(date.getTime() / 1000));
      expect(result.nanoseconds).toBe(0);
    });

    it("should handle nested objects", () => {
      const data = {
        date: new Date("2024-01-01"),
        nested: {
          anotherDate: new Date("2024-01-02"),
        },
      };

      const result = transformToFirestoreFormat(data);

      expect(result.date).toBeInstanceOf(MockTimestamp);
      expect(result.nested.anotherDate).toBeInstanceOf(MockTimestamp);
    });
  });

  describe("transformFromFirestoreFormat", () => {
    it("should convert Firestore Timestamps to Date objects", () => {
      const timestamp = new MockTimestamp(1704067200, 0);

      const result = transformFromFirestoreFormat<Date>(timestamp);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(1704067200000);
    });

    it("should handle nested objects", () => {
      const data = {
        timestamp: new MockTimestamp(1704067200, 0),
        nested: {
          anotherTimestamp: new MockTimestamp(1704153600, 0),
        },
      };

      interface TimestampData {
        timestamp: Date;
        nested: {
          anotherTimestamp: Date;
        };
      }

      const result = transformFromFirestoreFormat<TimestampData>(data);

      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.nested.anotherTimestamp).toBeInstanceOf(Date);
    });
  });
});
