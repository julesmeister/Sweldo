import React, { useState, useEffect, useMemo } from "react";
import { isWebEnvironment, getFirestoreInstance, initializeFirebase, setFirestoreCompanyName } from "@/renderer/lib/firestoreService";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { IoLockClosed, IoEyeOutline, IoEyeOffOutline, IoChevronDown } from "react-icons/io5";
import { useAuthStore } from "@/renderer/stores/authStore";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { loadEmployeesFirestore } from "@/renderer/model/employee_firestore";
import { getAvatarByIndex, generateCardAnimationProps, avatars } from "@/renderer/lib/avatarUtils";
import { Employee, createEmployeeModel } from "@/renderer/model/employee";


interface CompanyWithEmployees {
  id: string;
  employeeCount: number;
}

interface LoginDialogProps {
  onSuccess?: () => void;
}

// Enhanced employee interface adding animation properties
interface EmployeeWithAnimation extends Employee {
  animationProps: {
    top: number;
    left: number;
    delay: number;
    duration: number;
    direction: string;
    rotate: number;
  };
}

// Updated employee type to fix linter errors
interface PlaceholderEmployee {
  id: string;
  name: string;
  position?: string;
  status: "active" | "inactive";
  lastPaymentPeriod?: any;
  employmentType?: string;
  dailyRate?: number;
  sss?: number;
  philHealth?: number;
  pagIbig?: number;
  animationProps: {
    top: number;
    left: number;
    delay: number;
    duration: number;
    direction: string;
    rotate: number;
  };
}

// Sample employee names
const firstNames = ["Alex", "Jamie", "Taylor", "Morgan", "Casey", "Jordan", "Riley", "Avery", "Quinn", "Peyton", "Drew", "Skyler"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Wilson", "Anderson"];

// Sample positions
const positions = [
  "Software Engineer", "Product Manager", "UI/UX Designer", "Data Analyst",
  "Marketing Specialist", "Customer Success", "HR Manager", "Sales Executive",
  "Financial Analyst", "Operations Manager", "Project Coordinator", "Content Writer"
];

export const LoginDialog: React.FC<LoginDialogProps> = ({ onSuccess }) => {
  const { dbPath, setCompanyName, companyName } = useSettingsStore();
  const { login, checkSession, isAuthenticated } = useAuthStore();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const router = useRouter();

  // Companies list for web mode
  const [companies, setCompanies] = useState<CompanyWithEmployees[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);

  // Company's employees for the background
  const [employees, setEmployees] = useState<EmployeeWithAnimation[]>([]);

  // Track if we only need company selection (user is already authenticated)
  const [companySelectionOnly, setCompanySelectionOnly] = useState(false);

  // Check if the user is already authenticated and just needs to select a company
  useEffect(() => {
    if (isWebEnvironment() && isAuthenticated) {
      console.log("[LoginDialog] User already authenticated, only company selection needed");
      setCompanySelectionOnly(true);
    }
  }, [isAuthenticated]);

  // Check if session is still valid
  useEffect(() => {
    if (checkSession()) {
      onSuccess?.();
    }
  }, [checkSession, onSuccess]);

  // Load company list in web mode
  useEffect(() => {
    async function loadCompanies() {
      if (!isWebEnvironment()) return;
      // Initialize Firebase and Firestore instance
      const app = initializeFirebase();
      const db = getFirestoreInstance();
      // Wait briefly to ensure Firestore is ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        // Method 1: Try to get all documents in the companies collection
        try {
          const snapshot = await getDocs(collection(db, "companies"));

          if (snapshot.docs.length > 0) {
            const companyDocs = snapshot.docs.map(doc => doc.id);

            // Get employee counts for each company
            const companiesWithEmployees = await Promise.all(
              companyDocs.map(async (companyId) => {
                let employeeCount = 0;
                try {
                  const employeesRef = collection(db, `companies/${companyId}/employees`);
                  const employeesSnapshot = await getDocs(employeesRef);
                  employeeCount = employeesSnapshot.docs.length;
                } catch (err) {
                  console.log(`[LoginDialog] Error counting employees for "${companyId}":`, err);
                }
                return { id: companyId, employeeCount };
              })
            );

            setCompanies(companiesWithEmployees);

            // Set the first company as default if available
            if (companiesWithEmployees.length > 0 && !selectedCompany) {
              setSelectedCompany(companiesWithEmployees[0].id);
            }

            return;
          } else {
            console.log("[LoginDialog] No companies found in direct collection query");
          }
        } catch (e) {
          console.error("[LoginDialog] Error fetching companies collection:", e);
        }

        // Method 2: Check if there's data in known subcollections that would indicate companies
        try {
          // Hardcode a list of commonly expected companies as fallback
          // This is a temporary solution - in production you should have a proper companies collection
          const commonCompanies = ["Stay", "Pure Care"];

          // Try to validate each company by checking if it has employees
          const validatedCompanies: CompanyWithEmployees[] = [];
          for (const companyName of commonCompanies) {
            try {
              const employeesRef = collection(db, `companies/${companyName}/employees`);
              const employeesSnapshot = await getDocs(employeesRef);
              const employeeCount = employeesSnapshot.docs.length;

              if (employeeCount > 0) {
                validatedCompanies.push({ id: companyName, employeeCount });
              }
            } catch (err) {
              console.log(`[LoginDialog] Error checking employees for "${companyName}":`, err);
            }
          }

          if (validatedCompanies.length > 0) {
            setCompanies(validatedCompanies);

            // Set the first company as default if available
            if (validatedCompanies.length > 0 && !selectedCompany) {
              setSelectedCompany(validatedCompanies[0].id);
            }

            return;
          }

          // If still no companies, add at least the default ones so users can log in
          if (validatedCompanies.length === 0) {
            console.log("[LoginDialog] No validated companies found, using fallback list");
            setCompanies(commonCompanies.map(id => ({ id, employeeCount: 0 })));

            // Set the first company as default
            if (commonCompanies.length > 0 && !selectedCompany) {
              setSelectedCompany(commonCompanies[0]);
            }
          }
        } catch (e) {
          console.error("[LoginDialog] Error trying to infer companies:", e);
        }
      } catch (e) {
        console.error("[LoginDialog] Failed to load companies:", e);
        toast.error("Error loading company list");
      }
    }
    loadCompanies();
  }, []);

  // Load employees for the background (supports both web and desktop modes)
  useEffect(() => {
    async function loadEmployees() {
      // For web mode, we need a selected company
      if (isWebEnvironment() && !selectedCompany) return;

      // For desktop mode, we need a dbPath
      if (!isWebEnvironment() && !dbPath) return;

      try {
        let fetchedEmployees: Employee[] = [];

        if (isWebEnvironment()) {
          // Web mode - load from Firestore
          fetchedEmployees = await loadEmployeesFirestore(selectedCompany);
        } else {
          // Desktop mode - load from local database
          try {
            const employeeModel = createEmployeeModel(dbPath);
            fetchedEmployees = await employeeModel.loadEmployees();
            console.log(`[LoginDialog] Loaded ${fetchedEmployees.length} employees from desktop database`);
          } catch (error) {
            console.error("[LoginDialog] Error loading employees from desktop database:", error);
          }
        }

        // If we couldn't load any employees, use placeholders
        if (fetchedEmployees.length === 0) {
          console.log("[LoginDialog] No real employees found, creating placeholders");
          // Create placeholder employees for visual effect
          const placeholderEmployees: PlaceholderEmployee[] = Array(6).fill(0).map((_, i) => ({
            id: `placeholder-${i}`,
            name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
            position: positions[i % positions.length],
            status: "active" as const,
            lastPaymentPeriod: null,
            animationProps: generateCardAnimationProps()
          }));

          setEmployees(placeholderEmployees as unknown as EmployeeWithAnimation[]);
          return;
        }

        // Limit to 10 employees for the background and add animation properties
        const enhancedEmployees: EmployeeWithAnimation[] = fetchedEmployees
          .slice(0, 10)
          .map(emp => ({
            ...emp,
            animationProps: generateCardAnimationProps()
          }));

        setEmployees(enhancedEmployees);
      } catch (error) {
        console.error(`[LoginDialog] Error loading employees:`, error);
        // If we can't load employees, create some placeholder ones for visual effect
        const placeholderEmployees: PlaceholderEmployee[] = Array(6).fill(0).map((_, i) => ({
          id: `placeholder-${i}`,
          name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
          position: positions[i % positions.length],
          status: "active" as const,
          lastPaymentPeriod: null,
          animationProps: generateCardAnimationProps()
        }));
        setEmployees(placeholderEmployees as unknown as EmployeeWithAnimation[]);
      }
    }

    loadEmployees();
  }, [selectedCompany, dbPath]);

  // Handle company selection only mode
  const handleCompanyOnlySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) {
      toast.error("Please select a company");
      return;
    }

    // Set company name in settings store
    setCompanyName(selectedCompany);

    // Save to localStorage
    try {
      // Make sure company name is explicitly set in localStorage
      const currentSettings = {
        ...useSettingsStore.getState(),
        companyName: selectedCompany
      };

      // Save to localStorage
      localStorage.setItem("settings-storage", JSON.stringify({
        state: currentSettings
      }));

      // Also update in firestoreService
      setFirestoreCompanyName(selectedCompany);

      toast.success(`Company '${selectedCompany}' selected`);

      // Call success callback
      onSuccess?.();
    } catch (e) {
      console.error("[LoginDialog] Error saving company name:", e);
      toast.error("Error saving company selection");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // In web mode, ensure company selected
    if (isWebEnvironment()) {
      if (!selectedCompany) {
        toast.error("Please select a company");
        return;
      }
      // Set company name in settings store
      setCompanyName(selectedCompany);
    }
    if (!pin) return;

    setError(null);
    setIsLoading(true);

    try {
      const success = await login(pin);
      if (success) {
        // Ensure session initialization flag is set in localStorage
        localStorage.setItem("sweldo_session_initialized", "true");

        // If in web mode, ensure company name is saved in localStorage
        if (isWebEnvironment() && selectedCompany) {
          try {
            // Make sure company name is explicitly set in localStorage
            const currentSettings = {
              ...useSettingsStore.getState(),
              companyName: selectedCompany
            };

            // Save to localStorage again to be certain
            localStorage.setItem("settings-storage", JSON.stringify({
              state: currentSettings
            }));

            // Also update in firestoreService
            setFirestoreCompanyName(selectedCompany);
          } catch (e) {
            console.error("[LoginDialog] Error saving company name:", e);
          }
        }

        // Only call onSuccess if login was successful
        onSuccess?.();
      } else {
        setError("Invalid PIN code");
        setPin("");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Invalid PIN code");
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanySelect = (companyId: string) => {
    setSelectedCompany(companyId);
    setShowCompanyDropdown(false);

    // Immediately set company name in settings store when selected
    if (isWebEnvironment() && companyId) {
      setCompanyName(companyId);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 overflow-hidden">
      {/* Light background with floating employee cards */}
      <div className="main-bg-container absolute inset-0 bg-white overflow-hidden">
        {/* Floating employee cards */}
        <div className="floating-employees">
          {employees.map((employee) => (
            <div
              key={employee.id}
              className="employee-card"
              style={{
                top: `${employee.animationProps.top}%`,
                left: `${employee.animationProps.left}%`,
                animationDelay: `${employee.animationProps.delay}s`,
                animationDuration: `${employee.animationProps.duration}s`,
                animationDirection: employee.animationProps.direction,
                transform: `rotate(${employee.animationProps.rotate}deg)`,
              }}
            >
              <div className="card-content">
                <div className="avatar-container">
                  <Image
                    src={getAvatarByIndex(employee.id)}
                    alt={employee.name}
                    width={50}
                    height={50}
                    className="rounded-full border-2 border-blue-100"
                  />
                </div>
                <div className="employee-info">
                  <div className="employee-name">{employee.name}</div>
                  <div className="employee-position">{employee.position || "Staff"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Animated geometric shapes (keep these for depth) */}
        <div className="geometric-animation">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>
      </div>

      {/* Login Dialog Card */}
      <div className="w-full max-w-md border border-gray-100 bg-white shadow-lg relative z-10">
        <div className="flex flex-col items-center justify-center p-12">
          {/* NEW ENHANCED HEADER SECTION */}
          <div className="header-container w-full flex flex-col items-center mb-10">
            {/* Animated floating lock with decorative ring */}
            <div className="lock-container relative mb-5">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="blue-ring"></div>
              </div>
              <div className="lock-icon-wrapper flex items-center justify-center relative">
                <div className="lock-background"></div>
                <IoLockClosed className="h-8 w-8 text-blue-500 relative z-10 lock-float" />
              </div>
            </div>

            {/* Enhanced title with decorative elements */}
            <div className="title-container relative flex flex-col items-center">
              <h2 className="text-2xl font-semibold text-blue-500 mb-1 tracking-wide relative z-10">
                {companySelectionOnly ? "Select Company" : "Enter PIN Code"}
              </h2>
              <div className="title-underline"></div>
              <div className="title-caption text-xs text-gray-400 mt-2">
                {companySelectionOnly ?
                  "Please select which company you want to access" :
                  "Secure authentication required"}
              </div>
            </div>
          </div>

          {companySelectionOnly ? (
            <form onSubmit={handleCompanyOnlySubmit} className="w-full space-y-4">
              {/* Company Dropdown */}
              <div className="relative">
                <div
                  className="w-full bg-white border border-gray-200 p-3 text-gray-700 flex justify-between items-center cursor-pointer hover:border-blue-300 transition-colors"
                  onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
                >
                  <span className="text-gray-800">{selectedCompany || "Select Company"}</span>
                  <IoChevronDown className={`text-blue-500 transition-transform duration-200 ${showCompanyDropdown ? 'rotate-180' : ''}`} />
                </div>

                {/* Dropdown Menu */}
                {showCompanyDropdown && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 shadow-lg z-10">
                    {companies.map((company) => (
                      <div
                        key={company.id}
                        className="p-3 hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => handleCompanySelect(company.id)}
                      >
                        <div className="text-gray-800 font-medium">{company.id}</div>
                        <div className="text-xs text-blue-500 mt-1">
                          {company.employeeCount} {company.employeeCount === 1 ? 'employee' : 'employees'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button for Company Selection Only */}
              <button
                type="submit"
                className="modern-button w-full p-3 text-white font-medium transition-all duration-300 ease-out transform hover:translate-y-[-2px] focus:outline-none disabled:opacity-70 disabled:pointer-events-none"
              >
                <span>Continue</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="w-full space-y-4">
              {/* Company Dropdown */}
              {isWebEnvironment() && (
                <div className="relative">
                  <div
                    className="w-full bg-white border border-gray-200 p-3 text-gray-700 flex justify-between items-center cursor-pointer hover:border-blue-300 transition-colors"
                    onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
                  >
                    <span className="text-gray-800">{selectedCompany || "Select Company"}</span>
                    <IoChevronDown className={`text-blue-500 transition-transform duration-200 ${showCompanyDropdown ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Dropdown Menu */}
                  {showCompanyDropdown && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 shadow-lg z-10">
                      {companies.map((company) => (
                        <div
                          key={company.id}
                          className="p-3 hover:bg-blue-50 cursor-pointer transition-colors"
                          onClick={() => handleCompanySelect(company.id)}
                        >
                          <div className="text-gray-800 font-medium">{company.id}</div>
                          <div className="text-xs text-blue-500 mt-1">
                            {company.employeeCount} {company.employeeCount === 1 ? 'employee' : 'employees'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Display current company name in desktop mode */}
              {!isWebEnvironment() && companyName && (
                <div className="w-full bg-blue-50 p-3 text-gray-700 rounded-md border border-blue-100">
                  <span className="text-gray-800 font-medium">Company: {companyName}</span>
                </div>
              )}

              {/* PIN Input */}
              <div className="relative">
                <input
                  type={showPin ? "text" : "password"}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full p-3 bg-blue-50 border border-blue-100 text-gray-800 placeholder-blue-300 focus:outline-none focus:border-blue-400 transition-colors"
                  placeholder="Enter PIN"
                  required
                  minLength={4}
                  maxLength={8}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 inset-y-0 flex items-center text-blue-400 hover:text-blue-500 transition-colors"
                  disabled={isLoading}
                  tabIndex={-1}
                  aria-label={showPin ? "Hide PIN" : "Show PIN"}
                >
                  {showPin ? (
                    <IoEyeOffOutline className="h-5 w-5" />
                  ) : (
                    <IoEyeOutline className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="text-sm text-red-500 font-medium">{error}</div>
              )}

              {/* Improved Submit Button with 3D effect */}
              <button
                type="submit"
                disabled={isLoading}
                className="modern-button w-full p-3 text-white font-medium transition-all duration-300 ease-out transform hover:translate-y-[-2px] focus:outline-none disabled:opacity-70 disabled:pointer-events-none"
              >
                <span>{isLoading ? "Logging in..." : "Login"}</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        .main-bg-container {
          background-image:
            linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px),
            linear-gradient(to right, rgba(59, 130, 246, 0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        
        .geometric-animation {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        
        .shape {
          position: absolute;
          border: 1px solid rgba(200, 220, 245, 0.5);
          background-color: rgba(230, 235, 245, 0.4);
          border-radius: 3px;
          will-change: transform, opacity;
          animation-name: subtleFloat;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        
        .shape-1 {
          width: 150px; height: 150px; top: 15%; left: 10%;
          --tx: 12; --ty: -18; --r: 22;
          animation-duration: 28s; animation-delay: 0s;
        }
        .shape-2 {
          width: 200px; height: 200px; bottom: 10%; right: 10%;
          --tx: -15; --ty: 25; --r: -18;
          animation-duration: 35s; animation-delay: -7s;
        }
        .shape-3 {
          width: 100px; height: 100px; top: 40%; right: 20%;
          --tx: 20; --ty: 10; --r: 30;
          animation-duration: 30s; animation-delay: -3s;
        }
        
        @keyframes subtleFloat {
          0% { 
            transform: translate(0px, 0px) rotate(0deg); 
            opacity: 0.4; 
          }
          50% { 
            transform: translate(calc(var(--tx, 0) * 1px), calc(var(--ty, 0) * 1px)) rotate(calc(var(--r, 0) * 1deg)); 
            opacity: 0.6; 
          }
          100% { 
            transform: translate(0px, 0px) rotate(0deg); 
            opacity: 0.4; 
          }
        }

        /* Employee card styles */
        .floating-employees {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
        }
        
        .employee-card {
          position: absolute;
          width: 220px;
          background-color: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(4px);
          border-radius: 10px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
          border: 1px solid rgba(219, 234, 254, 0.7);
          padding: 12px;
          animation: float-card 25s ease-in-out infinite;
          pointer-events: auto;
          cursor: pointer;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .employee-card:hover {
          transform: translateY(-5px) scale(1.03) !important;
          box-shadow: 0 10px 25px rgba(59, 130, 246, 0.15);
          z-index: 10;
        }
        
        .card-content {
          display: flex;
          align-items: center;
        }
        
        .avatar-container {
          margin-right: 12px;
          flex-shrink: 0;
        }
        
        .employee-info {
          flex: 1;
          overflow: hidden;
        }
        
        .employee-name {
          font-weight: 600;
          color: #1E40AF;
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .employee-position {
          font-size: 12px;
          color: #6B7280;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        @keyframes float-card {
          0% {
            transform: translateX(0) translateY(0) rotate(var(--rotate, 0deg));
            opacity: 0.7;
          }
          25% {
            transform: translateX(70px) translateY(-20px) rotate(calc(var(--rotate, 0deg) + 1deg));
            opacity: 0.9;
          }
          50% {
            transform: translateX(140px) translateY(0) rotate(var(--rotate, 0deg));
            opacity: 1;
          }
          75% {
            transform: translateX(70px) translateY(20px) rotate(calc(var(--rotate, 0deg) - 1deg));
            opacity: 0.9;
          }
          100% {
            transform: translateX(0) translateY(0) rotate(var(--rotate, 0deg));
            opacity: 0.7;
          }
        }

        /* New modern button style with gradient and shadow */
        .modern-button {
          background: linear-gradient(135deg, #2563EB, #4338CA);
          border-radius: 4px;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3),
                      0 2px 6px rgba(67, 56, 202, 0.2),
                      inset 0 1px 1px rgba(255, 255, 255, 0.1);
          position: relative;
          overflow: hidden;
        }
        
        .modern-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.1),
            transparent
          );
          transition: 0.6s;
        }
        
        .modern-button:hover::before {
          left: 100%;
        }
        
        .modern-button:active {
          transform: translateY(1px) !important;
          box-shadow: 0 3px 10px rgba(37, 99, 235, 0.2),
                      0 1px 4px rgba(67, 56, 202, 0.15);
        }
        
        /* Lock icon animations */
        .lock-container {
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .blue-ring {
          width: 60px;
          height: 60px;
          border: 2px solid rgba(59, 130, 246, 0.2);
          border-radius: 50%;
          position: absolute;
          animation: pulse-ring 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .lock-icon-wrapper {
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(236, 246, 255, 0.9));
          border-radius: 50%;
          box-shadow: 0 2px 10px rgba(59, 130, 246, 0.15);
          overflow: hidden;
        }

        .lock-background {
          position: absolute;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at center, rgba(219, 234, 254, 0.7), rgba(191, 219, 254, 0.3));
          opacity: 0.8;
        }

        .lock-float {
          animation: float-lock 4s ease-in-out infinite;
        }

        .title-container {
          text-align: center;
          width: 100%;
        }

        .title-underline {
          height: 2px;
          width: 40px;
          background: linear-gradient(to right, transparent, #3B82F6, transparent);
          margin-top: 4px;
          animation: width-pulse 3s ease-in-out infinite;
        }

        @keyframes pulse-ring {
          0% {
            transform: scale(0.95);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.3;
          }
          100% {
            transform: scale(0.95);
            opacity: 0.7;
          }
        }

        @keyframes float-lock {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }

        @keyframes width-pulse {
          0%, 100% {
            width: 40px;
            opacity: 0.8;
          }
          50% {
            width: 80px;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
