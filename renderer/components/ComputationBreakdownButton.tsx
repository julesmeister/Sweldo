import React from "react";
import { IoCalculator } from "react-icons/io5";
import { AttendanceSettings } from "@/renderer/model/settings";
import { Holiday } from "@/renderer/model/holiday";
import { PaymentBreakdown } from "@/renderer/hooks/utils/compensationUtils";

interface ComputationBreakdownButtonProps {
  breakdown: PaymentBreakdown;
  attendanceSettings: AttendanceSettings;
  holiday?: Holiday;
}

const formatNumber = (num: number) => {
  const formatted = Number(num).toFixed(2);
  return formatted.endsWith(".00") ? formatted.slice(0, -3) : formatted;
};

export const ComputationBreakdownButton: React.FC<
  ComputationBreakdownButtonProps
> = ({ breakdown, attendanceSettings, holiday }) => {
  return (
    <button
      title="View payment computation breakdown"
      className="text-gray-400 hover:text-gray-300 focus:outline-none relative group"
    >
      <IoCalculator className="h-5 w-5" />

      {/* Computation Breakdown Popover */}
      <div
        className="hidden group-hover:block fixed w-96 p-4 bg-gray-800 rounded-lg shadow-lg z-50 text-sm"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-100">Payment Computation</h4>
          <span className="text-xs text-gray-400">Hover to view details</span>
        </div>

        <div className="space-y-4">
          {/* Base Pay Calculation */}
          <div className="bg-gray-700/50 rounded-md p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-200">Daily Rate</span>
              <span className="text-lg font-medium">
                ₱{formatNumber(breakdown.basePay)}
              </span>
            </div>
            <div className="flex justify-between text-gray-400 text-xs">
              <span>Hourly Rate (₱{formatNumber(breakdown.basePay)}/8hrs)</span>
              <span>₱{formatNumber(breakdown.details.hourlyRate)}/hr</span>
            </div>
          </div>

          {/* Additional Earnings */}
          <div className="space-y-2">
            {/* Overtime Calculation */}
            {breakdown.overtimePay > 0 && (
              <div className="bg-gray-700/50 rounded-md p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-200">Overtime Pay</span>
                  <span className="text-lg font-medium text-green-400">
                    ₱{formatNumber(breakdown.overtimePay)}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>
                      Hours:{" "}
                      {Math.floor(breakdown.details.overtimeMinutes / 60)}hrs{" "}
                      {breakdown.details.overtimeMinutes % 60}mins
                    </span>
                    <span>
                      Hourly Rate: ₱
                      {formatNumber(breakdown.details.overtimeHourlyRate)}
                      /hr
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      Multiplier:{" "}
                      {formatNumber(
                        attendanceSettings.overtimeHourlyMultiplier
                      )}
                      x
                    </span>
                    <span>
                      Calculation:{" "}
                      {Math.floor(breakdown.details.overtimeMinutes / 60)}hrs ×
                      ₱{formatNumber(breakdown.details.overtimeHourlyRate)}
                      /hr
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Night Differential Calculation */}
            {breakdown.nightDifferentialPay > 0 && (
              <div className="bg-gray-700/50 rounded-md p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-200">Night Differential</span>
                  <span className="text-lg font-medium text-green-400">
                    ₱{formatNumber(breakdown.nightDifferentialPay)}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>
                      Hours:{" "}
                      {formatNumber(breakdown.details.nightDifferentialHours)}{" "}
                      hrs
                    </span>
                    <span>
                      Hourly Rate: ₱{formatNumber(breakdown.details.hourlyRate)}
                      /hr
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      Night Diff Rate:{" "}
                      {formatNumber(
                        attendanceSettings.nightDifferentialMultiplier * 100
                      )}
                      %
                    </span>
                    <span>
                      Calculation:{" "}
                      {formatNumber(breakdown.details.nightDifferentialHours)}{" "}
                      hrs × ₱{formatNumber(breakdown.details.hourlyRate)}/hr ×{" "}
                      {formatNumber(
                        attendanceSettings.nightDifferentialMultiplier
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Holiday Pay Calculation */}
            {breakdown.holidayBonus > 0 && (
              <div className="bg-gray-700/50 rounded-md p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-200">
                    Holiday Pay ({holiday?.type})
                  </span>
                  <span className="text-lg font-medium text-green-400">
                    ₱{formatNumber(breakdown.holidayBonus)}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>Daily Rate: ₱{formatNumber(breakdown.basePay)}</span>
                    <span>Multiplier: {holiday?.multiplier}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      Calculation: ₱{formatNumber(breakdown.basePay)} ×{" "}
                      {holiday?.multiplier}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Deductions */}
          {breakdown.deductions.total > 0 && (
            <div className="bg-red-900/20 rounded-md p-3 border border-red-900/30">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-200">Deductions</span>
                <span className="text-lg font-medium text-red-400">
                  -₱{formatNumber(breakdown.deductions.total)}
                </span>
              </div>
              <div className="space-y-2 text-xs text-gray-400">
                {breakdown.deductions.late > 0 && (
                  <div>
                    <div className="flex justify-between">
                      <span>
                        Late ({breakdown.details.lateMinutes}mins total)
                      </span>
                      <span className="text-red-400">
                        -₱{formatNumber(breakdown.deductions.late)}
                      </span>
                    </div>
                    <div className="text-gray-500 pl-2 text-left">
                      After {breakdown.details.lateGracePeriod}mins grace |
                      Charged:{" "}
                      {Math.max(
                        0,
                        breakdown.details.lateMinutes -
                          breakdown.details.lateGracePeriod
                      )}
                      mins @ ₱
                      {formatNumber(breakdown.details.lateDeductionPerMinute)}
                      /min
                    </div>
                  </div>
                )}
                {breakdown.deductions.undertime > 0 && (
                  <div>
                    <div className="flex justify-between">
                      <span>
                        Undertime ({breakdown.details.undertimeMinutes}mins)
                      </span>
                      <span className="text-red-400">
                        -₱{formatNumber(breakdown.deductions.undertime)}
                      </span>
                    </div>
                    <div className="text-gray-500 pl-2 text-left">
                      Grace: {breakdown.details.undertimeGracePeriod}mins |
                      Deductible:{" "}
                      {Math.max(
                        0,
                        breakdown.details.undertimeMinutes -
                          breakdown.details.undertimeGracePeriod
                      )}
                      mins | Rate: ₱
                      {formatNumber(
                        breakdown.details.undertimeDeductionPerMinute
                      )}
                      /min
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Net Pay */}
          <div className="bg-gray-700 rounded-md p-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-200 font-medium">Net Pay</span>
              <span className="text-xl font-bold text-white">
                ₱{formatNumber(breakdown.netPay)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};
