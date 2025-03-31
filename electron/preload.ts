generatePayrollPDF: (options: any) =>
  ipcRenderer.invoke("generate-payroll-pdf", options),
generatePayrollPDFLandscape: (options: any) =>
  ipcRenderer.invoke("generate-payroll-pdf-landscape", options), 