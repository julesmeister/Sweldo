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

  async createLoan(loan: Loan): Promise<void> {
    const filePath = this.getFilePath(loan);
    const csvData = `${loan.id},${loan.employeeId},${loan.date},${loan.amount},${loan.type},${loan.status},${loan.interestRate},${loan.term},${loan.monthlyPayment},${loan.remainingBalance},${loan.nextPaymentDate},${loan.reason}\n`;
    await window.electron.saveFile(filePath, csvData);
  }

  async updateLoan(loan: Loan): Promise<void> {
    try {
      const filePath = this.getFilePath(loan);
      const data = await window.electron.readFile(filePath);
      const lines = data.split('\n');
      const updatedLines = lines.map(line => {
        const fields = line.split(',');
        if (fields[0] === loan.id) {
          return `${loan.id},${loan.employeeId},${loan.date},${loan.amount},${loan.type},${loan.status},${loan.interestRate},${loan.term},${loan.monthlyPayment},${loan.remainingBalance},${loan.nextPaymentDate},${loan.reason}`;
        }
        return line;
      });
      await window.electron.saveFile(filePath, updatedLines.join('\n'));
    } catch (error) {
      console.error('Error updating loan:', error);
    }
  }

  async loadLoans(employeeId: string): Promise<Loan[]> {
    try {
      const filePath = `${this.basePath}/loans.csv`;
      const data = await window.electron.readFile(filePath);
      const lines = data.split('\n');
      return lines.map(line => {
        const fields = line.split(',');
        return {
          id: fields[0],
          employeeId: fields[1],
          date: new Date(fields[2]),
          amount: parseFloat(fields[3]),
          type: fields[4],
          status: fields[5],
          interestRate: parseFloat(fields[6]),
          term: parseInt(fields[7]),
          monthlyPayment: parseFloat(fields[8]),
          remainingBalance: parseFloat(fields[9]),
          nextPaymentDate: new Date(fields[10]),
          reason: fields[11],
        } as Loan;
      }).filter(loan => loan.employeeId === employeeId);
    } catch (error) {
      console.error('Error loading loans:', error);
      return [];
    }
  }

  async deleteLoan(id: string): Promise<void> {
    try {
      const filePath = `${this.basePath}/loans.csv`;
      const data = await window.electron.readFile(filePath);
      const lines = data.split('\n');
      const updatedLines = lines.filter(line => line.split(',')[0] !== id);
      await window.electron.saveFile(filePath, updatedLines.join('\n'));
    } catch (error) {
      console.error('Error deleting loan:', error);
    }
  }
}

export const createLoanModel = (dbPath: string, employeeId: string): LoanModel => {
  return new LoanModel(dbPath, employeeId);
};
