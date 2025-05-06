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

// --- Firestore-specific Types ---
/**
 * Defines the structure of a Role object as it is stored in Firestore.
 * Descriptions are stored as string | null.
 * Dates are stored as ISO strings.
 * AccessCodes are always string[].
 */
interface RoleForFirestore
  extends Omit<
    Role,
    "description" | "accessCodes" | "createdAt" | "updatedAt"
  > {
  id: string; // Ensure id is not undefined
  name: string; // Ensure name is not undefined
  pinCode: string; // Ensure pinCode is not undefined (it's encrypted)
  description: string | null;
  accessCodes: string[];
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Firestore document structure for storing roles.
 */
interface RolesFirestoreDocument {
  meta: {
    lastModified: string;
  };
  roles: RoleForFirestore[];
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
    const data = await fetchDocument<RolesFirestoreDocument>(
      "roles",
      ROLES_DOC_ID,
      companyName
    );

    if (!data || !data.roles || !Array.isArray(data.roles)) {
      console.warn(
        `[Firestore] getRolesFirestore: No roles document found or roles array is invalid for company: ${companyName}. Raw data:`,
        data
      );
      return [];
    }

    // Convert RoleForFirestore[] to Role[]
    const decryptedRoles: Role[] = data.roles.map(
      (roleFS: RoleForFirestore) => ({
        ...roleFS,
        description:
          roleFS.description === null ? undefined : roleFS.description, // null to undefined
        pinCode: decryptPinCode(roleFS.pinCode),
        createdAt: new Date(roleFS.createdAt), // string to Date
        updatedAt: new Date(roleFS.updatedAt), // string to Date
        accessCodes: Array.isArray(roleFS.accessCodes)
          ? roleFS.accessCodes
          : [], // Ensure it's an array
      })
    );
    return decryptedRoles;
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
    const existingDoc = await fetchDocument<RolesFirestoreDocument>(
      "roles",
      ROLES_DOC_ID,
      companyName
    );

    // Encrypt the PIN code before storing
    const encryptedPinCode = encryptPinCode(roleInput.pinCode);

    // Create the role object adhering to the Role interface (string | undefined for description)
    const newRoleForInterface: Role = {
      id: crypto.randomUUID(),
      name: roleInput.name,
      pinCode: encryptedPinCode,
      accessCodes: Array.isArray(roleInput.accessCodes)
        ? roleInput.accessCodes
        : [],
      description:
        roleInput.description === undefined || roleInput.description === null
          ? undefined
          : roleInput.description,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Convert Role interface object to RoleForFirestore object
    const newRoleForFirestore: RoleForFirestore = {
      ...newRoleForInterface,
      description:
        newRoleForInterface.description === undefined
          ? null
          : newRoleForInterface.description,
      accessCodes: Array.isArray(newRoleForInterface.accessCodes)
        ? newRoleForInterface.accessCodes
        : [],
      createdAt: newRoleForInterface.createdAt.toISOString(),
      updatedAt: newRoleForInterface.updatedAt.toISOString(),
    };

    if (!existingDoc) {
      // Create a new document if it doesn't exist
      const newData: RolesFirestoreDocument = {
        meta: {
          lastModified: new Date().toISOString(),
        },
        roles: [newRoleForFirestore],
      };
      await saveDocument("roles", ROLES_DOC_ID, newData, companyName);
    } else {
      // Add the new role to existing roles
      const updatedRolesForFirestore: RoleForFirestore[] = [
        ...existingDoc.roles, // These are already RoleForFirestore
        newRoleForFirestore,
      ];

      // Update the document
      await updateDocument(
        "roles",
        ROLES_DOC_ID,
        {
          roles: updatedRolesForFirestore,
          "meta.lastModified": new Date().toISOString(),
        },
        companyName
      );
    }

    // Return with the original (decrypted) PIN, conforming to Role interface
    const returnRole = {
      ...newRoleForInterface, // This has description as string | undefined
      pinCode: roleInput.pinCode, // Decrypt for return
    };
    return returnRole;
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
    const existingDoc = await fetchDocument<RolesFirestoreDocument>(
      "roles",
      ROLES_DOC_ID,
      companyName
    );

    if (!existingDoc || !existingDoc.roles) {
      throw new Error(
        `[Firestore] Roles data not found in Firestore for company: ${companyName} when updating role ID "${id}"`
      );
    }

    const roleIndex = existingDoc.roles.findIndex((r) => r.id === id);
    if (roleIndex === -1) {
      throw new Error(
        `[Firestore] Role with id "${id}" not found in Firestore for company: ${companyName}`
      );
    }

    const existingRoleFromDoc = existingDoc.roles[roleIndex]; // This is RoleForFirestore

    // Convert existing RoleForFirestore from doc to Role for manipulation, if necessary for spread logic
    const existingRoleForInterface: Role = {
      ...existingRoleFromDoc,
      description:
        existingRoleFromDoc.description === null
          ? undefined
          : existingRoleFromDoc.description,
      createdAt: new Date(existingRoleFromDoc.createdAt),
      updatedAt: new Date(existingRoleFromDoc.updatedAt),
      accessCodes: Array.isArray(existingRoleFromDoc.accessCodes)
        ? existingRoleFromDoc.accessCodes
        : [],
    };

    console.log(
      `[Firestore] updateRoleFirestore: Found role "${existingRoleForInterface.name}" (ID: ${id}) for update.`
    );

    // Encrypt new PIN if provided
    const encryptedPinCode = roleUpdate.pinCode
      ? encryptPinCode(roleUpdate.pinCode)
      : existingRoleForInterface.pinCode;

    // Create updated role object adhering to Role interface
    let descriptionForInterface: string | undefined;
    if (
      roleUpdate.description === null ||
      roleUpdate.description === undefined
    ) {
      descriptionForInterface = roleUpdate.hasOwnProperty("description")
        ? undefined
        : existingRoleForInterface.description;
    } else {
      descriptionForInterface = roleUpdate.description;
    }

    let accessCodesForInterface: string[];
    if (
      roleUpdate.accessCodes === null ||
      roleUpdate.accessCodes === undefined
    ) {
      accessCodesForInterface = roleUpdate.hasOwnProperty("accessCodes")
        ? []
        : existingRoleForInterface.accessCodes || [];
    } else {
      accessCodesForInterface = roleUpdate.accessCodes;
    }

    const updatedRoleForInterface: Role = {
      ...existingRoleForInterface, // Spread the converted Role object
      ...roleUpdate,
      pinCode: encryptedPinCode,
      description: descriptionForInterface,
      accessCodes: accessCodesForInterface,
      updatedAt: new Date(),
    };

    // Convert the updated Role object back to RoleForFirestore for storage
    const updatedRoleForFirestore: RoleForFirestore = {
      ...updatedRoleForInterface,
      description:
        updatedRoleForInterface.description === undefined
          ? null
          : updatedRoleForInterface.description,
      accessCodes: Array.isArray(updatedRoleForInterface.accessCodes)
        ? updatedRoleForInterface.accessCodes
        : [],
      createdAt: updatedRoleForInterface.createdAt.toISOString(),
      updatedAt: updatedRoleForInterface.updatedAt.toISOString(),
    };

    // Update the role in the array
    const finalRolesForFirestore: RoleForFirestore[] = existingDoc.roles.map(
      (roleFS, index) => {
        if (index === roleIndex) {
          return updatedRoleForFirestore;
        }
        return roleFS; // Other roles are already RoleForFirestore
      }
    );

    // Update the document in Firestore
    await updateDocument(
      "roles",
      ROLES_DOC_ID,
      {
        roles: finalRolesForFirestore,
        "meta.lastModified": new Date().toISOString(),
      },
      companyName
    );

    // Return the role adhering to the Role interface (with decrypted PIN)
    const returnRole = {
      ...updatedRoleForInterface, // This is Role interface compliant (description: string | undefined)
      pinCode:
        roleUpdate.pinCode !== undefined
          ? roleUpdate.pinCode
          : decryptPinCode(updatedRoleForInterface.pinCode), // Decrypt for return
    };
    return returnRole;
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
    const existingDoc = await fetchDocument<RolesFirestoreDocument>(
      "roles",
      ROLES_DOC_ID,
      companyName
    );

    if (!existingDoc || !existingDoc.roles) {
      console.warn(
        `[Firestore] deleteRoleFirestore: Roles data not found for company ${companyName} when deleting role ${id}. No action taken.`
      );
      return;
    }

    const initialLength = existingDoc.roles.length;
    const updatedRoles = existingDoc.roles.filter((role) => role.id !== id);

    if (updatedRoles.length === initialLength) {
      console.warn(
        `[Firestore] deleteRoleFirestore: Role with id "${id}" not found for company ${companyName}. No deletion performed.`
      );
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
        const localRoles = await model.getRoles();
        onProgress?.("Starting role sync to Firestore...");

        if (localRoles.length === 0) {
          onProgress?.("No local roles found to sync to Firestore.");
          return;
        }

        const companyName = await getCompanyName();

        // Process each role
        for (let i = 0; i < localRoles.length; i++) {
          const role = localRoles[i];
          onProgress?.(
            `Processing role ${role.name} (${i + 1}/${localRoles.length})`
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
        onProgress?.(
          `Error syncing roles to Firestore: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
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
        const firestoreRoles = await getRolesFirestore(companyName);

        if (firestoreRoles.length === 0) {
          onProgress?.("No roles found in Firestore to sync to local.");
          return;
        }

        onProgress?.(
          `Retrieved ${firestoreRoles.length} roles from Firestore. Saving to local model...`
        );

        // Save each role to the model
        for (const role of firestoreRoles) {
          await model.createRole(role); // This will use the Role interface, which includes id, createdAt, etc.
        }

        onProgress?.(
          `Role sync from Firestore completed successfully. Processed ${firestoreRoles.length} roles.`
        );
      } catch (error) {
        console.error("Error syncing roles from Firestore:", error);
        onProgress?.(
          `Error syncing roles from Firestore: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },
  };
}
