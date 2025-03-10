import fs from 'fs';
import path from 'path';

export interface Leave {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  type: 'Sick' | 'Vacation' | 'Emergency' | 'Other';
  status: 'Pending' | 'Approved' | 'Rejected';
  reason: string;
}

export class LeaveModel {
  private basePath: string;
  private employeeId: string;

  constructor(dbPath: string, employeeId: string) {
    this.basePath = path.join(dbPath, 'SweldoDB/leaves', employeeId);
    this.employeeId = employeeId;
  }

  private getFilePath(leave: Leave): string {
    return `${this.basePath}/${leave.startDate.getFullYear()}_${leave.startDate.getMonth() + 1}_leaves.csv`;
  }

  private getFilePathByMonth(year: number, month: number): string {
    return `${this.basePath}/${year}_${month}_leaves.csv`;
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      const employeePath = this.basePath;
      await window.electron.ensureDir(employeePath);
      console.log(`Ensured directory exists: ${employeePath}`);
    } catch (error) {
      console.error(`Failed to ensure directory exists: ${error}`);
      throw error;
    }
  }

  async createLeave(leave: Leave): Promise<void> {
    const filePath = this.getFilePath(leave);
    const csvData = `${leave.id},${leave.employeeId},${leave.startDate},${leave.endDate},${leave.type},${leave.status},${leave.reason}\n`;
    
    // Ensure directory exists before saving
    await this.ensureDirectoryExists();
    
    await window.electron.saveFile(filePath, csvData);
  }

  async saveOrUpdateLeave(leave: Leave): Promise<void> {
    try {
      const filePath = this.getFilePath(leave);
      console.log(`[LeaveModel] Attempting to save/update leave to:`, filePath);
      console.log(`[LeaveModel] Leave data to save:`, leave);

      const formatLeaveToCSV = (l: Leave) => {
        return `${l.id},${l.employeeId},${l.startDate.toISOString()},${l.endDate.toISOString()},${l.type},${l.status},${l.reason}`;
      };

      try {
        // Ensure directory exists before reading/writing
        await this.ensureDirectoryExists();

        const data = await window.electron.readFile(filePath);
        console.log(`[LeaveModel] Existing file found, updating content`);
        const lines = data.split('\n').filter(line => line.trim().length > 0);
        let leaveExists = false;

        const updatedLines = lines.map(line => {
          const fields = line.split(',');
          if (fields[0] === leave.id) {
            leaveExists = true;
            console.log(`[LeaveModel] Updating existing leave entry`);
            return formatLeaveToCSV(leave);
          }
          return line;
        });

        if (!leaveExists) {
          console.log(`[LeaveModel] Adding new leave entry`);
          updatedLines.push(formatLeaveToCSV(leave));
        }

        await window.electron.saveFile(filePath, updatedLines.join('\n') + '\n');
        console.log(`[LeaveModel] Successfully saved/updated leave`);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.log(`[LeaveModel] Creating new file for leave entry`);
          const csvData = formatLeaveToCSV(leave) + '\n';
          await window.electron.saveFile(filePath, csvData);
          console.log(`[LeaveModel] Successfully created new file and saved leave`);
        } else {
          console.error('[LeaveModel] Error saving/updating leave:', error);
          throw error;
        }
      }
    } catch (error) {
      console.error('[LeaveModel] Error in saveOrUpdateLeave:', error);
      throw error;
    }
  }

  async loadLeaves(employeeId: string, year: number, month: number): Promise<Leave[]> {
    try {
      const filePath = this.getFilePath({ startDate: new Date(year, month - 1) } as Leave);
      console.log(`[LeaveModel] Loading leaves from:`, filePath);

      try {
        const data = await window.electron.readFile(filePath);
        const lines = data.split('\n');

        const nonEmptyLines = lines.filter(line => line.trim().length > 0);

        const leaves = nonEmptyLines.map(line => {
          const fields = line.split(',');

          // Parse the dates from ISO format
          const startDate = new Date(fields[2]);
          const endDate = new Date(fields[3]);

          // Validate leave type
          let leaveType = fields[4] as "Sick" | "Vacation" | "Emergency" | "Other";
          if (!["Sick", "Vacation", "Emergency", "Other"].includes(leaveType)) {
            console.warn(`[LeaveModel] Invalid leave type "${leaveType}" found, defaulting to "Other"`);
            leaveType = "Other";
          }

          return {
            id: fields[0],
            employeeId: fields[1],
            startDate,
            endDate,
            type: leaveType,
            status: fields[5],
            reason: fields[6]
          } as Leave;
        });

        // Filter leaves by employeeId
        const filteredLeaves = leaves;

        return filteredLeaves;
      } catch (error: any) {
        if (error.code === 'ENOENT' || (error instanceof Error && error.message.includes('ENOENT'))) {
          console.log(`[LeaveModel] No leaves file found for ${year}-${month}, returning empty array`);
          return [];
        }
        throw error;
      }
    } catch (error) {
      console.error('[LeaveModel] Error loading leaves:', error);
      throw error;
    }
  }

  async deleteLeave(id: string, leave: Leave): Promise<void> {
    try {
      const filePath = this.getFilePath(leave);
      const data = await window.electron.readFile(filePath);
      const lines = data.split('\n');
      const updatedLines = lines.filter(line => line.split(',')[0] !== id);
      await window.electron.saveFile(filePath, updatedLines.join('\n'));
    } catch (error) {
      console.error('Error deleting leave:', error);
    }
  }
}

export const createLeaveModel = (dbPath: string, employeeId: string): LeaveModel => {
  return new LeaveModel(dbPath, employeeId);
};
