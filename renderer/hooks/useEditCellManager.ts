import { useState, useCallback } from "react";
import { toast } from "sonner";

interface UseEditCellManagerProps {
  closeDialogCallbacks?: (() => void)[]; // Array of functions to call when starting edit
}

interface UseEditCellManagerReturn {
  editingCellKey: string | null;
  startEdit: (cellKey: string) => void;
  stopEdit: () => void;
}

export const useEditCellManager = ({
  closeDialogCallbacks = [],
}: UseEditCellManagerProps): UseEditCellManagerReturn => {
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);

  const startEdit = useCallback(
    (cellKey: string) => {
      // Close any specified dialogs before starting edit
      closeDialogCallbacks.forEach((callback) => callback());

      if (editingCellKey && editingCellKey !== cellKey) {
        toast.warning(
          "Please save or cancel the current edit before starting another."
        );
      } else {
        setEditingCellKey(cellKey);
      }
    },
    [editingCellKey, closeDialogCallbacks]
  );

  const stopEdit = useCallback(() => {
    setEditingCellKey(null);
  }, []);

  return { editingCellKey, startEdit, stopEdit };
};
