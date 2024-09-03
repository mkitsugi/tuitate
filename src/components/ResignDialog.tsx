import React from "react";
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

interface ResignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResign: () => void;
}

export function ResignDialog({
  open,
  onOpenChange,
  onResign,
}: ResignDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>本当に投了しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            キャンセル
          </AlertDialogCancel>
          <AlertDialogAction onClick={onResign}>投了する</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useResignDialog() {
  const [open, setOpen] = React.useState(false);

  const openResignDialog = React.useCallback(() => {
    setOpen(true);
  }, []);

  const ResignDialogComponent = React.useCallback(
    ({ onResign }: { onResign: () => void }) => (
      <ResignDialog
        open={open}
        onOpenChange={setOpen}
        onResign={() => {
          onResign();
          setOpen(false);
        }}
      />
    ),
    [open]
  );

  return {
    openResignDialog,
    ResignDialog: ResignDialogComponent,
  };
}
