import { jest } from "@jest/globals";
import { toast } from "sonner";
import { createPayrollFirestoreInstance } from "../model/payroll_firestore";
import { createEmployeeModel } from "../model/employee";
import { Payroll, PayrollSummaryModel } from "../model/payroll";
import {
  fetchDocument,
  saveDocument,
  isWebEnvironment,
  getCompanyName,
} from "../lib/firestoreService";
import { Employee } from "../model/employee";
import { useSettingsStore } from "../stores/settingsStore";

// Mock dependencies first
jest.mock("../lib/firestoreService", () => ({
  fetchDocument: jest.fn(),
  saveDocument: jest.fn(),
  getCompanyName: jest
    .fn()
    .mockImplementation(() => Promise.resolve("Test Company")),
  isWebEnvironment: jest.fn().mockReturnValue(true),
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

// Mock settings store
jest.mock("../stores/settingsStore", () => ({
  useSettingsStore: {
    getState: () => ({
      dbPath: "test/path",
      companyName: "Test Company",
    }),
  },
}));

// Mock employee model
jest.mock("../model/employee", () => ({
  createEmployeeModel: jest.fn().mockImplementation(() => ({
    loadEmployees: jest.fn().mockImplementation(() =>
      Promise.resolve([
        {
          id: "emp1",
          name: "Test Employee",
          sss: 100,
          philHealth: 200,
          pagIbig: 100,
          status: "active",
        } as Employee,
      ])
    ),
  })),
}));

describe("Payroll Sync Tests", () => {
  // Create mock instances with proper types
  const mockGeneratePayrollSummary =
    jest.fn<
      (
        employeeId: string,
        startDate: Date,
        endDate: Date,
        deductions: any
      ) => Promise<PayrollSummaryModel>
    >();
  const mockLoadPayrollSummaries =
    jest.fn<
      (
        dbPath: string,
        employeeId: string,
        year: number,
        month: number
      ) => Promise<PayrollSummaryModel[]>
    >();

  const mockPayrollModel = {
    generatePayrollSummary: mockGeneratePayrollSummary,
  } as unknown as Payroll;

  // Mock static method with proper types
  jest
    .spyOn(Payroll, "loadPayrollSummaries")
    .mockImplementation(
      (
        dbPath: string,
        employeeId: string,
        year: number,
        month: number
      ): Promise<PayrollSummaryModel[]> =>
        mockLoadPayrollSummaries(dbPath, employeeId, year, month)
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockGeneratePayrollSummary.mockReset();
    mockLoadPayrollSummaries.mockReset();
    (createEmployeeModel as jest.Mock).mockClear();
  });

  it("should handle payroll sync to Firestore with no existing summaries", async () => {
    // Mock payroll summary generation
    const mockSummary: PayrollSummaryModel = {
      id: "summary1",
      employeeId: "emp1",
      employeeName: "Test Employee",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
      grossPay: 15000,
      netPay: 12000,
      deductions: {
        sss: 100,
        philHealth: 200,
        pagIbig: 100,
        cashAdvanceDeductions: 0,
        shortDeductions: 0,
        others: 0,
      },
    } as PayrollSummaryModel;

    mockLoadPayrollSummaries.mockResolvedValue([]);
    mockGeneratePayrollSummary.mockResolvedValue(mockSummary);

    const payrollFirestore = createPayrollFirestoreInstance(
      mockPayrollModel,
      "test/path"
    );
    const progressCallback = jest.fn();

    await payrollFirestore.syncToFirestore(progressCallback);

    // Verify employee loading
    expect(createEmployeeModel).toHaveBeenCalledWith("test/path");
    const employeeModel = createEmployeeModel("test/path");
    expect(employeeModel.loadEmployees).toHaveBeenCalled();

    // Verify payroll summary generation
    expect(mockGeneratePayrollSummary).toHaveBeenCalledWith(
      "emp1",
      expect.any(Date),
      expect.any(Date),
      expect.objectContaining({
        sss: 100,
        philHealth: 200,
        pagIbig: 100,
      })
    );

    // Verify Firestore save
    expect(saveDocument).toHaveBeenCalledWith(
      "payrolls",
      expect.stringContaining("payroll_emp1_2024_1"),
      expect.objectContaining({
        payrolls: [mockSummary],
      }),
      "Test Company"
    );

    // Verify progress reporting
    expect(progressCallback).toHaveBeenCalledWith(
      expect.stringContaining("Starting payroll sync")
    );
    expect(progressCallback).toHaveBeenCalledWith(
      expect.stringContaining("Found 1 employees")
    );
    expect(progressCallback).toHaveBeenCalledWith(
      expect.stringContaining("Processing payroll for employee")
    );
  });

  it("should handle payroll sync to Firestore with existing summaries", async () => {
    // Mock existing payroll summaries
    const mockSummaries: PayrollSummaryModel[] = [
      {
        id: "summary1",
        employeeId: "emp1",
        employeeName: "Test Employee",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        grossPay: 15000,
        netPay: 12000,
        deductions: {
          sss: 100,
          philHealth: 200,
          pagIbig: 100,
          cashAdvanceDeductions: 0,
          shortDeductions: 0,
          others: 0,
        },
      } as PayrollSummaryModel,
    ];

    mockLoadPayrollSummaries.mockResolvedValue(mockSummaries);

    const payrollFirestore = createPayrollFirestoreInstance(
      mockPayrollModel,
      "test/path"
    );
    const progressCallback = jest.fn();

    await payrollFirestore.syncToFirestore(progressCallback);

    // Verify employee loading
    expect(createEmployeeModel).toHaveBeenCalledWith("test/path");
    const employeeModel = createEmployeeModel("test/path");
    expect(employeeModel.loadEmployees).toHaveBeenCalled();

    // Verify existing summaries are saved
    expect(saveDocument).toHaveBeenCalledWith(
      "payrolls",
      expect.stringContaining("payroll_emp1_2024_1"),
      expect.objectContaining({
        payrolls: mockSummaries,
      }),
      "Test Company"
    );
  });

  it("should handle payroll sync from Firestore", async () => {
    // Mock Firestore data
    const mockFirestoreData = {
      payrolls: [
        {
          id: "summary1",
          employeeId: "emp1",
          employeeName: "Test Employee",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31"),
          grossPay: 15000,
          netPay: 12000,
          deductions: {
            sss: 100,
            philHealth: 200,
            pagIbig: 100,
            cashAdvanceDeductions: 0,
            shortDeductions: 0,
            others: 0,
          },
        } as PayrollSummaryModel,
      ],
    };

    // Mock generated summary
    const mockGeneratedSummary: PayrollSummaryModel = {
      ...mockFirestoreData.payrolls[0],
      id: "generated1",
    };

    mockLoadPayrollSummaries.mockResolvedValue([mockGeneratedSummary]);
    (fetchDocument as jest.Mock).mockImplementation(() =>
      Promise.resolve(mockFirestoreData)
    );

    const payrollFirestore = createPayrollFirestoreInstance(
      mockPayrollModel,
      "test/path"
    );
    const progressCallback = jest.fn();

    await payrollFirestore.syncFromFirestore(progressCallback);

    // Verify employee loading
    expect(createEmployeeModel).toHaveBeenCalledWith("test/path");
    const employeeModel = createEmployeeModel("test/path");
    expect(employeeModel.loadEmployees).toHaveBeenCalled();

    // Verify summary generation
    expect(mockGeneratePayrollSummary).toHaveBeenCalledWith(
      "emp1",
      expect.any(Date),
      expect.any(Date),
      expect.objectContaining({
        sss: 100,
        philHealth: 200,
        pagIbig: 100,
      })
    );

    // Verify Firestore save
    expect(saveDocument).toHaveBeenCalledWith(
      "payrolls",
      expect.stringContaining("payroll_emp1_2024_1"),
      expect.objectContaining({
        payrolls: [mockGeneratedSummary],
      }),
      "Test Company"
    );
  });

  it("should handle statistics updates during sync", async () => {
    // Mock payroll summary
    const mockSummary: PayrollSummaryModel = {
      id: "summary1",
      employeeId: "emp1",
      employeeName: "Test Employee",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
      grossPay: 15000,
      netPay: 12000,
      deductions: {
        sss: 100,
        philHealth: 200,
        pagIbig: 100,
        cashAdvanceDeductions: 0,
        shortDeductions: 0,
        others: 0,
      },
    } as PayrollSummaryModel;

    mockLoadPayrollSummaries.mockResolvedValue([mockSummary]);

    const payrollFirestore = createPayrollFirestoreInstance(
      mockPayrollModel,
      "test/path"
    );
    const progressCallback = jest.fn();

    await payrollFirestore.syncToFirestore(progressCallback);

    // Verify statistics update
    expect(saveDocument).toHaveBeenCalledWith(
      "statistics",
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
      "Test Company"
    );
  });
});
