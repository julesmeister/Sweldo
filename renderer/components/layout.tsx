"use client";
import "@/renderer/stores/globalPolyfill";
import "@/resources/globals.css";
import Navbar from "../components/Navbar";
import { Toaster, toast } from "sonner";
import { LoadingBar } from "./LoadingBar";
import { useEffect, useRef, useState } from "react";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/renderer/stores/authStore";
import { LoginDialog } from "./LoginDialog";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { RoleModelImpl } from "../model/role";
import { IoFolderOutline } from "react-icons/io5";
import path from "path";

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { setLoading, setActiveLink } = useLoadingStore();
  const initialRender = useRef(true);
  const { isAuthenticated, logout, checkSession } = useAuthStore();
  const { dbPath, isInitialized, initialize } = useSettingsStore();
  const [showLogin, setShowLogin] = useState(false);
  const [isCheckingRoles, setIsCheckingRoles] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const hasCheckedRoles = useRef(false);

  // Initialize settings store
  useEffect(() => {
    console.log("Initializing settings...");
    initialize().catch((error) => {
      console.error("Failed to initialize settings:", error);
      setInitError("Failed to initialize settings. Please try again.");
    });
  }, [initialize]);

  const handleSettingsRedirect = async () => {
    try {
      setLoading(true);
      setActiveLink("/settings");
      await router.push("/settings");
    } finally {
      setLoading(false);
    }
  };

  // Initialize auth store with dbPath and check for roles
  useEffect(() => {
    const initializeAuth = async () => {
      // Wait for settings to be initialized
      if (!isInitialized) {
        console.log("Waiting for settings to initialize...");
        return;
      }

      // Skip if we've already checked roles and user is authenticated
      if (hasCheckedRoles.current && isAuthenticated) {
        setIsCheckingRoles(false);
        return;
      }

      console.log("Checking auth with dbPath:", dbPath);

      if (!dbPath) {
        setIsCheckingRoles(false);
        // If no dbPath, we need to allow access to settings
        if (pathname === "/settings") {
          return; // Don't show login for settings page when no dbPath
        }
      }

      // Check if any roles exist
      try {
        const roleModel = new RoleModelImpl(dbPath);

        // Ensure SweldoDB directory exists
        const sweldoPath = path.join(dbPath, "SweldoDB");
        await window.electron.ensureDir(sweldoPath);

        const roles = await roleModel.getRoles();
        console.log("Found roles:", roles.length);

        // If no roles exist, redirect to role creation page
        if (roles.length === 0) {
          toast.error("No roles found. Please create an admin role first.");
          router.push("/settings"); // Assuming this is your roles management page
          return;
        }

        // Only show login if there are roles and user is not authenticated
        if (roles.length > 0 && !isAuthenticated) {
          setShowLogin(true);
        }

        hasCheckedRoles.current = true;
      } catch (error) {
        console.error("Error checking roles:", error);
        setInitError(
          "Error checking roles. Please check your database path and try again."
        );
      } finally {
        setIsCheckingRoles(false);
      }
    };

    initializeAuth();
  }, [dbPath, isAuthenticated, pathname, isInitialized]);

  const [lastActivity, setLastActivity] = useState(Date.now());

  // Handle session timeout
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkSession = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;

      if (timeSinceLastActivity >= SESSION_TIMEOUT) {
        console.log("Session timeout detected", {
          timeSinceLastActivity: Math.round(timeSinceLastActivity / 1000 / 60),
          timeout: SESSION_TIMEOUT / 1000 / 60,
        });
        logout();
        setShowLogin(true);
        hasCheckedRoles.current = false; // Reset roles check on session timeout
      }
    };

    // Check every minute instead of every second
    const interval = setInterval(checkSession, 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, lastActivity, logout]);

  // Track user activity
  useEffect(() => {
    if (!isAuthenticated) return;

    const updateActivity = () => {
      const now = Date.now();
      setLastActivity(now);
      useAuthStore.getState().updateLastActivity();
    };

    // Track various user activities
    window.addEventListener("mousemove", updateActivity);
    window.addEventListener("mousedown", updateActivity);
    window.addEventListener("keydown", updateActivity);
    window.addEventListener("scroll", updateActivity);
    window.addEventListener("touchstart", updateActivity);

    return () => {
      window.removeEventListener("mousemove", updateActivity);
      window.removeEventListener("mousedown", updateActivity);
      window.removeEventListener("keydown", updateActivity);
      window.removeEventListener("scroll", updateActivity);
      window.removeEventListener("touchstart", updateActivity);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    // Only reset loading on subsequent route changes
    setLoading(false);
  }, [pathname]);

  // Show loading state while checking roles
  if (isCheckingRoles) {
    return (
      <div className="min-h-screen bg-background font-sans flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600 mx-auto"></div>
          <div className="text-gray-600">Initializing application...</div>
        </div>
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // Show error state if initialization failed
  if (initError) {
    return (
      <div className="min-h-screen bg-background font-sans flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto px-4">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Initialization Error
          </h2>
          <p className="text-gray-600 mb-4">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // Show login dialog when authentication is required
  if (showLogin && (!dbPath || pathname !== "/settings")) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Toaster position="top-right" richColors />
        <LoginDialog
          onSuccess={() => {
            console.log("Login successful");
            setShowLogin(false);
          }}
        />
      </div>
    );
  }

  // If no dbPath and not on settings page, show redirect message
  if (!dbPath && !pathname?.startsWith("/settings")) {
    return (
      <div className="min-h-screen bg-background font-sans flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <IoFolderOutline className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            Database Path Not Set
          </h2>
          <p className="text-gray-500 mb-4">
            Please configure your database path in settings before continuing.
          </p>
          <button
            onClick={handleSettingsRedirect}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Settings
          </button>
        </div>
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <LoadingBar />
      <Navbar />
      <main
        className={`max-w-12xl ${
          pathname?.startsWith("/timesheet") ? "" : "mx-auto px-4 pt-4"
        }`}
      >
        {children}
        <Toaster position="top-right" richColors />
      </main>
    </div>
  );
}
