import { generatePayrollPDF } from "../main/services/pdfGenerator";
import { generatePayrollPDFLandscape } from "../main/services/pdfGeneratorLandscape";

ipcMain.handle("generate-payroll-pdf", async (_, options) => {
  return generatePayrollPDF(options.payrolls, options);
});

ipcMain.handle("generate-payroll-pdf-landscape", async (_, options) => {
  return generatePayrollPDFLandscape(options.payrolls, options);
});
