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
  // Track last saved state to avoid unnecessary writes
  let lastSavedState: string = "";

  // Internal helper to save auth state to file
  const _saveAuthState = async () => {
    const dbPath = useSettingsStore.getState().dbPath;
    if (!dbPath) {
      // Don't save without a valid dbPath
      return;
    }

    const state = get();
    const stateToSave: PersistedAuthState = {
      currentRole: state.currentRole,
      isAuthenticated: state.isAuthenticated,
      accessCodes: state.accessCodes,
      lastActivity: state.lastActivity,
    };

    // Only save if state has actually changed
    const stateJson = JSON.stringify(stateToSave);
    if (stateJson === lastSavedState) {
      return;
    }

    lastSavedState = stateJson;
    const filePath = authStateFilePath(dbPath);
    const dirPath = `${dbPath}/SweldoDB/settings`;

    try {
      await window.electron.ensureDir(dirPath);
      await window.electron.writeFile(
        filePath,
        JSON.stringify(stateToSave, null, 2)
      );
    } catch (error) {
      console.error("Failed to save auth state to file:", error);
    }
  };

  return {
    ...defaultAuthState,
    isAuthInitialized: false,

    initializeAuth: async () => {
      if (get().isAuthInitialized) {
        return;
      }

      const dbPath = useSettingsStore.getState().dbPath;
      try {
        let loadedState = { ...defaultAuthState };

        if (dbPath) {
          const filePath = authStateFilePath(dbPath);
          try {
            const fileExists = await window.electron.fileExists(filePath);
            if (fileExists) {
              const fileContent = await window.electron.readFile(filePath);
              const parsedState = JSON.parse(fileContent);
              loadedState = { ...defaultAuthState, ...parsedState };

              const now = Date.now();
              const timeSinceLastActivity = now - loadedState.lastActivity;
              const isSessionValid = timeSinceLastActivity < SESSION_TIMEOUT;

              if (!isSessionValid && loadedState.isAuthenticated) {
                loadedState = { ...defaultAuthState };
              }
            }
          } catch (error) {
            console.error(
              "Error loading or parsing auth state file, using defaults:",
              error
            );
            loadedState = { ...defaultAuthState };
          }
        }

        set({ ...loadedState, isAuthInitialized: true });

        // Set initial saved state to avoid unnecessary writes
        lastSavedState = JSON.stringify({
          currentRole: loadedState.currentRole,
          isAuthenticated: loadedState.isAuthenticated,
          accessCodes: loadedState.accessCodes,
          lastActivity: loadedState.lastActivity,
        });

        await _saveAuthState();
      } catch (initError) {
        console.error(
          "[AuthStore Init] CRITICAL ERROR during initialization:",
          initError
        );
        set({ ...defaultAuthState, isAuthInitialized: true });
      }
    },

    checkSession: () => {
      const { lastActivity, isAuthenticated, logout, isAuthInitialized } =
        get();

      // Important: Don't check session if store hasn't been initialized from file yet
      if (!isAuthInitialized || !isAuthenticated) {
        return false;
      }

      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;
      const isSessionValid = timeSinceLastActivity < SESSION_TIMEOUT;

      if (!isSessionValid) {
        console.log("Session expired during checkSession, logging out.");
        setTimeout(logout, 0);
        return false;
      }

      return true;
    },

    updateLastActivity: () => {
      const currentLastActivity = get().lastActivity;
      const now = Date.now();

      // Only update if time has changed significantly (more than 1 minute)
      if (now - currentLastActivity > 60000) {
        set({ lastActivity: now });
        _saveAuthState();
      }
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
          // Directly compare the already decrypted pinCode from getRoles()
          return role.pinCode === pinToMatch;
        });

        if (matchedRole) {
          set({
            currentRole: matchedRole,
            isAuthenticated: true,
            accessCodes: matchedRole.accessCodes,
            lastActivity: Date.now(),
          });
          await _saveAuthState();
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
          ...defaultAuthState,
          isAuthInitialized: get().isAuthInitialized,
          lastActivity: 0,
        });
        _saveAuthState();
        toast.info("Logged out");
      }
    },

    hasAccess: (requiredCode: string): boolean => {
      const { currentRole, checkSession, accessCodes } = get();

      if (!checkSession()) {
        return false;
      }

      return accessCodes.includes(requiredCode);
    },
  };
});
