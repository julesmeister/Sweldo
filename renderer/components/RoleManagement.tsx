import React from "react";
import {
  IoShieldOutline,
  IoAddOutline,
  IoTrashOutline,
  IoKeyOutline,
  IoEyeOutline,
  IoEyeOffOutline,
  IoLockClosedOutline,
} from "react-icons/io5";
import { toast } from "sonner";
import { Role, RoleModel } from "../model/role";
import { decryptPinCode } from "../lib/encryption";
import { useAuthStore } from "../stores/authStore";

interface RoleManagementProps {
  roleModel: RoleModel;
}

const DEFAULT_ACCESS_CODES = [
  "VIEW_TIMESHEETS",
  "MANAGE_EMPLOYEES",
  "MANAGE_PAYROLL",
  "MANAGE_ATTENDANCE",
  "MANAGE_LEAVES",
  "MANAGE_LOANS",
  "MANAGE_SETTINGS",
  "GENERATE_REPORTS",
  "VIEW_REPORTS",
  "APPROVE_REQUESTS",
];

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

export default function RoleManagement({ roleModel }: RoleManagementProps) {
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = React.useState<Role | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [showPinCode, setShowPinCode] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    pinCode: "",
    description: "",
    accessCodes: [] as string[],
  });

  // Session management
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [authPinCode, setAuthPinCode] = React.useState("");
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const [hasRoles, setHasRoles] = React.useState(false);
  const sessionTimeoutRef = React.useRef<NodeJS.Timeout>();
  const lastActivityRef = React.useRef<number>(Date.now());

  // Load roles on initial mount to check if any exist
  React.useEffect(() => {
    const checkRoles = async () => {
      try {
        console.log(
          "[RoleManagement] Checking roles with roleModel:",
          roleModel
        );
        const loadedRoles = await roleModel.getRoles();
        console.log("[RoleManagement] Initial roles check:", loadedRoles);
        setHasRoles(loadedRoles.length > 0);
        if (loadedRoles.length === 0) {
          console.log("[RoleManagement] No roles found, auto-authenticating");
          setIsAuthenticated(true); // Auto-authenticate if no roles exist
          setIsEditing(true); // Start in editing mode
        }
        setIsInitialLoad(false);
      } catch (error) {
        console.error("[RoleManagement] Error checking roles:", error);
        setIsInitialLoad(false);
      }
    };
    checkRoles();
  }, [roleModel]);

  const resetSession = React.useCallback(() => {
    setIsAuthenticated(false);
    setAuthPinCode("");
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
  }, []);

  const handleActivity = React.useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Check for inactivity
  React.useEffect(() => {
    const checkInactivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current >= SESSION_TIMEOUT) {
        resetSession();
        toast.info("Session expired due to inactivity");
      }
    };

    const interval = setInterval(checkInactivity, 1000);
    return () => clearInterval(interval);
  }, [resetSession]);

  // Add activity listeners
  React.useEffect(() => {
    const events = [
      "mousedown",
      "keydown",
      "scroll",
      "mousemove",
      "touchstart",
    ];
    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [handleActivity]);

  const handleAuthenticate = async () => {
    try {
      console.log(
        "[RoleManagement] Attempting authentication with PIN:",
        authPinCode
      );
      const roles = await roleModel.getRoles();
      console.log("[RoleManagement] Found roles for auth:", roles);
      // Try to find a role with matching PIN
      const role = roles.find((r) => {
        return r.pinCode === authPinCode;
      });

      if (role) {
        console.log("[RoleManagement] Authentication successful");
        setIsAuthenticated(true);
        toast.success("Successfully authenticated");
        loadRoles();
      } else {
        console.log("[RoleManagement] Authentication failed: Invalid PIN");
        toast.error("Invalid pin code");
      }
      setAuthPinCode("");
    } catch (error) {
      console.error("[RoleManagement] Authentication error:", error);
      toast.error("Authentication failed");
    }
  };

  const loadRoles = React.useCallback(async () => {
    try {
      console.log("[RoleManagement] Loading roles...");
      const loadedRoles = await roleModel.getRoles();
      console.log("[RoleManagement] Loaded roles:", loadedRoles);
      setRoles(loadedRoles);
      setHasRoles(loadedRoles.length > 0);
    } catch (error) {
      console.error("[RoleManagement] Error loading roles:", error);
      toast.error("Failed to load roles");
    }
  }, [roleModel]);

  React.useEffect(() => {
    console.log(
      "[RoleManagement] Authentication state changed:",
      isAuthenticated
    );
    if (isAuthenticated) {
      loadRoles();
    }
  }, [loadRoles, isAuthenticated]);

  const handleCreateRole = async () => {
    try {
      if (!formData.name.trim()) {
        toast.error("Role name is required");
        return;
      }

      if (!formData.pinCode || formData.pinCode.length < 4) {
        toast.error("Pin code must be at least 4 digits");
        return;
      }

      console.log("[RoleManagement] Creating new role:", formData.name);
      await roleModel.createRole({
        name: formData.name,
        pinCode: formData.pinCode,
        description: formData.description,
        accessCodes: formData.accessCodes,
      });

      toast.success("Role created successfully");
      await loadRoles(); // Make sure to await the loadRoles call
      setFormData({ name: "", pinCode: "", description: "", accessCodes: [] });
    } catch (error) {
      console.error("[RoleManagement] Error creating role:", error);
      toast.error("Failed to create role");
    }
  };

  const handleUpdateRole = async () => {
    try {
      if (!selectedRole || !formData.name.trim()) {
        toast.error("Role name is required");
        return;
      }

      if (formData.pinCode && formData.pinCode.length < 4) {
        toast.error("Pin code must be at least 4 digits");
        return;
      }

      await roleModel.updateRole(selectedRole.id, {
        name: formData.name,
        ...(formData.pinCode && { pinCode: formData.pinCode }),
        description: formData.description,
        accessCodes: formData.accessCodes,
      });

      toast.success("Role updated successfully");
      loadRoles();

      setSelectedRole(null);
      setIsEditing(false);
      setFormData({ name: "", pinCode: "", description: "", accessCodes: [] });
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;

    try {
      await roleModel.deleteRole(id);
      toast.success("Role deleted successfully");
      loadRoles();
      if (selectedRole?.id === id) {
        setSelectedRole(null);
        setIsEditing(false);
        setFormData({
          name: "",
          pinCode: "",
          description: "",
          accessCodes: [],
        });
      }
    } catch (error) {
      console.error("Error deleting role:", error);
      toast.error("Failed to delete role");
    }
  };

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      pinCode: "", // Don't show existing pin code for security
      description: role.description || "",
      accessCodes: role.accessCodes,
    });
    setIsEditing(false);
    setShowPinCode(false);
  };

  // Add this handler function
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAuthenticate();
    }
  };

  // Show loading state while checking for roles
  if (isInitialLoad) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show authentication screen only if roles exist and user is not authenticated
  if (hasRoles && !isAuthenticated) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-full max-w-md space-y-8 p-8 bg-white rounded-2xl border border-gray-200/50 shadow-lg">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
              <IoLockClosedOutline className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Authentication Required
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Please enter your pin code to access role management
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Pin Code
              </label>
              <div className="mt-1 relative">
                <input
                  type={showPinCode ? "text" : "password"}
                  value={authPinCode}
                  onChange={(e) => setAuthPinCode(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="block w-full rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 sm:text-sm h-10 px-3"
                  placeholder="Enter pin code..."
                />
                <button
                  type="button"
                  onClick={() => setShowPinCode(!showPinCode)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                >
                  {showPinCode ? (
                    <IoEyeOffOutline className="w-5 h-5" />
                  ) : (
                    <IoEyeOutline className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={handleAuthenticate}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
            >
              Authenticate
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-b from-gray-50 to-white rounded-2xl border border-gray-200/50 shadow-lg shadow-gray-200/20">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <IoShieldOutline className="w-6 h-6 text-blue-600" />
              </div>
              Role Management
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={resetSession}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-200 border border-gray-200"
              >
                <IoLockClosedOutline className="w-5 h-5" />
                Lock
              </button>
              <button
                onClick={() => {
                  setSelectedRole(null);
                  setIsEditing(true);
                  setFormData({
                    name: "",
                    pinCode: "",
                    description: "",
                    accessCodes: [],
                  });
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all duration-200 border border-blue-100 hover:border-blue-200"
              >
                <IoAddOutline className="w-5 h-5" />
                Add Role
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* Role List */}
            <div className="col-span-4 space-y-4">
              {roles.map((role) => (
                <div
                  key={role.id}
                  onClick={() => handleRoleSelect(role)}
                  className={`group cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 ${selectedRole?.id === role.id
                    ? "border-blue-500 bg-blue-50/30 shadow-lg shadow-blue-100"
                    : "border-gray-200 hover:border-blue-300 bg-white"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{role.name}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {role.accessCodes.length} permissions
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRole(role.id);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <IoTrashOutline className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Role Details/Form */}
            <div className="col-span-8">
              <div className="bg-white rounded-xl border border-gray-200/50 p-6 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Role Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      disabled={!isEditing && !selectedRole}
                      className="mt-1 block w-full rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 sm:text-sm h-10 px-3"
                      placeholder="Enter role name..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Pin Code{" "}
                      {selectedRole && "(Leave empty to keep current pin)"}
                    </label>
                    <div className="mt-1 relative">
                      <input
                        type={showPinCode ? "text" : "password"}
                        value={formData.pinCode}
                        onChange={(e) =>
                          setFormData({ ...formData, pinCode: e.target.value })
                        }
                        disabled={!isEditing && !selectedRole}
                        className="block w-full rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 sm:text-sm h-10 px-3"
                        placeholder={
                          selectedRole
                            ? "Enter new pin code..."
                            : "Enter pin code..."
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowPinCode(!showPinCode)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPinCode ? (
                          <IoEyeOffOutline className="w-5 h-5" />
                        ) : (
                          <IoEyeOutline className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      disabled={!isEditing && !selectedRole}
                      className="mt-1 block w-full rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 sm:text-sm p-3"
                      rows={3}
                      placeholder="Enter role description..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Access Permissions
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {DEFAULT_ACCESS_CODES.map((code) => (
                        <label
                          key={code}
                          className={`relative flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 ${!isEditing && !selectedRole
                            ? "bg-gray-50 cursor-not-allowed border-gray-200"
                            : formData.accessCodes.includes(code)
                              ? "border-blue-500 bg-blue-50/50 shadow-sm"
                              : "border-gray-200 hover:border-blue-300"
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.accessCodes.includes(code)}
                            onChange={(e) => {
                              if (!isEditing && !selectedRole) return;
                              setFormData({
                                ...formData,
                                accessCodes: e.target.checked
                                  ? [...formData.accessCodes, code]
                                  : formData.accessCodes.filter(
                                    (c) => c !== code
                                  ),
                              });
                            }}
                            disabled={!isEditing && !selectedRole}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all duration-200"
                          />
                          <div className="flex items-center gap-2">
                            <IoKeyOutline
                              className={`w-4 h-4 ${formData.accessCodes.includes(code)
                                ? "text-blue-600"
                                : "text-gray-400"
                                }`}
                            />
                            <span className="text-sm font-medium text-gray-700">
                              {code}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {(isEditing || selectedRole) && (
                  <div className="pt-4 flex gap-3">
                    {selectedRole ? (
                      <>
                        <button
                          onClick={() => {
                            if (isEditing) {
                              handleUpdateRole();
                            } else {
                              setIsEditing(true);
                            }
                          }}
                          className="flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                        >
                          {isEditing ? "Save Changes" : "Edit Role"}
                        </button>
                        {isEditing && (
                          <button
                            onClick={() => {
                              setIsEditing(false);
                              setFormData({
                                name: selectedRole.name,
                                pinCode: "",
                                description: selectedRole.description || "",
                                accessCodes: selectedRole.accessCodes,
                              });
                            }}
                            className="flex-1 flex justify-center py-2.5 px-4 border-2 border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
                          >
                            Cancel
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={handleCreateRole}
                        className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                      >
                        Create Role
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
