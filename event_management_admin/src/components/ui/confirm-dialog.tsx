import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function useConfirmDialog() {
  const [state, setState] = useState<{ msg: string; fn: () => void } | null>(null);
  const ask = (msg: string, fn: () => void) => () => setState({ msg, fn });
  const ConfirmDialog = (
    <AlertDialog open={!!state} onOpenChange={(o) => !o && setState(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Action</AlertDialogTitle>
          <AlertDialogDescription>{state?.msg}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setState(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-[#4b1248] hover:bg-[#6c2e70] text-white"
            onClick={() => {
              state?.fn();
              setState(null);
            }}
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { ask, ConfirmDialog };
}
