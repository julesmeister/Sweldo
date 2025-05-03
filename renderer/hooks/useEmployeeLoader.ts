import { useState, useEffect } from "react";
import {
  Employee,
  EmployeeModel,
  createEmployeeModel,
} from "@/renderer/model/employee";
import { toast } from "sonner";

interface UseEmployeeLoaderProps {
  employeeId: string | null;
  dbPath: string | null;
}

interface UseEmployeeLoaderReturn {
  employee: Employee | null;
  isLoadingEmployee: boolean;
}

export const useEmployeeLoader = ({
  employeeId,
  dbPath,
}: UseEmployeeLoaderProps): UseEmployeeLoaderReturn => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(false);
  const [employeeModel, setEmployeeModel] = useState<EmployeeModel | null>(
    null
  );

  useEffect(() => {
    if (dbPath) {
      setEmployeeModel(createEmployeeModel(dbPath));
    } else {
      setEmployeeModel(null);
    }
  }, [dbPath]);

  useEffect(() => {
    const loadEmployee = async () => {
      if (!dbPath || !employeeId || !employeeModel) {
        setEmployee(null); // Clear employee if dependencies are missing
        return;
      }

      setIsLoadingEmployee(true);
      try {
        const emp = await employeeModel.loadEmployeeById(employeeId);
        setEmployee(emp); // Set to null if not found by model
      } catch (error) {
        toast.error("Error loading employee");
        setEmployee(null);
      } finally {
        setIsLoadingEmployee(false);
      }
    };

    loadEmployee();
  }, [employeeId, dbPath, employeeModel]); // Depend on model instance

  return { employee, isLoadingEmployee };
};
