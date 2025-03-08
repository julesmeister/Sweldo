import fs from 'fs';
import path from 'path';

export interface Loan {
  id: string;
  employeeId: string;
  date: Date;
  amount: number;
  type: 'Personal' | 'Housing' | 'Emergency' | 'Other';
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  interestRate: number;
  term: number; // in months
  monthlyPayment: number;
  remainingBalance: number;
  nextPaymentDate: Date;
  reason: string;
}

export class LoanModel {
  private basePath: string;
  private employeeId: string;

  constructor(dbPath: string, employeeId: string) {
    this.basePath = path.join(dbPath, 'SweldoDB/loans', employeeId);
    this.employeeId = employeeId;
  }

  private getFilePath(loan: Loan): string {
    return `${this.basePath}/${loan.date.getFullYear()}_${loan.date.getMonth() + 1}_loans.csv`;
  }

  private getFilePathByMonth(year: number, month: number): string {
    return `${this.basePath}/${year}_${month}_loans.csv`;
  }

  async createLoan(loan: Loan): Promise<void> {
    try {
      const filePath = this.getFilePath(loan);
      console.log(`[LoanModel] Attempting to save loan to:`, filePath);
      console.log(`[LoanModel] Loan data to save:`, loan);

      const formatLoanToCSV = (l: Loan) => {
        return `${l.id},${l.employeeId},${l.date.toISOString()},${l.amount},${l.type},${l.status},${l.interestRate},${l.term},${l.monthlyPayment},${l.remainingBalance},${l.nextPaymentDate.toISOString()},${l.reason}`;
      };

      try {
        const data = await window.electron.readFile(filePath);
        console.log(`[LoanModel] Existing file found, updating content`);
        const lines = data.split('\n').filter(line => line.trim().length > 0);
        lines.push(formatLoanToCSV(loan));
        await window.electron.saveFile(filePath, lines.join('\n') + '\n');
        console.log(`[LoanModel] Successfully saved loan`);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.log(`[LoanModel] Creating new file for loan entry`);
          const csvData = formatLoanToCSV(loan) + '\n';
          await window.electron.saveFile(filePath, csvData);
          console.log(`[LoanModel] Successfully created new file and saved loan`);
        } else {
          console.error('[LoanModel] Error saving loan:', error);
          throw error;
        }
      }
    } catch (error) {
      console.error('[LoanModel] Error in createLoan:', error);
      throw error;
    }
  }

  async updateLoan(loan: Loan): Promise<void> {
    try {
      const filePath = this.getFilePath(loan);
      console.log(`[LoanModel] Attempting to update loan in:`, filePath);

      const formatLoanToCSV = (l: Loan) => {
        return `${l.id},${l.employeeId},${l.date.toISOString()},${l.amount},${l.type},${l.status},${l.interestRate},${l.term},${l.monthlyPayment},${l.remainingBalance},${l.nextPaymentDate.toISOString()},${l.reason}`;
      };

      const data = await window.electron.readFile(filePath);
      const lines = data.split('\n').filter(line => line.trim().length > 0);
      const updatedLines = lines.map(line => {
        const fields = line.split(',');
        if (fields[0] === loan.id) {
          return formatLoanToCSV(loan);
        }
        return line;
      });
      await window.electron.saveFile(filePath, updatedLines.join('\n') + '\n');
      console.log(`[LoanModel] Successfully updated loan`);
    } catch (error) {
      console.error('[LoanModel] Error updating loan:', error);
      throw error;
    }
  }

  async loadLoans(year: number, month: number): Promise<Loan[]> {
    try {
      const filePath = this.getFilePathByMonth(year, month);
      console.log(`[LoanModel] Loading loans from:`, filePath);

      try {
        const data = await window.electron.readFile(filePath);
        const lines = data.split('\n').filter(line => line.trim().length > 0);

        return lines.map(line => {
          const fields = line.split(',');
          
          // Parse the dates from ISO format
          const date = new Date(fields[2]);
          const nextPaymentDate = new Date(fields[10]);

          // Validate loan type
          let loanType = fields[4] as Loan['type'];
          if (!['Personal', 'Housing', 'Emergency', 'Other'].includes(loanType)) {
            console.warn(`[LoanModel] Invalid loan type "${loanType}" found, defaulting to "Other"`);
            loanType = 'Other';
          }

          return {
            id: fields[0],
            employeeId: fields[1],
            date,
            amount: parseFloat(fields[3]),
            type: loanType,
            status: fields[5] as Loan['status'],
            interestRate: parseFloat(fields[6]),
            term: parseInt(fields[7]),
            monthlyPayment: parseFloat(fields[8]),
            remainingBalance: parseFloat(fields[9]),
            nextPaymentDate,
            reason: fields[11]
          };
        });
      } catch (error: any) {
        if (error.code === 'ENOENT' || (error instanceof Error && error.message.includes('ENOENT'))) {
          console.log(`[LoanModel] No loans file found for ${year}-${month}, returning empty array`);
          return [];
        }
        throw error;
      }
    } catch (error) {
      console.error('[LoanModel] Error loading loans:', error);
      return [];
    }
  }

  async deleteLoan(id: string, loan: Loan): Promise<void> {
    try {
      const filePath = this.getFilePath(loan);
      console.log(`[LoanModel] Attempting to delete loan from:`, filePath);
      
      const data = await window.electron.readFile(filePath);
      const lines = data.split('\n').filter(line => line.trim().length > 0);
      const updatedLines = lines.filter(line => line.split(',')[0] !== id);
      await window.electron.saveFile(filePath, updatedLines.join('\n') + '\n');
      console.log(`[LoanModel] Successfully deleted loan`);
    } catch (error) {
      console.error('[LoanModel] Error deleting loan:', error);
      throw error;
    }
  }
}

export const createLoanModel = (dbPath: string, employeeId: string): LoanModel => {
  return new LoanModel(dbPath, employeeId);
};
