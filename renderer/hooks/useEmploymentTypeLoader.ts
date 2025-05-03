import { useState, useEffect, useMemo } from "react";
import {
  AttendanceSettingsModel,
  EmploymentType,
} from "@/renderer/model/settings";
import { Employee } from "@/renderer/model/employee";
import { toast } from "sonner";

interface UseEmploymentTypeLoaderProps {
  attendanceSettingsModel: AttendanceSettingsModel;
  employee: Employee | null;
}

interface UseEmploymentTypeLoaderReturn {
  employmentTypes: EmploymentType[];
  timeSettings: EmploymentType[];
  employeeTimeSettings: EmploymentType | null;
}

export const useEmploymentTypeLoader = ({
  attendanceSettingsModel,
  employee,
}: UseEmploymentTypeLoaderProps): UseEmploymentTypeLoaderReturn => {
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [timeSettings, setTimeSettings] = useState<EmploymentType[]>([]);

  useEffect(() => {
    const loadEmploymentTypes = async () => {
      try {
        const types = await attendanceSettingsModel.loadTimeSettings();
        setTimeSettings(types);
        setEmploymentTypes(types);
      } catch (error) {
        toast.error("Failed to load employment types");
        setTimeSettings([]);
        setEmploymentTypes([]);
      }
    };
    loadEmploymentTypes();
  }, [attendanceSettingsModel]);

  const employeeTimeSettings = useMemo(() => {
    if (!employee || !timeSettings.length) return null;
    const settings = timeSettings.find(
      (type) =>
        type.type.toLowerCase() === employee.employmentType?.toLowerCase()
    );
    return settings || null;
  }, [employee, timeSettings]);

  return { employmentTypes, timeSettings, employeeTimeSettings };
};
