'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ShineBorder } from '@/renderer/components/magicui/shine-border';
import * as XLSX from 'xlsx-js-style';
import { Payroll } from '@/renderer/model/payroll';
import { useExcelStore } from '@/renderer/stores/excelStore';
import { toast } from 'sonner';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import { MagicCard } from '@/renderer/components/magicui/magic-card';
type SheetRow = (string | number | null)[];

export function ExcelUpload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setExcelData } = useExcelStore();
  const { dbPath } = useSettingsStore();

  const processExcelFile = async (file: File) => {
    try {
      setError(null);
      console.log("Starting to process the file:", file.name);
      
      const buffer = await file.arrayBuffer();
      console.log("File buffer size:", buffer.byteLength);
      
      if (buffer.byteLength > 10 * 1024 * 1024) {
        throw new Error("File size too large. Please upload a file smaller than 10MB.");
      }

      const workbook = XLSX.read(buffer, { 
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
      console.log("Workbook read successfully:", workbook);

      const targetSheet = workbook.SheetNames.find(name => {
        const sheet = workbook.Sheets[name];
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        
        console.log("Checking sheet:", name, "with range:", range);
        
        if (range.e.r > 10000 || range.e.c > 100) {
          throw new Error("Excel file too complex. Please simplify the data.");
        }

        const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { 
          header: 1, 
          range: 0,
          defval: null 
        });

        const firstRow = rows[0] || [];
        const secondRow = rows[1] || [];
        
        console.log("First row:", firstRow);
        console.log("Second row:", secondRow);
        
        return (
          (firstRow[0]?.toString() || '').includes("Attendance Record Report") ||
          (secondRow[0]?.toString() || '').includes("Attendance Record Report")
        );
      });

      if (!targetSheet) {
        throw new Error("No valid attendance record sheet found");
      }

      const sheet = workbook.Sheets[targetSheet];
      const data = XLSX.utils.sheet_to_json<SheetRow>(sheet, { 
        header: 1,
        raw: false,
        dateNF: 'yyyy-mm-dd',
        defval: null
      });

      console.log("Data extracted from sheet:", data);

      const payroll = new Payroll(data, file.name.split('.').pop() || 'xlsx', dbPath);
      const excelData = payroll.getData();
      
      console.log("Extracted payroll data:", excelData);
      setExcelData(excelData);
      
      toast.success("Excel file processed successfully!");

    } catch (error) {
      console.error("Error processing Excel file:", error);
      const message = error instanceof Error ? error.message : "Failed to process Excel file";
      setError(message);
      toast.error("Error processing Excel file: " + message);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    console.log("File dropped:", file.name);
    
    setIsProcessing(true);
    await processExcelFile(file);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsProcessing(false);
  }, [processExcelFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    multiple: false
  });

  return (
    <MagicCard className='p-0.5 rounded-lg' gradientSize={200} gradientColor="#9E7AFF" gradientOpacity={0.8} gradientFrom="#9E7AFF" gradientTo="#FE8BBB">
    <div className="bg-white rounded-lg shadow p-6 relative overflow-hidden">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Upload Timesheet</h2>
        <p className="text-sm text-gray-600">
          Upload your Excel timesheet to process attendance records
        </p>
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}
        
        <div 
          {...getRootProps()}
          className={`
            relative border-2 border-dashed rounded-lg p-8
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            transition-all duration-200
          `}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            {isProcessing ? (
              <div className="flex items-center space-x-3">
                <svg className="animate-spin h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing...</span>
              </div>
            ) : (
              <>
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                <div className="flex flex-col items-center space-y-2">
                  <span className="text-gray-600">Drag and drop your Excel file here</span>
                  <span className="text-sm text-gray-500">or</span>
                  <span className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
                    Browse Files
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
    </MagicCard>
  );
}