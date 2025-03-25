import React, { useEffect, useState, useRef } from "react";
import Head from "next/head";
import EmployeeList from "@/renderer/components/EmployeeList";
import { ExcelUpload } from "@/renderer/components/ExcelUpload";
import HolidayCalendar from "@/renderer/components/HolidayCalendar";
import MissingTimeLogs from "@/renderer/components/MissingTimeLogs";
import EditEmployee from "@/renderer/components/EditEmployee";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { motion } from "framer-motion";
import RootLayout from "@/renderer/components/layout";
import { useSettingsStore } from "../stores/settingsStore";

export default function HomePage() {
  const { selectedEmployeeId } = useEmployeeStore();
  const { dbPath } = useSettingsStore();
  const [showMissingTimeLogs, setShowMissingTimeLogs] = useState(true);
  const [editEmployeeHeight, setEditEmployeeHeight] = useState<string>("");
  const editEmployeeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedEmployeeId && editEmployeeRef.current) {
      const height = editEmployeeRef.current.offsetHeight;
      const adjustedHeight = height - 64;
      setEditEmployeeHeight(`${adjustedHeight}px`);
    } else {
      setEditEmployeeHeight("");
    }
  }, [selectedEmployeeId]);

  return (
    <RootLayout>
      <Head>
        <title>Sweldo - Employee Management</title>
      </Head>
      <div className="px-4 py-12 sm:px-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="col-span-1 md:col-span-3">
            <EmployeeList height={editEmployeeHeight} />
          </div>
          {selectedEmployeeId && (
            <motion.div
              className="col-span-1"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div ref={editEmployeeRef} className="col-span-1">
                <EditEmployee />
              </div>
            </motion.div>
          )}
          <div
            className={`${
              selectedEmployeeId ? "col-span-1 md:col-span-2" : "col-span-1"
            }`}
          >
            <ExcelUpload />
          </div>
          <div
            className={`${
              selectedEmployeeId ? "col-span-1 md:col-span-2" : "col-span-2"
            }`}
          >
            <HolidayCalendar />
          </div>
          {showMissingTimeLogs && (
            <div
              className={`${
                selectedEmployeeId ? "col-span-4 md:col-span-4" : "col-span-2"
              }`}
            >
              <MissingTimeLogs />
            </div>
          )}
        </div>
      </div>
    </RootLayout>
  );
}
