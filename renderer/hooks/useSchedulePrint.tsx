import { useCallback } from "react";
import { EmploymentType, DailySchedule } from "../model/settings";

interface UseSchedulePrintProps {
  employmentTypes: EmploymentType[];
  selectedMonth: Date;
  getScheduleForDate: (typeId: string, date: Date) => DailySchedule;
  getDaysInMonth: (date: Date) => number[];
}

export const useSchedulePrint = ({
  employmentTypes,
  selectedMonth,
  getScheduleForDate,
  getDaysInMonth,
}: UseSchedulePrintProps) => {
  const getDayOfWeek = (date: Date) => {
    const day = date.getDay();
    return day === 0 ? 7 : day; // Convert Sunday from 0 to 7
  };

  const handlePrintSchedules = useCallback(() => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const content = `
      <html>
        <head>
          <title>Monthly Schedules</title>
          <style>
            @page { 
              size: landscape;
              margin: 10mm;
            }
            body { 
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              font-size: 8px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .container {
              display: grid;
              grid-template-columns: repeat(${Math.ceil(
                employmentTypes.length / 2
              )}, 1fr);
              gap: 10px;
            }
            .type-block {
              break-inside: avoid;
            }
            .type-header {
              font-size: 10px;
              font-weight: bold;
              margin-bottom: 4px;
              color: #2563eb;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .schedule-grid {
              display: grid;
              grid-template-columns: repeat(7, 1fr);
              gap: 1px;
              border: 1px solid #ccc;
            }
            .day-cell {
              border: 1px solid #e5e7eb;
              padding: 1px;
              text-align: center;
            }
            .schedule-header {
              font-weight: bold;
              background: #f3f4f6;
            }
            .schedule-time {
              font-size: 7px;
              color: #4b5563;
            }
            .month-header {
              font-size: 12px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 8px;
              color: #1f2937;
            }
            .day-number {
              font-weight: bold;
              font-size: 8px;
            }
            .off-day { background-color: #f3f4f6; }
            .missing-time { background-color: #fef3c7; }
            .complete-time { background-color: #d1fae5; }
          </style>
        </head>
        <body>
          <div class="month-header">
            ${selectedMonth.toLocaleString("default", {
              month: "long",
              year: "numeric",
            })}
          </div>
          <div class="container">
            ${employmentTypes
              .map(
                (type) => `
              <div class="type-block">
                <div class="type-header">${type.type}</div>
                <div class="schedule-grid">
                  ${["M", "T", "W", "T", "F", "S", "S"]
                    .map(
                      (day) =>
                        `<div class="day-cell schedule-header">${day}</div>`
                    )
                    .join("")}
                  ${(() => {
                    const firstDayOfMonth = new Date(
                      selectedMonth.getFullYear(),
                      selectedMonth.getMonth(),
                      1
                    );
                    const startingDayOfWeek = getDayOfWeek(firstDayOfMonth);

                    // Add empty cells for days before the first of the month
                    const emptyCells = Array(startingDayOfWeek - 1)
                      .fill("")
                      .map(() => `<div class="day-cell"></div>`)
                      .join("");

                    // Add the actual days
                    const dayCells = getDaysInMonth(selectedMonth)
                      .map((day) => {
                        const date = new Date(
                          selectedMonth.getFullYear(),
                          selectedMonth.getMonth(),
                          day
                        );
                        const schedule = getScheduleForDate(type.type, date);
                        const cellClass = schedule.isOff
                          ? "off-day"
                          : !schedule.timeIn || !schedule.timeOut
                          ? "missing-time"
                          : "complete-time";
                        return `
                          <div class="day-cell ${cellClass}">
                            <div class="day-number">${day}</div>
                            ${
                              !schedule.isOff
                                ? `<div class="schedule-time">
                                  ${schedule.timeIn?.slice(0, 5) || "-"}${
                                    schedule.timeOut
                                      ? `<br>${schedule.timeOut.slice(0, 5)}`
                                      : ""
                                  }
                                </div>`
                                : `<div class="schedule-time">Off</div>`
                            }
                          </div>
                        `;
                      })
                      .join("");

                    return emptyCells + dayCells;
                  })()}
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  }, [employmentTypes, selectedMonth, getScheduleForDate, getDaysInMonth]);

  return { handlePrintSchedules };
};
