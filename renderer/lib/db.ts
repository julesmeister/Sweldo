import Dexie from "dexie";
import { Employee } from "@/renderer/model/employee";
import { Holiday } from "@/renderer/model/holiday";
import { MissingTimeLog } from "@/renderer/model/missingTime";

interface EmployeeCacheRecord {
  companyName: string;
  id: string;
  timestamp: number;
  data: Employee;
}

interface HolidayCacheRecord {
  companyName: string;
  year: number;
  month: number;
  id: string;
  timestamp: number;
  data: Holiday;
}

interface MissingTimeCacheRecord {
  companyName: string;
  year: number;
  month: number;
  id: string;
  timestamp: number;
  data: MissingTimeLog;
}

class AppDB extends Dexie {
  public employees!: Dexie.Table<EmployeeCacheRecord, [string, string]>;
  public holidays!: Dexie.Table<
    HolidayCacheRecord,
    [string, number, number, string]
  >;
  public missingTimeLogs!: Dexie.Table<
    MissingTimeCacheRecord,
    [string, number, number, string]
  >;

  constructor() {
    super("SweldoCacheDB");
    this.version(1).stores({
      employees: "&[companyName+id], companyName, id, timestamp",
      holidays:
        "&[companyName+year+month+id], companyName, year, month, id, timestamp",
      missingTimeLogs:
        "&[companyName+year+month+id], companyName, year, month, id, timestamp",
    });
  }
}

export const db = new AppDB();

/**
 * Clears the cached employees for a given company.
 */
export async function clearEmployeeCache(companyName: string): Promise<void> {
  await db.employees.where("companyName").equals(companyName).delete();
}

/**
 * Clears the cached holidays for a given company, year, and month.
 */
export async function clearHolidayCache(
  companyName: string,
  year: number,
  month: number
): Promise<void> {
  await db.holidays
    .where("[companyName+year+month]")
    .equals([companyName, year, month])
    .delete();
}

/**
 * Clears the cached missing time logs for a given company, year, and month.
 */
export async function clearMissingTimeLogCache(
  companyName: string,
  year: number,
  month: number
): Promise<void> {
  await db.missingTimeLogs
    .where("[companyName+year+month]")
    .equals([companyName, year, month])
    .delete();
}
