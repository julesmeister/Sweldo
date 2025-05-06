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
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  getDocs: jest.fn(),
  getFirestore: jest.fn(() => ({
    collection: jest.fn(),
    doc: jest.fn(),
  })),
  serverTimestamp: jest.fn(() => new MockTimestamp(Date.now() / 1000, 0)),
}));

// Mock Firestore service
jest.mock("../lib/firestoreService", () => ({
  fetchDocument: jest.fn(),
  saveDocument: jest.fn(),
  updateDocument: jest.fn(),
  deleteField: jest.fn(),
  createTimeBasedDocId: jest.fn(),
  queryCollection: jest.fn(),
  getCompanyName: jest.fn().mockResolvedValue("TestCompany"),
  isWebEnvironment: jest.fn().mockReturnValue(true),
  getFirestoreInstance: jest.fn().mockReturnValue({
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({}),
    }),
  }),
}));

import {
  processInBatches,
  transformToFirestoreFormat,
  transformFromFirestoreFormat,
} from "../utils/firestoreSyncUtils";
import {
  Attendance,
  AttendanceJsonMonth,
  AttendanceJsonDay,
} from "../model/attendance";
import { createAttendanceFirestore } from "../model/attendance_firestore";
import { AttendanceModel } from "../model/attendance";
import { Employee, EmployeeModel } from "../model/employee";
import { createEmployeeFirestore } from "../model/employee_firestore";
import { Compensation, CompensationModel } from "../model/compensation";
import { createCompensationFirestore } from "../model/compensation_firestore";
import { Holiday, HolidayModel } from "../model/holiday";
import { createHolidayFirestoreInstance } from "../model/holiday_firestore";
import { Leave, LeaveModel } from "../model/leave";
import { createLeaveFirestoreInstance } from "../model/leave_firestore";
import {
  fetchDocument,
  saveDocument,
  updateDocument,
  deleteField,
  createTimeBasedDocId,
  queryCollection,
  getCompanyName,
  getFirestoreInstance,
} from "../lib/firestoreService";
import { Loan, LoanModel } from "../model/loan";
import { createLoanFirestoreInstance } from "../model/loan_firestore";
import { MissingTimeLog, MissingTimeModel } from "../model/missingTime";
import { createMissingTimeFirestoreInstance } from "../model/missingTime_firestore";
import { CashAdvance, CashAdvanceModel } from "../model/cashAdvance";
import { createCashAdvanceFirestoreInstance } from "../model/cashAdvance_firestore";
import { PayrollSummaryModel, Payroll } from "../model/payroll";
import { createPayrollFirestoreInstance } from "../model/payroll_firestore";

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

    it("should transform Attendance data structure correctly", () => {
      const attendance: Attendance = {
        employeeId: "EMP001",
        day: 1,
        month: 1,
        year: 2024,
        timeIn: "09:00",
        timeOut: "17:00",
        schedule: {
          timeIn: "09:00",
          timeOut: "17:00",
          dayOfWeek: 1,
        },
      };

      const result = transformToFirestoreFormat(attendance);

      expect(result).toEqual({
        employeeId: "EMP001",
        day: 1,
        month: 1,
        year: 2024,
        timeIn: "09:00",
        timeOut: "17:00",
        schedule: {
          timeIn: "09:00",
          timeOut: "17:00",
          dayOfWeek: 1,
        },
      });
    });

    it("should transform AttendanceJsonMonth structure correctly", () => {
      const monthData: AttendanceJsonMonth = {
        meta: {
          employeeId: "EMP001",
          year: 2024,
          month: 1,
          lastModified: new Date("2024-01-01").toISOString(),
        },
        days: {
          "1": {
            timeIn: "09:00",
            timeOut: "17:00",
            schedule: {
              timeIn: "09:00",
              timeOut: "17:00",
              dayOfWeek: 1,
            },
          },
        },
      };

      const result = transformToFirestoreFormat(monthData);

      const date = new Date(result.meta.lastModified);
      expect(result.meta.lastModified).toBeInstanceOf(MockTimestamp);
      expect(result.days["1"]).toEqual(monthData.days["1"]);
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

    it("should transform Firestore Attendance data back to local format", () => {
      const firestoreData = {
        employeeId: "EMP001",
        day: 1,
        month: 1,
        year: 2024,
        timeIn: "09:00",
        timeOut: "17:00",
        schedule: {
          timeIn: "09:00",
          timeOut: "17:00",
          dayOfWeek: 1,
        },
      };

      const result = transformFromFirestoreFormat<Attendance>(firestoreData);

      expect(result).toEqual({
        employeeId: "EMP001",
        day: 1,
        month: 1,
        year: 2024,
        timeIn: "09:00",
        timeOut: "17:00",
        schedule: {
          timeIn: "09:00",
          timeOut: "17:00",
          dayOfWeek: 1,
        },
      });
    });
  });
});

describe("Attendance Firestore Sync", () => {
  let mockAttendanceModel: jest.Mocked<AttendanceModel>;
  let mockDb: any;

  beforeEach(() => {
    // Mock AttendanceModel
    mockAttendanceModel = {
      loadAttendances: jest.fn(),
      saveAttendances: jest.fn(),
    } as any;

    // Mock Firestore instance
    mockDb = {
      collection: jest.fn(),
      doc: jest.fn(),
    };
  });

  describe("syncToFirestore", () => {
    it("should sync attendance data to Firestore", async () => {
      const mockAttendances: Attendance[] = [
        {
          employeeId: "EMP001",
          day: 1,
          month: 1,
          year: 2024,
          timeIn: "09:00",
          timeOut: "17:00",
          schedule: {
            timeIn: "09:00",
            timeOut: "17:00",
            dayOfWeek: 1,
          },
        },
      ];

      mockAttendanceModel.loadAttendances.mockResolvedValue(mockAttendances);

      const attendanceFirestore =
        createAttendanceFirestore(mockAttendanceModel);
      const progressCallback = jest.fn();

      await attendanceFirestore.syncToFirestore(progressCallback);

      expect(mockAttendanceModel.loadAttendances).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalled();
    });

    it("should handle errors during sync", async () => {
      mockAttendanceModel.loadAttendances.mockRejectedValue(
        new Error("Sync failed")
      );

      const attendanceFirestore =
        createAttendanceFirestore(mockAttendanceModel);
      const progressCallback = jest.fn();

      await expect(
        attendanceFirestore.syncToFirestore(progressCallback)
      ).rejects.toThrow("Failed to sync attendance to Firestore");
    });
  });

  describe("syncFromFirestore", () => {
    it("should sync attendance data from Firestore", async () => {
      const mockFirestoreData = {
        docs: [
          {
            id: "EMP001",
            data: () => ({
              employeeId: "EMP001",
              day: 1,
              month: 1,
              year: 2024,
              timeIn: "09:00",
              timeOut: "17:00",
              schedule: {
                timeIn: "09:00",
                timeOut: "17:00",
                dayOfWeek: 1,
              },
            }),
          },
        ],
      };

      // Mock Firestore getDocs
      const { getDocs } = require("firebase/firestore");
      getDocs.mockResolvedValue(mockFirestoreData);

      const attendanceFirestore =
        createAttendanceFirestore(mockAttendanceModel);
      const progressCallback = jest.fn();

      await attendanceFirestore.syncFromFirestore(progressCallback);

      expect(mockAttendanceModel.saveAttendances).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalled();
    });

    it("should handle errors during sync from Firestore", async () => {
      const { getDocs } = require("firebase/firestore");
      getDocs.mockRejectedValue(new Error("Firestore error"));

      const attendanceFirestore =
        createAttendanceFirestore(mockAttendanceModel);
      const progressCallback = jest.fn();

      await expect(
        attendanceFirestore.syncFromFirestore(progressCallback)
      ).rejects.toThrow("Failed to sync attendance from Firestore");
    });
  });
});

describe("Employee Firestore Sync", () => {
  let mockEmployeeModel: jest.Mocked<EmployeeModel>;
  let mockDb: any;

  beforeEach(() => {
    // Mock EmployeeModel
    mockEmployeeModel = {
      loadEmployees: jest.fn(),
      saveOnlyNewEmployees: jest.fn(),
    } as any;

    // Mock Firestore instance
    mockDb = {
      collection: jest.fn(),
      doc: jest.fn(),
    };
  });

  describe("syncToFirestore", () => {
    it("should sync employee data to Firestore", async () => {
      const mockEmployees: Employee[] = [
        {
          id: "EMP001",
          name: "John Doe",
          position: "Developer",
          dailyRate: 1000,
          sss: 100,
          philHealth: 50,
          pagIbig: 50,
          status: "active",
          employmentType: "regular",
          lastPaymentPeriod: {
            startDate: "2024-01-01",
            endDate: "2024-01-31",
            start: "2024-01-01",
            end: "2024-01-31",
          },
        },
      ];

      mockEmployeeModel.loadEmployees.mockResolvedValue(mockEmployees);

      // Mock setDoc to resolve successfully
      const { setDoc } = require("firebase/firestore");
      setDoc.mockResolvedValue(undefined);

      const employeeFirestore = createEmployeeFirestore(mockEmployeeModel);
      const progressCallback = jest.fn();

      await employeeFirestore.syncToFirestore(progressCallback);

      expect(mockEmployeeModel.loadEmployees).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalled();
      expect(setDoc).toHaveBeenCalled();
    });

    it("should handle errors during sync", async () => {
      // Mock loadEmployees to reject with an error
      mockEmployeeModel.loadEmployees.mockRejectedValue(
        new Error("Error syncing employees to Firestore")
      );

      const employeeFirestore = createEmployeeFirestore(mockEmployeeModel);
      const progressCallback = jest.fn();

      await expect(
        employeeFirestore.syncToFirestore(progressCallback)
      ).rejects.toThrow("Error syncing employees to Firestore");
    });
  });

  describe("syncFromFirestore", () => {
    it("should sync employee data from Firestore", async () => {
      const mockFirestoreData = {
        docs: [
          {
            id: "EMP001",
            data: () => ({
              id: "EMP001",
              name: "John Doe",
              position: "Developer",
              dailyRate: 1000,
              sss: 100,
              philHealth: 50,
              pagIbig: 50,
              status: "active",
              employmentType: "regular",
              lastPaymentPeriod: {
                startDate: "2024-01-01",
                endDate: "2024-01-31",
                start: "2024-01-01",
                end: "2024-01-31",
              },
            }),
          },
        ],
      };

      // Mock Firestore getDocs
      const { getDocs } = require("firebase/firestore");
      getDocs.mockResolvedValue(mockFirestoreData);

      const employeeFirestore = createEmployeeFirestore(mockEmployeeModel);
      const progressCallback = jest.fn();

      await employeeFirestore.syncFromFirestore(progressCallback);

      expect(mockEmployeeModel.saveOnlyNewEmployees).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalled();
    });

    it("should handle errors during sync from Firestore", async () => {
      // Mock saveOnlyNewEmployees to reject with an error
      mockEmployeeModel.saveOnlyNewEmployees.mockRejectedValue(
        new Error("Error syncing employees from Firestore")
      );

      const employeeFirestore = createEmployeeFirestore(mockEmployeeModel);
      const progressCallback = jest.fn();

      await expect(
        employeeFirestore.syncFromFirestore(progressCallback)
      ).rejects.toThrow("Error syncing employees from Firestore");
    });
  });
});

describe("Compensation Firestore Sync", () => {
  let mockCompensationModel: jest.Mocked<CompensationModel>;
  let mockDb: any;

  beforeEach(() => {
    // Mock CompensationModel
    mockCompensationModel = {
      loadRecords: jest.fn(),
      saveOrUpdateRecords: jest.fn(),
    } as any;

    // Mock Firestore instance
    mockDb = {
      collection: jest.fn(),
      doc: jest.fn(),
    };
  });

  describe("syncToFirestore", () => {
    it("should sync compensation data to Firestore", async () => {
      const mockCompensations: Compensation[] = [
        {
          employeeId: "EMP001",
          day: 1,
          month: 1,
          year: 2024,
          dayType: "Regular",
          dailyRate: 1000,
          hoursWorked: 8,
          overtimeMinutes: 0,
          overtimePay: 0,
          undertimeMinutes: 0,
          undertimeDeduction: 0,
          lateMinutes: 0,
          lateDeduction: 0,
          holidayBonus: 0,
          leaveType: "None",
          leavePay: 0,
          grossPay: 1000,
          deductions: 0,
          netPay: 1000,
          manualOverride: false,
          notes: "",
          absence: false,
          nightDifferentialHours: 0,
          nightDifferentialPay: 0,
        },
      ];

      mockCompensationModel.loadRecords.mockResolvedValue(mockCompensations);

      // Mock setDoc to resolve successfully
      const { setDoc } = require("firebase/firestore");
      setDoc.mockResolvedValue(undefined);

      const compensationFirestore = createCompensationFirestore(
        mockCompensationModel
      );
      const progressCallback = jest.fn();

      await compensationFirestore.syncToFirestore(progressCallback);

      expect(mockCompensationModel.loadRecords).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalled();
      expect(setDoc).toHaveBeenCalled();
    });

    it("should handle errors during sync", async () => {
      // Mock loadRecords to reject with an error
      mockCompensationModel.loadRecords.mockRejectedValue(
        new Error("Failed to sync compensation to Firestore")
      );

      const compensationFirestore = createCompensationFirestore(
        mockCompensationModel
      );
      const progressCallback = jest.fn();

      await expect(
        compensationFirestore.syncToFirestore(progressCallback)
      ).rejects.toThrow("Failed to sync compensation to Firestore");
    });
  });

  describe("syncFromFirestore", () => {
    it("should sync compensation data from Firestore", async () => {
      const mockFirestoreData = {
        docs: [
          {
            id: "EMP001_2024_1",
            data: () => ({
              employeeId: "EMP001",
              day: 1,
              month: 1,
              year: 2024,
              dayType: "Regular",
              dailyRate: 1000,
              hoursWorked: 8,
              overtimeMinutes: 0,
              overtimePay: 0,
              undertimeMinutes: 0,
              undertimeDeduction: 0,
              lateMinutes: 0,
              lateDeduction: 0,
              holidayBonus: 0,
              leaveType: "None",
              leavePay: 0,
              grossPay: 1000,
              deductions: 0,
              netPay: 1000,
              manualOverride: false,
              notes: "",
              absence: false,
              nightDifferentialHours: 0,
              nightDifferentialPay: 0,
            }),
          },
        ],
      };

      // Mock Firestore getDocs
      const { getDocs } = require("firebase/firestore");
      getDocs.mockResolvedValue(mockFirestoreData);

      const compensationFirestore = createCompensationFirestore(
        mockCompensationModel
      );
      const progressCallback = jest.fn();

      await compensationFirestore.syncFromFirestore(progressCallback);

      expect(mockCompensationModel.saveOrUpdateRecords).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalled();
    });

    it("should handle errors during sync from Firestore", async () => {
      // Mock saveOrUpdateRecords to reject with an error
      mockCompensationModel.saveOrUpdateRecords.mockRejectedValue(
        new Error("Failed to sync compensation from Firestore")
      );

      const compensationFirestore = createCompensationFirestore(
        mockCompensationModel
      );
      const progressCallback = jest.fn();

      await expect(
        compensationFirestore.syncFromFirestore(progressCallback)
      ).rejects.toThrow("Failed to sync compensation from Firestore");
    });
  });
});

describe("Holiday Firestore Sync", () => {
  let mockHolidayModel: jest.Mocked<HolidayModel>;
  let mockDb: any;

  beforeEach(() => {
    // Mock HolidayModel
    mockHolidayModel = {
      loadHolidays: jest.fn(),
      saveHolidays: jest.fn(),
    } as any;

    // Mock Firestore instance
    mockDb = {
      collection: jest.fn(),
      doc: jest.fn(),
    };
  });

  describe("syncToFirestore", () => {
    it("should sync holiday data to Firestore", async () => {
      const mockHolidays: Holiday[] = [
        {
          id: "HOL001",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-01"),
          name: "New Year's Day",
          type: "Regular",
          multiplier: 1.5,
        },
        {
          id: "HOL002",
          startDate: new Date("2024-01-15"),
          endDate: new Date("2024-01-15"),
          name: "Chinese New Year",
          type: "Special",
          multiplier: 1.3,
        },
      ];

      mockHolidayModel.loadHolidays.mockResolvedValue(mockHolidays);

      // Mock setDoc to resolve successfully
      const { setDoc } = require("firebase/firestore");
      setDoc.mockResolvedValue(undefined);

      const holidayFirestore = createHolidayFirestoreInstance(mockHolidayModel);
      const progressCallback = jest.fn();

      await holidayFirestore.syncToFirestore(progressCallback);

      expect(mockHolidayModel.loadHolidays).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalled();
      expect(setDoc).toHaveBeenCalled();
    });

    it("should handle errors during sync", async () => {
      // Mock loadHolidays to reject with an error
      mockHolidayModel.loadHolidays.mockRejectedValue(
        new Error("Failed to sync holidays to Firestore")
      );

      const holidayFirestore = createHolidayFirestoreInstance(mockHolidayModel);
      const progressCallback = jest.fn();

      await expect(
        holidayFirestore.syncToFirestore(progressCallback)
      ).rejects.toThrow("Failed to sync holidays to Firestore");
    });
  });

  describe("syncFromFirestore", () => {
    it("should sync holiday data from Firestore", async () => {
      const mockFirestoreData = {
        docs: [
          {
            id: "holidays_2024_1",
            data: () => ({
              meta: {
                year: 2024,
                month: 1,
                lastModified: new Date().toISOString(),
              },
              holidays: {
                HOL001: {
                  startDate: "2024-01-01T00:00:00.000Z",
                  endDate: "2024-01-01T00:00:00.000Z",
                  name: "New Year's Day",
                  type: "Regular",
                  multiplier: 1.5,
                },
                HOL002: {
                  startDate: "2024-01-15T00:00:00.000Z",
                  endDate: "2024-01-15T00:00:00.000Z",
                  name: "Chinese New Year",
                  type: "Special",
                  multiplier: 1.3,
                },
              },
            }),
          },
        ],
      };

      // Mock Firestore getDocs
      const { getDocs } = require("firebase/firestore");
      getDocs.mockResolvedValue(mockFirestoreData);

      const holidayFirestore = createHolidayFirestoreInstance(mockHolidayModel);
      const progressCallback = jest.fn();

      await holidayFirestore.syncFromFirestore(progressCallback);

      expect(mockHolidayModel.saveHolidays).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalled();
    });

    it("should handle errors during sync from Firestore", async () => {
      // Mock saveHolidays to reject with an error
      mockHolidayModel.saveHolidays.mockRejectedValue(
        new Error("Failed to sync holidays from Firestore")
      );

      const holidayFirestore = createHolidayFirestoreInstance(mockHolidayModel);
      const progressCallback = jest.fn();

      await expect(
        holidayFirestore.syncFromFirestore(progressCallback)
      ).rejects.toThrow("Failed to sync holidays from Firestore");
    });
  });
});

describe("Leave Firestore Sync", () => {
  let mockLeaveModel: jest.Mocked<LeaveModel>;
  let leaveFirestore: ReturnType<typeof createLeaveFirestoreInstance>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLeaveModel = {
      loadLeaves: jest.fn(),
      saveOrUpdateLeave: jest.fn(),
    } as unknown as jest.Mocked<LeaveModel>;

    leaveFirestore = createLeaveFirestoreInstance(mockLeaveModel);
  });

  describe("syncToFirestore", () => {
    it("should sync leave data to Firestore", async () => {
      const mockLeaves = [
        {
          id: "1",
          employeeId: "emp1",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-02"),
          type: "Vacation" as const,
          status: "Approved" as const,
          reason: "Test leave",
        },
      ];

      mockLeaveModel.loadLeaves.mockResolvedValue(mockLeaves);
      const progressCallback = jest.fn();

      await leaveFirestore.syncToFirestore(progressCallback);

      expect(mockLeaveModel.loadLeaves).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalled();
      expect(saveDocument).toHaveBeenCalled();
    });

    it("should handle errors during sync", async () => {
      mockLeaveModel.loadLeaves.mockRejectedValue(new Error("Test error"));
      const progressCallback = jest.fn();

      await expect(
        leaveFirestore.syncToFirestore(progressCallback)
      ).rejects.toThrow("Test error");
    });
  });

  describe("syncFromFirestore", () => {
    it("should sync leave data from Firestore", async () => {
      const mockFirestoreData = [
        {
          meta: {
            employeeId: "emp1",
            year: 2024,
            month: 1,
            lastModified: "2024-01-01T00:00:00.000Z",
          },
          leaves: {
            "1": {
              employeeId: "emp1",
              startDate: "2024-01-01T00:00:00.000Z",
              endDate: "2024-01-02T00:00:00.000Z",
              type: "Vacation",
              status: "Approved",
              reason: "Test leave",
            },
            "2": {
              employeeId: "emp1",
              startDate: "2024-01-03T00:00:00.000Z",
              endDate: "2024-01-04T00:00:00.000Z",
              type: "Sick",
              status: "Approved",
              reason: "Test sick leave",
            },
          },
        },
      ];

      (queryCollection as jest.Mock).mockResolvedValue(mockFirestoreData);
      const progressCallback = jest.fn();

      await leaveFirestore.syncFromFirestore(progressCallback);

      expect(mockLeaveModel.saveOrUpdateLeave).toHaveBeenCalledTimes(2);
      expect(progressCallback).toHaveBeenCalled();
    });

    it("should handle errors during sync from Firestore", async () => {
      (queryCollection as jest.Mock).mockRejectedValue(new Error("Test error"));
      const progressCallback = jest.fn();

      await expect(
        leaveFirestore.syncFromFirestore(progressCallback)
      ).rejects.toThrow("Failed to sync leaves from Firestore");
    });
  });
});

describe("Loan Firestore Sync", () => {
  let mockLoanModel: jest.Mocked<LoanModel>;
  let loanFirestore: ReturnType<typeof createLoanFirestoreInstance>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoanModel = {
      loadLoans: jest.fn(),
      createLoan: jest.fn(),
    } as unknown as jest.Mocked<LoanModel>;

    loanFirestore = createLoanFirestoreInstance(mockLoanModel);
  });

  describe("syncToFirestore", () => {
    it("should sync loan data to Firestore", async () => {
      const mockLoans = [
        {
          id: "1",
          employeeId: "emp1",
          date: new Date("2024-01-01"),
          amount: 10000,
          type: "Personal" as const,
          status: "Approved" as const,
          interestRate: 0.05,
          term: 12,
          monthlyPayment: 1000,
          remainingBalance: 10000,
          nextPaymentDate: new Date("2024-02-01"),
          reason: "Test loan",
        },
      ];

      mockLoanModel.loadLoans.mockResolvedValue(mockLoans);
      const progressCallback = jest.fn();

      await loanFirestore.syncToFirestore(progressCallback);

      expect(mockLoanModel.loadLoans).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalled();
      expect(saveDocument).toHaveBeenCalled();
    });

    it("should handle errors during sync", async () => {
      mockLoanModel.loadLoans.mockRejectedValue(new Error("Test error"));
      const progressCallback = jest.fn();

      await expect(
        loanFirestore.syncToFirestore(progressCallback)
      ).rejects.toThrow("Test error");
    });
  });

  describe("syncFromFirestore", () => {
    it("should sync loan data from Firestore", async () => {
      const mockFirestoreData = [
        {
          meta: {
            employeeId: "emp1",
            year: 2024,
            month: 1,
            lastModified: "2024-01-01T00:00:00.000Z",
          },
          loans: {
            "1": {
              employeeId: "emp1",
              date: "2024-01-01T00:00:00.000Z",
              amount: 10000,
              type: "Personal",
              status: "Approved",
              interestRate: 0.05,
              term: 12,
              monthlyPayment: 1000,
              remainingBalance: 10000,
              nextPaymentDate: "2024-02-01T00:00:00.000Z",
              reason: "Test loan",
            },
            "2": {
              employeeId: "emp1",
              date: "2024-01-15T00:00:00.000Z",
              amount: 5000,
              type: "Emergency",
              status: "Approved",
              interestRate: 0.03,
              term: 6,
              monthlyPayment: 900,
              remainingBalance: 5000,
              nextPaymentDate: "2024-02-15T00:00:00.000Z",
              reason: "Test emergency loan",
            },
          },
        },
      ];

      (queryCollection as jest.Mock).mockResolvedValue(mockFirestoreData);
      const progressCallback = jest.fn();

      await loanFirestore.syncFromFirestore(progressCallback);

      expect(mockLoanModel.createLoan).toHaveBeenCalledTimes(2);
      expect(progressCallback).toHaveBeenCalled();
    });

    it("should handle errors during sync from Firestore", async () => {
      (queryCollection as jest.Mock).mockRejectedValue(new Error("Test error"));
      const progressCallback = jest.fn();

      await expect(
        loanFirestore.syncFromFirestore(progressCallback)
      ).rejects.toThrow("Failed to sync loans from Firestore");
    });
  });
});

describe("MissingTime Firestore Sync", () => {
  let mockMissingTimeModel: jest.Mocked<MissingTimeModel>;
  let missingTimeFirestore: ReturnType<
    typeof createMissingTimeFirestoreInstance
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMissingTimeModel = {
      getMissingTimeLogs: jest.fn(),
      saveMissingTimeLog: jest.fn(),
    } as unknown as jest.Mocked<MissingTimeModel>;

    missingTimeFirestore =
      createMissingTimeFirestoreInstance(mockMissingTimeModel);
  });

  describe("syncToFirestore", () => {
    it("should sync missing time data to Firestore", async () => {
      const mockMissingTimeLogs: MissingTimeLog[] = [
        {
          id: "1",
          employeeId: "emp1",
          employeeName: "John Doe",
          employmentType: "Regular",
          day: "1",
          month: 1,
          year: 2024,
          missingType: "timeIn",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "2",
          employeeId: "emp1",
          employeeName: "John Doe",
          employmentType: "Regular",
          day: "2",
          month: 1,
          year: 2024,
          missingType: "timeOut",
          createdAt: "2024-01-02T00:00:00.000Z",
        },
      ];

      mockMissingTimeModel.getMissingTimeLogs.mockResolvedValue(
        mockMissingTimeLogs
      );
      const progressCallback = jest.fn();

      await missingTimeFirestore.syncToFirestore(progressCallback);

      expect(mockMissingTimeModel.getMissingTimeLogs).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalled();
      expect(saveDocument).toHaveBeenCalled();
    });

    it("should handle errors during sync", async () => {
      mockMissingTimeModel.getMissingTimeLogs.mockRejectedValue(
        new Error("Test error")
      );
      const progressCallback = jest.fn();

      await expect(
        missingTimeFirestore.syncToFirestore(progressCallback)
      ).rejects.toThrow("Test error");
    });
  });

  describe("syncFromFirestore", () => {
    it("should sync missing time data from Firestore", async () => {
      const mockFirestoreData = [
        {
          meta: {
            month: 1,
            year: 2024,
            lastModified: "2024-01-01T00:00:00.000Z",
          },
          logs: [
            {
              id: "1",
              employeeId: "emp1",
              employeeName: "John Doe",
              employmentType: "Regular",
              day: "1",
              month: 1,
              year: 2024,
              missingType: "timeIn",
              createdAt: "2024-01-01T00:00:00.000Z",
            },
            {
              id: "2",
              employeeId: "emp1",
              employeeName: "John Doe",
              employmentType: "Regular",
              day: "2",
              month: 1,
              year: 2024,
              missingType: "timeOut",
              createdAt: "2024-01-02T00:00:00.000Z",
            },
          ],
        },
      ];

      (queryCollection as jest.Mock).mockResolvedValue(mockFirestoreData);
      const progressCallback = jest.fn();

      await missingTimeFirestore.syncFromFirestore(progressCallback);

      expect(mockMissingTimeModel.saveMissingTimeLog).toHaveBeenCalledTimes(2);
      expect(progressCallback).toHaveBeenCalled();
    });

    it("should handle errors during sync from Firestore", async () => {
      (queryCollection as jest.Mock).mockRejectedValue(new Error("Test error"));
      const progressCallback = jest.fn();

      await expect(
        missingTimeFirestore.syncFromFirestore(progressCallback)
      ).rejects.toThrow("Failed to sync missing time from Firestore");
    });
  });
});

describe("Cash Advance Firestore Sync", () => {
  let mockCashAdvanceModel: jest.Mocked<CashAdvanceModel>;
  let cashAdvanceFirestore: ReturnType<
    typeof createCashAdvanceFirestoreInstance
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCashAdvanceModel = {
      loadCashAdvances: jest.fn(),
      createCashAdvance: jest.fn(),
    } as unknown as jest.Mocked<CashAdvanceModel>;

    cashAdvanceFirestore =
      createCashAdvanceFirestoreInstance(mockCashAdvanceModel);
  });

  describe("syncToFirestore", () => {
    it("should sync cash advance data to Firestore", async () => {
      const mockCashAdvances: CashAdvance[] = [
        {
          id: "1",
          employeeId: "emp1",
          date: new Date("2024-01-01"),
          amount: 5000,
          remainingUnpaid: 5000,
          reason: "Test advance",
          approvalStatus: "Approved",
          status: "Unpaid",
          paymentSchedule: "One-time",
        },
        {
          id: "2",
          employeeId: "emp1",
          date: new Date("2024-01-15"),
          amount: 10000,
          remainingUnpaid: 10000,
          reason: "Test installment advance",
          approvalStatus: "Approved",
          status: "Unpaid",
          paymentSchedule: "Installment",
          installmentDetails: {
            numberOfPayments: 3,
            amountPerPayment: 3333.33,
            remainingPayments: 3,
          },
        },
      ];

      mockCashAdvanceModel.loadCashAdvances.mockResolvedValue(mockCashAdvances);
      const progressCallback = jest.fn();

      await cashAdvanceFirestore.syncToFirestore(progressCallback);

      expect(mockCashAdvanceModel.loadCashAdvances).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalled();
      expect(saveDocument).toHaveBeenCalled();
    });

    it("should handle errors during sync", async () => {
      mockCashAdvanceModel.loadCashAdvances.mockRejectedValue(
        new Error("Test error")
      );
      const progressCallback = jest.fn();

      await expect(
        cashAdvanceFirestore.syncToFirestore(progressCallback)
      ).rejects.toThrow("Test error");
    });
  });

  describe("syncFromFirestore", () => {
    it("should sync cash advance data from Firestore", async () => {
      const mockFirestoreData = [
        {
          meta: {
            employeeId: "emp1",
            year: 2024,
            month: 1,
            lastModified: "2024-01-01T00:00:00.000Z",
          },
          advances: {
            "1": {
              employeeId: "emp1",
              date: "2024-01-01T00:00:00.000Z",
              amount: 5000,
              remainingUnpaid: 5000,
              reason: "Test advance",
              approvalStatus: "Approved",
              status: "Unpaid",
              paymentSchedule: "One-time",
            },
            "2": {
              employeeId: "emp1",
              date: "2024-01-15T00:00:00.000Z",
              amount: 10000,
              remainingUnpaid: 10000,
              reason: "Test installment advance",
              approvalStatus: "Approved",
              status: "Unpaid",
              paymentSchedule: "Installment",
              installmentDetails: {
                numberOfPayments: 3,
                amountPerPayment: 3333.33,
                remainingPayments: 3,
              },
            },
          },
        },
      ];

      (queryCollection as jest.Mock).mockResolvedValue(mockFirestoreData);
      const progressCallback = jest.fn();

      await cashAdvanceFirestore.syncFromFirestore(progressCallback);

      expect(mockCashAdvanceModel.createCashAdvance).toHaveBeenCalledTimes(2);
      expect(progressCallback).toHaveBeenCalled();
    });

    it("should handle errors during sync from Firestore", async () => {
      (queryCollection as jest.Mock).mockRejectedValue(new Error("Test error"));
      const progressCallback = jest.fn();

      await expect(
        cashAdvanceFirestore.syncFromFirestore(progressCallback)
      ).rejects.toThrow("Failed to sync cash advances from Firestore");
    });
  });
});

describe("Payroll Firestore Sync", () => {
  let mockPayroll: jest.Mocked<Payroll>;
  let payrollFirestore: ReturnType<typeof createPayrollFirestoreInstance>;
  const mockDbPath = "/test/db/path";

  beforeEach(() => {
    jest.clearAllMocks();
    console.log("Setting up Payroll Firestore Sync tests...");

    mockPayroll = {
      summarizeCompensations: jest.fn(),
      generatePayrollSummary: jest.fn(),
      dbPath: mockDbPath,
    } as unknown as jest.Mocked<Payroll>;

    payrollFirestore = createPayrollFirestoreInstance(mockPayroll, mockDbPath);
    console.log("Payroll Firestore instance created with mock:", mockPayroll);
  });

  describe("syncToFirestore", () => {
    it("should sync payroll data to Firestore", async () => {
      console.log("Starting syncToFirestore test...");

      const mockPayrollSummary: PayrollSummaryModel = {
        id: "1",
        employeeId: "emp1",
        employeeName: "John Doe",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-15"),
        grossPay: 15000,
        netPay: 12000,
        deductions: {
          sss: 1000,
          philHealth: 1000,
          pagIbig: 1000,
          cashAdvanceDeductions: 1000,
          shortDeductions: 500,
          others: 0,
        },
        paymentDate: "2024-01-16",
        dailyRate: 1000,
        basicPay: 10000,
        overtime: 2000,
        allowances: 0,
        daysWorked: 10,
        absences: 0,
      };

      console.log("Mock payroll summary created:", mockPayrollSummary);

      mockPayroll.generatePayrollSummary.mockResolvedValue(mockPayrollSummary);
      console.log("Mock generatePayrollSummary set up");

      const progressCallback = jest.fn();
      console.log("Progress callback created");

      await payrollFirestore.syncToFirestore(progressCallback);
      console.log("syncToFirestore completed");

      expect(mockPayroll.generatePayrollSummary).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Date),
        expect.any(Date),
        expect.any(Object)
      );
      expect(progressCallback).toHaveBeenCalled();
      expect(saveDocument).toHaveBeenCalled();
    });

    it("should handle errors during sync", async () => {
      console.log("Starting error handling test for syncToFirestore...");

      mockPayroll.generatePayrollSummary.mockRejectedValue(
        new Error("Test error")
      );
      console.log("Mock error set up");

      const progressCallback = jest.fn();
      console.log("Progress callback created");

      try {
        await payrollFirestore.syncToFirestore(progressCallback);
        console.log("syncToFirestore completed without error (unexpected)");
      } catch (error) {
        console.log("Caught expected error:", error);
        throw error;
      }
    });
  });

  describe("syncFromFirestore", () => {
    it("should sync payroll data from Firestore", async () => {
      console.log("Starting syncFromFirestore test...");

      const mockFirestoreData = [
        {
          meta: {
            employeeId: "emp1",
            year: 2024,
            month: 1,
            lastModified: "2024-01-01T00:00:00.000Z",
          },
          payrolls: [
            {
              id: "1",
              employeeId: "emp1",
              employeeName: "John Doe",
              startDate: new Date("2024-01-01"),
              endDate: new Date("2024-01-15"),
              grossPay: 15000,
              netPay: 12000,
              deductions: {
                sss: 1000,
                philHealth: 1000,
                pagIbig: 1000,
                cashAdvanceDeductions: 1000,
                shortDeductions: 500,
                others: 0,
              },
              paymentDate: "2024-01-16",
              dailyRate: 1000,
              basicPay: 10000,
              overtime: 2000,
              allowances: 0,
              daysWorked: 10,
              absences: 0,
            },
          ],
        },
      ];

      console.log("Mock Firestore data created:", mockFirestoreData);

      (queryCollection as jest.Mock).mockResolvedValue(mockFirestoreData);
      console.log("Mock queryCollection set up");

      const progressCallback = jest.fn();
      console.log("Progress callback created");

      await payrollFirestore.syncFromFirestore(progressCallback);
      console.log("syncFromFirestore completed");

      expect(progressCallback).toHaveBeenCalled();
      expect(saveDocument).toHaveBeenCalled();
    });

    it("should handle errors during sync from Firestore", async () => {
      console.log("Starting error handling test for syncFromFirestore...");

      (queryCollection as jest.Mock).mockRejectedValue(new Error("Test error"));
      console.log("Mock error set up");

      const progressCallback = jest.fn();
      console.log("Progress callback created");

      try {
        await payrollFirestore.syncFromFirestore(progressCallback);
        console.log("syncFromFirestore completed without error (unexpected)");
      } catch (error) {
        console.log("Caught expected error:", error);
        throw error;
      }
    });
  });

  describe("Payroll Statistics", () => {
    it("should update payroll statistics when syncing to Firestore", async () => {
      console.log("Starting payroll statistics test...");

      const mockPayrollSummary: PayrollSummaryModel = {
        id: "1",
        employeeId: "emp1",
        employeeName: "John Doe",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-15"),
        grossPay: 15000,
        netPay: 12000,
        deductions: {
          sss: 1000,
          philHealth: 1000,
          pagIbig: 1000,
          cashAdvanceDeductions: 1000,
          shortDeductions: 500,
          others: 0,
        },
        paymentDate: "2024-01-16",
        dailyRate: 1000,
        basicPay: 10000,
        overtime: 2000,
        allowances: 0,
        daysWorked: 10,
        absences: 0,
      };

      console.log("Mock payroll summary created:", mockPayrollSummary);

      mockPayroll.generatePayrollSummary.mockResolvedValue(mockPayrollSummary);
      console.log("Mock generatePayrollSummary set up");

      const progressCallback = jest.fn();
      console.log("Progress callback created");

      await payrollFirestore.syncToFirestore(progressCallback);
      console.log("syncToFirestore completed");

      expect(saveDocument).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("statistics_2024"),
        expect.objectContaining({
          meta: expect.objectContaining({
            year: 2024,
            lastModified: expect.any(String),
          }),
          monthlyTotals: expect.objectContaining({
            "1": expect.objectContaining({
              totalGrossPay: 15000,
              totalNetPay: 12000,
              totalEmployees: 1,
              employeeIds: ["emp1"],
            }),
          }),
          employeeStats: expect.objectContaining({
            emp1: expect.objectContaining({
              totalGrossPay: 15000,
              totalNetPay: 12000,
              payrollCount: 1,
              lastPayrollDate: expect.any(String),
            }),
          }),
          totals: expect.objectContaining({
            grossPay: 15000,
            netPay: 12000,
            employeeCount: 1,
          }),
        }),
        expect.any(String)
      );
    });

    it("should handle multiple payroll summaries in the same month", async () => {
      console.log("Starting multiple payroll summaries test...");

      const mockPayrollSummaries: PayrollSummaryModel[] = [
        {
          id: "1",
          employeeId: "emp1",
          employeeName: "John Doe",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-15"),
          grossPay: 15000,
          netPay: 12000,
          deductions: {
            sss: 1000,
            philHealth: 1000,
            pagIbig: 1000,
            cashAdvanceDeductions: 1000,
            shortDeductions: 500,
            others: 0,
          },
          paymentDate: "2024-01-16",
          dailyRate: 1000,
          basicPay: 10000,
          overtime: 2000,
          allowances: 0,
          daysWorked: 10,
          absences: 0,
        },
        {
          id: "2",
          employeeId: "emp2",
          employeeName: "Jane Smith",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-15"),
          grossPay: 20000,
          netPay: 16000,
          deductions: {
            sss: 2000,
            philHealth: 1000,
            pagIbig: 1000,
            cashAdvanceDeductions: 0,
            shortDeductions: 0,
            others: 0,
          },
          paymentDate: "2024-01-16",
          dailyRate: 1500,
          basicPay: 15000,
          overtime: 3000,
          allowances: 2000,
          daysWorked: 10,
          absences: 0,
        },
      ];

      console.log("Mock payroll summaries created:", mockPayrollSummaries);

      mockPayroll.generatePayrollSummary
        .mockResolvedValueOnce(mockPayrollSummaries[0])
        .mockResolvedValueOnce(mockPayrollSummaries[1]);
      console.log("Mock generatePayrollSummary set up");

      const progressCallback = jest.fn();
      console.log("Progress callback created");

      await payrollFirestore.syncToFirestore(progressCallback);
      console.log("syncToFirestore completed");

      expect(saveDocument).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("statistics_2024"),
        expect.objectContaining({
          meta: expect.objectContaining({
            year: 2024,
            lastModified: expect.any(String),
          }),
          monthlyTotals: expect.objectContaining({
            "1": expect.objectContaining({
              totalGrossPay: 35000,
              totalNetPay: 28000,
              totalEmployees: 2,
              employeeIds: expect.arrayContaining(["emp1", "emp2"]),
            }),
          }),
          employeeStats: expect.objectContaining({
            emp1: expect.objectContaining({
              totalGrossPay: 15000,
              totalNetPay: 12000,
              payrollCount: 1,
              lastPayrollDate: expect.any(String),
            }),
            emp2: expect.objectContaining({
              totalGrossPay: 20000,
              totalNetPay: 16000,
              payrollCount: 1,
              lastPayrollDate: expect.any(String),
            }),
          }),
          totals: expect.objectContaining({
            grossPay: 35000,
            netPay: 28000,
            employeeCount: 2,
          }),
        }),
        expect.any(String)
      );
    });

    it("should handle invalid payroll summary data", async () => {
      console.log("Starting invalid data test...");

      const invalidPayrollSummary = {
        id: "1",
        employeeId: "emp1",
        // Missing required fields
      } as PayrollSummaryModel;

      console.log("Invalid payroll summary created:", invalidPayrollSummary);

      mockPayroll.generatePayrollSummary.mockResolvedValue(
        invalidPayrollSummary
      );
      console.log("Mock generatePayrollSummary set up");

      const progressCallback = jest.fn();
      console.log("Progress callback created");

      await payrollFirestore.syncToFirestore(progressCallback);
      console.log("syncToFirestore completed");

      // Should not update statistics with invalid data
      expect(saveDocument).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("statistics_"),
        expect.any(Object),
        expect.any(String)
      );
    });
  });
});
