"use client";
import "@/renderer/stores/globalPolyfill";
import Navbar from "../components/Navbar";
import { Toaster, toast } from "sonner";
import { LoadingBar } from "./LoadingBar";
import { useEffect, useRef, useState, memo } from "react";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/renderer/stores/authStore";
import { LoginDialog } from "./LoginDialog";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { RoleModelImpl } from "../model/role";
import { IoFolderOutline } from "react-icons/io5";
import path from "path";
import { useDateSelectorStore } from "@/renderer/components/DateSelector";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

// Memoize the RefreshWrapper to prevent re-renders
const RefreshWrapper = memo(({ children }: { children: React.ReactNode }) => {
  const selectedMonth = useDateSelectorStore((state) => state.selectedMonth);
  const selectedYear = useDateSelectorStore((state) => state.selectedYear);
  const pathname = usePathname();

  // CRITICAL FIX: Disable key-based remounting which breaks form interactions
  // The key-based refresh was causing entire component tree remounts during delete operations
  // This made form fields unresponsive across the entire application
  // Only force re-renders on date changes for specific routes that need it
  const needsDateRefresh = false; // Temporarily disabled to fix form field freeze issue
    // pathname?.includes("/timesheet") ||
    // pathname?.includes("/payroll") ||
    // pathname?.includes("/attendance");

  // Use normal rendering without key-based remounting to preserve form state
  return <>{children}</>;
});

RefreshWrapper.displayName = "RefreshWrapper";

// Define the layout as a function component then export the memoized version
function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setLoading, setActiveLink } = useLoadingStore();
  const initialRender = useRef(true);
  const { isAuthenticated, logout, checkSession, initializeAuth } =
    useAuthStore();
  const { dbPath, isInitialized, initialize, companyName } = useSettingsStore();
  const [showLogin, setShowLogin] = useState(false);
  const [isCheckingRoles, setIsCheckingRoles] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const hasCheckedRoles = useRef(false);
  const [hasMounted, setHasMounted] = useState(false);

  // Add a force reset function and timeout mechanism
  const [resetCount, setResetCount] = useState(0);

  // Add a more permanent session flag using localStorage to persist across navigations
  const [hasInitializedThisSession, setHasInitializedThisSession] = useState(
    () => {
      // Check if we already initialized in this browser session
      try {
        return localStorage.getItem("sweldo_session_initialized") === "true";
      } catch (e) {
        return false;
      }
    }
  );

  // Update the localStorage when initialization state changes
  useEffect(() => {
    if (hasInitializedThisSession) {
      try {
        localStorage.setItem("sweldo_session_initialized", "true");
      } catch (e) {
        console.error(
          "[Layout] Could not save initialization state to localStorage",
          e
        );
      }
    }
  }, [hasInitializedThisSession]);

  // Clear initialization flag on logout
  useEffect(() => {
    if (!isAuthenticated && hasInitializedThisSession) {
      try {
        localStorage.removeItem("sweldo_session_initialized");
        setHasInitializedThisSession(false);
        hasCheckedRoles.current = false;
      } catch (e) {
        console.error("[Layout] Could not clear initialization state", e);
      }
    }
  }, [isAuthenticated, hasInitializedThisSession]);

  // Add ref to track initialization status
  const isInitializingRef = useRef(false);

  // Add ref to track role checking initialization
  const isRoleCheckingRef = useRef(false);

  // Log only on pathname changes to reduce console spam
  useEffect(() => {
    // (removed debug log)
  }, [pathname]);

  // Avoid excessive debug logs by using a ref for the app state
  const appStateRef = useRef({
    isAuthenticated,
    isCheckingRoles,
    hasCheckedRoles: hasCheckedRoles.current,
    showLogin,
    pathname,
  });

  // Update the ref when values change
  useEffect(() => {
    const prevState = { ...appStateRef.current };
    const newState = {
      isAuthenticated,
      isCheckingRoles,
      hasCheckedRoles: hasCheckedRoles.current,
      showLogin,
      pathname,
    };

    // Only log if something actually changed
    if (JSON.stringify(prevState) !== JSON.stringify(newState)) {
      // (removed debug log)
      appStateRef.current = newState;
    }
  }, [isAuthenticated, isCheckingRoles, showLogin, pathname]);

  // Add a safety timeout to prevent infinite checking
  useEffect(() => {
    if (isCheckingRoles) {
      // (removed debug log)
      const safetyTimeout = setTimeout(() => {
        // (removed debug log)
        setIsCheckingRoles(false);
      }, 5000); // 5 second timeout

      return () => clearTimeout(safetyTimeout);
    }
  }, [isCheckingRoles, resetCount]);

  // Function to manually reset state
  const forceReset = () => {
    // (removed debug log)
    // Clear all state
    setIsCheckingRoles(false);
    hasCheckedRoles.current = false;

    // Clear localStorage initialization flag
    try {
      localStorage.removeItem("sweldo_session_initialized");
    } catch (e) {
      console.error("[Layout] Could not clear localStorage on reset", e);
    }

    // Update React state
    setHasInitializedThisSession(false);
    setResetCount((prev) => prev + 1);
  };

  // Initialize settings store
  useEffect(() => {
    // Only initialize settings store once
    if (isInitialized || isInitializingRef.current) {
      // (removed debug log)
      return;
    }

    // Retrieve dbPath from localStorage before initializing the store
    let initialDbPath: string | null = null;
    try {
      // (removed debug log)
      const persistedState = localStorage.getItem("settings-storage");
      if (persistedState) {
        // (removed debug log)
        const parsed = JSON.parse(persistedState);
        // Check if state and dbPath exist and are strings
        if (parsed && parsed.state && typeof parsed.state.dbPath === "string") {
          initialDbPath = parsed.state.dbPath;
          // (removed debug log)
        } else {
          // (removed debug log)
        }
      } else {
        // (removed debug log)
      }
    } catch (e) {
      console.error("[Layout] Error reading dbPath from localStorage:", e);
    }

    // Pass the retrieved path (or null) to initialize
    // (removed debug log)
    initialize(initialDbPath)
      .then(() => {
        // (removed debug log)
        isInitializingRef.current = false;
      })
      .catch((error) => {
        console.error("[Layout] Error during settings initialization:", error);
        setInitError(
          "Failed to initialize settings. Please check console and try again."
        );
        isInitializingRef.current = false;
      });
  }, []);

  const handleSettingsRedirect = async () => {
    try {
      setLoading(true);
      setActiveLink("/settings");
      await router.push("/settings");
    } finally {
      setLoading(false);
    }
  };

  // Initialize auth store based on settings store readiness
  useEffect(() => {
    // Auth store should only be initialized once settings are ready
    if (!isInitialized || (!dbPath && !isWebEnvironment())) {
      // (removed debug log)
      return;
    }

    // Skip if already initialized
    if (useAuthStore.getState().isAuthInitialized) {
      // (removed debug log)
      return;
    }

    // Try to recover settings if company name is missing in web mode
    const attemptSettingsRecovery = async () => {
      if (isWebEnvironment() && !companyName) {
        console.log("[Layout] Web mode detected with missing company name. Attempting settings recovery...");
        try {
          const success = await useSettingsStore.getState().recoverSettings();
          if (success) {
            console.log("[Layout] Successfully recovered settings");
            // No need to set anything as useSettingsStore will update itself
          } else {
            console.log("[Layout] No settings backup found to recover");
          }
        } catch (error) {
          console.error("[Layout] Settings recovery failed:", error);
        }
      }
    };

    // Attempt recovery before auth initialization
    attemptSettingsRecovery().then(() => {
      // (removed debug log)
      initializeAuth()
        .then(() => {
          // (removed debug log)
          // After auth initialization, check if the user is actually authenticated
          // and update the hasInitializedThisSession accordingly
          if (useAuthStore.getState().isAuthenticated) {
            setHasInitializedThisSession(true);
            localStorage.setItem("sweldo_session_initialized", "true");
          }
        })
        .catch((error) => {
          console.error("[Layout] Error initializing auth:", error);
        });
    });
  }, [
    isInitialized,
    dbPath,
    companyName,
    initializeAuth,
  ]);

  const [lastActivity, setLastActivity] = useState(Date.now());

  // Handle session timeout
  useEffect(() => {
    if (!isAuthenticated) return;

    // Use a less frequent interval (every minute instead of constantly)
    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;

      if (timeSinceLastActivity >= SESSION_TIMEOUT) {
        logout();
        setShowLogin(true);
        hasCheckedRoles.current = false; // Reset roles check on session timeout
      }
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, lastActivity, logout]);

  // Track user activity
  useEffect(() => {
    if (!isAuthenticated) return;

    // CRITICAL FIX: Debounce activity updates to prevent blocking keyboard input
    let activityTimeout: NodeJS.Timeout | null = null;
    
    const updateActivity = () => {
      const now = Date.now();
      setLastActivity(now);
      
      // Debounce auth store updates to prevent file I/O blocking keyboard events
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      
      activityTimeout = setTimeout(() => {
        useAuthStore.getState().updateLastActivity();
      }, 100); // 100ms debounce
    };

    // CRITICAL FIX: Use passive listeners to improve performance and prevent event blocking
    const options = { passive: true };

    // Track various user activities
    window.addEventListener("mousemove", updateActivity, options);
    window.addEventListener("mousedown", updateActivity);
    window.addEventListener("keydown", updateActivity);
    window.addEventListener("scroll", updateActivity, options);
    window.addEventListener("touchstart", updateActivity, options);

    return () => {
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      window.removeEventListener("mousemove", updateActivity);
      window.removeEventListener("mousedown", updateActivity);
      window.removeEventListener("keydown", updateActivity);
      window.removeEventListener("scroll", updateActivity);
      window.removeEventListener("touchstart", updateActivity);
    };
  }, [isAuthenticated]);

  // Add useEffect to set hasMounted after component mounts on client
  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    // Only reset loading on subsequent route changes
    setLoading(false);
  }, [pathname]);

  // Check if we need to show the login dialog to select a company in web mode
  useEffect(() => {
    // Only applicable in web mode when the user is authenticated
    if (isWebEnvironment() && isAuthenticated && isInitialized && !isCheckingRoles) {
      // If no company name is set, show the login dialog
      if (!companyName) {
        console.log("[Layout] Web mode: No company name set, showing login dialog to select company");
        setShowLogin(true);
      } else {
        // Company name is set, no need to show login dialog
        setShowLogin(false);
      }
    }
  }, [isAuthenticated, companyName, isInitialized, isCheckingRoles]);

  // Role checking and login prompt logic
  useEffect(() => {
    // Check if auth store is initialized and we're authenticated already
    const isAuthStoreInitialized = useAuthStore.getState().isAuthInitialized;
    const isUserAuthenticated = useAuthStore.getState().isAuthenticated;

    // If auth store is initialized and the user is authenticated, we can skip role checking
    if (isAuthStoreInitialized && isUserAuthenticated) {
      setIsCheckingRoles(false);
      hasCheckedRoles.current = true;
      setHasInitializedThisSession(true);
      localStorage.setItem("sweldo_session_initialized", "true");
      return;
    }

    // Check localStorage for the initialization flag
    const isInitializedInLocalStorage =
      localStorage.getItem("sweldo_session_initialized") === "true";

    // If we're already initialized per localStorage, skip everything and make sure we're not in loading state
    if (isInitializedInLocalStorage && isAuthStoreInitialized) {
      // Silent - don't even log since this happens on every navigation
      if (isCheckingRoles) {
        setIsCheckingRoles(false);
      }
      if (!hasInitializedThisSession) {
        setHasInitializedThisSession(true);
      }
      hasCheckedRoles.current = true;
      return;
    }

    // Skip if we've already initialized this session
    if (hasInitializedThisSession) {
      // Only log once to avoid console spam
      if (!isRoleCheckingRef.current) {
        // (removed debug log)
      }
      setIsCheckingRoles(false);
      return;
    }

    // Skip unnecessary checks
    if (!isInitialized || (!dbPath && !isWebEnvironment())) {
      // (removed debug log)
      setIsCheckingRoles(false);
      return;
    }

    // Handle web mode immediately
    if (isWebEnvironment()) {
      if (!isAuthenticated) {
        setShowLogin(true);
      }
      setIsCheckingRoles(false);
      hasCheckedRoles.current = true;
      setHasInitializedThisSession(true);
      return;
    }

    // Skip if we've already checked roles and user is authenticated
    if (hasCheckedRoles.current && isAuthenticated) {
      // (removed debug log)
      setIsCheckingRoles(false);
      return;
    }

    // Prevent multiple simultaneous checks
    if (isCheckingRoles || isRoleCheckingRef.current) {
      // (removed debug log)
      return;
    }

    const checkRolesAndAuth = async () => {
      isRoleCheckingRef.current = true;
      // (removed debug log)
      try {
        // Local Nextron implementation continues below
        // (removed debug log)
        const roleModel = new RoleModelImpl(dbPath);

        // (removed debug log)
        const sweldoPath = path.join(dbPath, "SweldoDB");
        await window.electron.ensureDir(sweldoPath);

        // (removed debug log)
        const roles = await roleModel.getRoles();
        // (removed debug log)

        if (roles.length === 0) {
          // (removed debug log)
          toast.error("No roles found. Please create an admin role first.");
          router.push("/settings");
        } else if (!isAuthenticated) {
          // (removed debug log)
          setShowLogin(true);
        }

        hasCheckedRoles.current = true;
        // Mark as initialized for this session
        setHasInitializedThisSession(true);
      } catch (error) {
        console.error("[Layout] Error checking roles:", error);

        // Handle the error by setting error state and also ensuring we exit the loading state
        setInitError(
          "Error checking roles. Please check your database path and try again."
        );

        // Reset the flag so we can try again
        hasCheckedRoles.current = false;
      } finally {
        // (removed debug log)
        // Ensure we always exit the checking state
        setIsCheckingRoles(false);
        isRoleCheckingRef.current = false;
      }
    };

    console.log("[DEBUG] Setting isCheckingRoles to true");
    setIsCheckingRoles(true);
    // Use a slight delay to allow state updates to propagate
    setTimeout(() => {
      checkRolesAndAuth();
    }, 100);

    // Clean-up function to handle component unmount
    return () => {
      // (removed debug log)
    };
  }, [dbPath, isAuthenticated, router, isInitialized, resetCount]);

  // Final app render - avoid excessive logging
  const mainContent = (
    <div className="min-h-screen bg-background font-sans">
      <LoadingBar />
      <Navbar />
      <main
        className={`max-w-12xl ${pathname?.startsWith("/timesheet") ? "" : "mx-auto px-4 pt-4"
          }`}
      >
        <RefreshWrapper>{children}</RefreshWrapper>
        <Toaster position="top-right" richColors />
      </main>
    </div>
  );

  // **** NEW: Always render placeholder/spinner initially before mount ****
  if (!hasMounted) {
    return (
      <div className="min-h-screen bg-background font-sans flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600 mx-auto"></div>
          <div className="text-gray-600">Initializing application...</div>
          {/* Optional: Keep reset button if helpful during loading */}
          {/* <button onClick={forceReset} className="mt-4 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">Reset (Stuck?)</button> */}
        </div>
        <Toaster position="top-right" richColors />
      </div>
    );
  }
  // **** END NEW ****

  // Show loading state while checking roles - Original logic modified (removed localStorage check)
  // Now this runs *after* hasMounted is true
  const isInitializedInLocalStorage = (() => {
    try {
      return localStorage.getItem("sweldo_session_initialized") === "true";
    } catch (e) {
      return false;
    }
  })();

  // REMOVED this block as it's now handled by the !hasMounted check above
  /*
  if (
    isCheckingRoles &&
    !hasInitializedThisSession &&
    !isInitializedInLocalStorage
  ) {
    return (
      <div className="min-h-screen bg-background font-sans flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600 mx-auto"></div>
          <div className="text-gray-600">Initializing application...</div>
          <button
            onClick={forceReset}
            className="mt-4 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reset (Stuck?)
          </button>
        </div>
        <Toaster position="top-right" richColors />
      </div>
    );
  }
  */

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

  // ***** WEB MODE COMPANY CHECK - HIGH PRIORITY *****
  // If in web mode and authenticated but no company selected, ALWAYS show login dialog for company selection
  if (isWebEnvironment() && isAuthenticated && isInitialized && !companyName) {
    console.log("[Layout] CRITICAL: No company selected in web mode, forcing company selection dialog");

    return (
      <div className="min-h-screen bg-background font-sans">
        <Toaster position="top-right" richColors />
        <LoginDialog
          onSuccess={() => {
            setShowLogin(false);
            hasCheckedRoles.current = true;
            setHasInitializedThisSession(true);
          }}
        />
      </div>
    );
  }

  // Show login dialog when authentication is required or when we need to select a company in web mode
  if (
    showLogin &&
    !isCheckingRoles &&
    (
      !isAuthenticated ||
      (isWebEnvironment() && !companyName) // Also show login when in web mode and no company selected
    ) &&
    (isWebEnvironment() || dbPath || pathname === "/settings")
  ) {
    // (removed debug log)
    return (
      <div className="min-h-screen bg-background font-sans">
        <Toaster position="top-right" richColors />
        <LoginDialog
          onSuccess={() => {
            // (removed debug log)
            setShowLogin(false);
            // Ensure all state is properly updated after login
            hasCheckedRoles.current = true;
            setHasInitializedThisSession(true);
          }}
        />
      </div>
    );
  }

  // If no dbPath and not on settings page, show redirect message - ONLY AFTER MOUNTING
  if (
    hasMounted &&
    !dbPath &&
    !pathname?.startsWith("/settings") &&
    !isWebEnvironment()
  ) {
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

  return mainContent;
}

export default memo(RootLayout);
