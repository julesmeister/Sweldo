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
      // console.log(`[AuthStore Init] Attempting initialization. Already initialized: ${get().isAuthInitialized}`);
      if (get().isAuthInitialized) {
        // console.log("[AuthStore Init] Skipping, already initialized.");
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

      // console.log(`[checkSession] Running: isAuthInitialized=${isAuthInitialized}, isAuthenticated=${isAuthenticated}`);

      // Important: Don't check session if store hasn't been initialized from file yet
      if (!isAuthInitialized || !isAuthenticated) {
        // console.log(`[checkSession] Returning false (init=${isAuthInitialized}, auth=${isAuthenticated})`);
        return false;
      }

      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;
      const isSessionValid = timeSinceLastActivity < SESSION_TIMEOUT;

      // console.log(`[checkSession] Time check: now=${now}, lastActivity=${lastActivity}, diff=${timeSinceLastActivity}, timeout=${SESSION_TIMEOUT}, valid=${isSessionValid}`);

      if (!isSessionValid) {
        // console.log("[checkSession] Returning false (Session expired)");
        console.log("Session expired during checkSession, logging out.");
        setTimeout(logout, 0);
        return false;
      }

      // console.log("[checkSession] Returning true (Session valid)");
      return true;
    },

    updateLastActivity: () => {
      set({ lastActivity: Date.now() });
      _saveAuthState();
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

      // Directly use the accessCodes from the state (set during login)
      // console.log(`Checking access for '${requiredCode}'. Current role: ${currentRole?.name}. Available codes:`, accessCodes);
      return accessCodes.includes(requiredCode);
    },
  };
});
