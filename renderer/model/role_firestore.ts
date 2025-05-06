/**
 * Firestore implementation for role management operations
 *
 * This module provides Firestore implementations for all role-related
 * operations that mirror the local filesystem operations in role.ts.
 */

import { Role, RoleModel } from "./role";
import { encryptPinCode, decryptPinCode } from "../lib/encryption";
import {
  fetchDocument,
  saveDocument,
  updateDocument,
  getCompanyName,
} from "../lib/firestoreService";

/**
 * Firestore structure for roles document
 */
interface RolesFirestoreData {
  meta: {
    lastModified: string;
  };
  roles: Role[];
}

/**
 * The document ID for the roles collection
 */
const ROLES_DOC_ID = "roles_data";

/**
 * Load all roles from Firestore
 */
export async function getRolesFirestore(companyName: string): Promise<Role[]> {
  try {
    const data = await fetchDocument<RolesFirestoreData>(
      "roles",
      ROLES_DOC_ID,
      companyName
    );

    if (!data || !data.roles || !Array.isArray(data.roles)) {
      return [];
    }

    // Return roles with decrypted PIN codes
    return data.roles.map((role) => ({
      ...role,
      pinCode: decryptPinCode(role.pinCode),
      createdAt:
        role.createdAt instanceof Date
          ? role.createdAt
          : new Date(role.createdAt),
      updatedAt:
        role.updatedAt instanceof Date
          ? role.updatedAt
          : new Date(role.updatedAt),
    }));
  } catch (error) {
    console.error(`Error loading roles from Firestore:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Create a new role in Firestore
 */
export async function createRoleFirestore(
  roleInput: Omit<Role, "id" | "createdAt" | "updatedAt">,
  companyName: string
): Promise<Role> {
  try {
    // Get existing roles document or create a new one
    const existingData = await fetchDocument<RolesFirestoreData>(
      "roles",
      ROLES_DOC_ID,
      companyName
    );

    // Encrypt the PIN code before storing
    const encryptedPinCode = encryptPinCode(roleInput.pinCode);

    // Create the new role with encrypted PIN
    const newRole: Role = {
      ...roleInput,
      id: crypto.randomUUID(),
      pinCode: encryptedPinCode,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!existingData) {
      // Create a new document if it doesn't exist
      const newData: RolesFirestoreData = {
        meta: {
          lastModified: new Date().toISOString(),
        },
        roles: [newRole],
      };

      await saveDocument("roles", ROLES_DOC_ID, newData, companyName);
    } else {
      // Add the new role to existing roles
      const updatedRoles = [...existingData.roles, newRole];

      // Update the document
      await updateDocument(
        "roles",
        ROLES_DOC_ID,
        {
          roles: updatedRoles,
          "meta.lastModified": new Date().toISOString(),
        },
        companyName
      );
    }

    // Return with the original (decrypted) PIN for immediate use
    return {
      ...newRole,
      pinCode: roleInput.pinCode,
    };
  } catch (error) {
    console.error(`Error creating role in Firestore:`, error);
    throw error;
  }
}

/**
 * Update a role in Firestore
 */
export async function updateRoleFirestore(
  id: string,
  roleUpdate: Partial<Omit<Role, "id" | "createdAt" | "updatedAt">>,
  companyName: string
): Promise<Role> {
  try {
    const existingData = await fetchDocument<RolesFirestoreData>(
      "roles",
      ROLES_DOC_ID,
      companyName
    );

    if (!existingData || !existingData.roles) {
      throw new Error("Roles data not found in Firestore");
    }

    const roleIndex = existingData.roles.findIndex((r) => r.id === id);
    if (roleIndex === -1) {
      throw new Error(`Role with id ${id} not found in Firestore`);
    }

    const existingRole = existingData.roles[roleIndex];

    // Encrypt new PIN if provided
    const encryptedPinCode = roleUpdate.pinCode
      ? encryptPinCode(roleUpdate.pinCode)
      : existingRole.pinCode;

    // Create updated role object
    const updatedRole: Role = {
      ...existingRole,
      ...roleUpdate,
      pinCode: encryptedPinCode,
      updatedAt: new Date(),
    };

    // Update the role in the array
    const updatedRoles = [...existingData.roles];
    updatedRoles[roleIndex] = updatedRole;

    // Update the document in Firestore
    await updateDocument(
      "roles",
      ROLES_DOC_ID,
      {
        roles: updatedRoles,
        "meta.lastModified": new Date().toISOString(),
      },
      companyName
    );

    // Return the role with decrypted PIN for immediate use
    return {
      ...updatedRole,
      pinCode: roleUpdate.pinCode || decryptPinCode(updatedRole.pinCode),
    };
  } catch (error) {
    console.error(`Error updating role in Firestore:`, error);
    throw error;
  }
}

/**
 * Delete a role from Firestore
 */
export async function deleteRoleFirestore(
  id: string,
  companyName: string
): Promise<void> {
  try {
    const existingData = await fetchDocument<RolesFirestoreData>(
      "roles",
      ROLES_DOC_ID,
      companyName
    );

    if (!existingData || !existingData.roles) {
      console.warn(
        `Roles data not found in Firestore when deleting role ${id}`
      );
      return;
    }

    const initialLength = existingData.roles.length;
    const updatedRoles = existingData.roles.filter((role) => role.id !== id);

    if (updatedRoles.length === initialLength) {
      console.warn(`Role with id ${id} not found in Firestore for deletion`);
      return;
    }

    // Update the document in Firestore
    await updateDocument(
      "roles",
      ROLES_DOC_ID,
      {
        roles: updatedRoles,
        "meta.lastModified": new Date().toISOString(),
      },
      companyName
    );
  } catch (error) {
    console.error(`Error deleting role from Firestore:`, error);
    throw error;
  }
}

/**
 * Create a Firestore instance for the role model
 */
export function createRoleFirestoreInstance(model: RoleModel) {
  return {
    async syncToFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        // Load all roles from the model
        const roles = await model.getRoles();
        onProgress?.("Starting role sync to Firestore...");

        // Process each role
        for (let i = 0; i < roles.length; i++) {
          const role = roles[i];
          onProgress?.(
            `Processing role ${role.name} (${i + 1}/${roles.length})`
          );

          // Create or update the role in Firestore
          await createRoleFirestore(
            {
              name: role.name,
              pinCode: role.pinCode,
              accessCodes: role.accessCodes,
              description: role.description,
            },
            await getCompanyName()
          );
        }

        onProgress?.("Role sync to Firestore completed successfully.");
      } catch (error) {
        console.error("Error syncing roles to Firestore:", error);
        throw error;
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        onProgress?.("Starting role sync from Firestore...");
        const companyName = await getCompanyName();

        // Load all roles from Firestore
        const roles = await getRolesFirestore(companyName);

        onProgress?.(`Retrieved ${roles.length} roles from Firestore.`);

        // Save each role to the model
        for (const role of roles) {
          await model.createRole(role);
        }

        onProgress?.("Role sync from Firestore completed successfully.");
      } catch (error) {
        console.error("Error syncing roles from Firestore:", error);
        throw error;
      }
    },
  };
}
