import { create } from "zustand";
// import { persist } from "zustand/middleware"; // Remove persist
import { Role, RoleModelImpl } from "../model/role";
import { decryptPinCode } from "../lib/encryption";
import { useSettingsStore } from "./settingsStore"; // Keep for dbPath access
import { toast } from "sonner";

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

// Define the shape of the auth state to be saved
interface PersistedAuthState {
  currentRole: Role | null;
  isAuthenticated: boolean;
  accessCodes: string[];
  lastActivity: number;
}

interface AuthState extends PersistedAuthState {
  isAuthInitialized: boolean; // Track initialization status
  login: (pinCode: string) => Promise<boolean>;
  logout: () => void;
  hasAccess: (requiredCode: string) => boolean;
  checkSession: () => boolean;
  updateLastActivity: () => void;
  initializeAuth: () => Promise<void>; // New initializer
}

const defaultAuthState: PersistedAuthState = {
  currentRole: null,
  isAuthenticated: false,
  accessCodes: [],
  lastActivity: 0,
};

const authStateFilePath = (dbPath: string): string =>
  `${dbPath}/SweldoDB/settings/auth_state.json`;

export const useAuthStore = create<AuthState>()((set, get) => {
  // Internal helper to save auth state to file
  const _saveAuthState = async () => {
    const dbPath = useSettingsStore.getState().dbPath;
    if (!dbPath) {
      console.warn("Cannot save auth state: dbPath is not set.");
      return;
    }

    const state = get();
    const stateToSave: PersistedAuthState = {
      currentRole: state.currentRole,
      isAuthenticated: state.isAuthenticated,
      accessCodes: state.accessCodes,
      lastActivity: state.lastActivity,
    };

    const filePath = authStateFilePath(dbPath);
    const dirPath = `${dbPath}/SweldoDB/settings`;

    try {
      await window.electron.ensureDir(dirPath);
      await window.electron.writeFile(
        filePath,
        JSON.stringify(stateToSave, null, 2)
      );
      console.log("Auth state saved to:", filePath);
    } catch (error) {
      console.error("Failed to save auth state to file:", filePath, error);
      // toast.error("Failed to save session state.");
    }
  };

  return {
    ...defaultAuthState,
    isAuthInitialized: false,

    initializeAuth: async () => {
      if (get().isAuthInitialized) return;
      console.log("Initializing auth store from file...");

      const dbPath = useSettingsStore.getState().dbPath;
      let loadedState = { ...defaultAuthState };

      if (dbPath) {
        const filePath = authStateFilePath(dbPath);
        console.log("Attempting to load auth state from:", filePath);
        try {
          const fileExists = await window.electron.fileExists(filePath);
          if (fileExists) {
            const fileContent = await window.electron.readFile(filePath);
            const parsedState = JSON.parse(fileContent);
            // Basic validation?
            loadedState = { ...defaultAuthState, ...parsedState };
            console.log("Auth state loaded.");

            // Check if the loaded session is still valid
            const now = Date.now();
            const timeSinceLastActivity = now - loadedState.lastActivity;
            const isSessionValid = timeSinceLastActivity < SESSION_TIMEOUT;

            if (!isSessionValid && loadedState.isAuthenticated) {
              console.log("Loaded auth session expired, logging out.");
              loadedState = { ...defaultAuthState }; // Reset to default (logged out)
            } else {
              console.log("Loaded auth session is valid.");
            }
          } else {
            console.log(
              "Auth state file not found, using defaults (logged out)."
            );
          }
        } catch (error) {
          console.error(
            "Error loading or parsing auth state file, using defaults:",
            error
          );
          // Reset to default on error
          loadedState = { ...defaultAuthState };
        }
      } else {
        console.warn(
          "Cannot initialize auth store: dbPath not available from settings store."
        );
        // Stay logged out if dbPath isn't ready
      }

      set({ ...loadedState, isAuthInitialized: true });

      // Save initial state (handles case where file didn't exist or session expired)
      await _saveAuthState();
    },

    checkSession: () => {
      const { lastActivity, isAuthenticated, logout, isAuthInitialized } =
        get();
      // Important: Don't check session if store hasn't been initialized from file yet
      if (!isAuthInitialized || !isAuthenticated) return false;

      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;
      const isSessionValid = timeSinceLastActivity < SESSION_TIMEOUT;

      if (!isSessionValid) {
        console.log("Session expired during checkSession, logging out.");
        // Use timeout to avoid infinite loops if checkSession is called within logout
        setTimeout(logout, 0);
        return false;
      }

      return true;
    },

    updateLastActivity: () => {
      set({ lastActivity: Date.now() });
      _saveAuthState(); // Save state when activity is updated
    },

    login: async (pinToMatch: string) => {
      const dbPath = useSettingsStore.getState().dbPath;
      if (!dbPath) {
        toast.error("Cannot login: Database path not set.");
        return false;
      }
      if (!pinToMatch) {
        toast.error("No PIN code provided");
        return false;
      }

      try {
        const roleModel = new RoleModelImpl(dbPath);
        const roles = await roleModel.getRoles();
        if (roles.length === 0) {
          toast.error("No roles found. Please create an admin role first.");
          return false;
        }

        const matchedRole = roles.find((role) => {
          try {
            return decryptPinCode(role.pinCode) === pinToMatch;
          } catch (error) {
            return false;
          }
        });

        if (matchedRole) {
          set({
            currentRole: matchedRole,
            isAuthenticated: true,
            accessCodes: matchedRole.accessCodes,
            lastActivity: Date.now(),
          });
          await _saveAuthState(); // Save state after successful login
          toast.success("Login successful!");
          return true;
        }

        toast.error("Invalid PIN code");
        return false;
      } catch (error) {
        toast.error("Login error", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        return false;
      }
    },

    logout: () => {
      const { isAuthenticated } = get();
      if (isAuthenticated) {
        set({
          ...defaultAuthState, // Reset to default logged-out state
          isAuthInitialized: get().isAuthInitialized, // Keep initialized flag
          lastActivity: 0, // Set last activity to 0 or Date.now()?
        });
        _saveAuthState(); // Save the logged-out state
        toast.info("Logged out"); // Adjusted message
      }
    },

    hasAccess: async (requiredCode: string) => {
      const { currentRole, checkSession } = get();

      if (!checkSession() || !currentRole) {
        return false;
      }

      // Re-fetch the role data on every check to ensure it's up-to-date
      const dbPath = useSettingsStore.getState().dbPath;
      if (!dbPath) {
        console.error("hasAccess check failed: dbPath not set.");
        return false; // Cannot check without dbPath
      }

      try {
        const roleModel = new RoleModelImpl(dbPath);
        const latestRoleData = await roleModel.getRoleById(currentRole.id);

        if (!latestRoleData) {
          console.warn(
            `hasAccess check failed: Role with ID ${currentRole.id} not found.`
          );
          // Maybe logout if the role doesn't exist anymore?
          get().logout();
          return false;
        }

        // Perform the check against the *latest* access codes
        return latestRoleData.accessCodes.includes(requiredCode);
      } catch (error) {
        console.error(
          "Error fetching role data during hasAccess check:",
          error
        );
        return false; // Fail safe
      }
    },
  };
});
