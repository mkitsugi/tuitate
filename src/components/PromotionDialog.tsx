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

interface PromotionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPromote: (promote: boolean) => void;
}

export function PromotionDialog({
  open,
  onOpenChange,
  onPromote,
}: PromotionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>駒を成りますか？</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onPromote(false)}>
            成らない
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => onPromote(true)}>
            成る
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function usePromotionDialog() {
  const [open, setOpen] = React.useState(false);

  const openPromotionDialog = React.useCallback(() => {
    setOpen(true);
  }, []);

  const PromotionDialogComponent = React.useCallback(
    ({ onPromote }: { onPromote: (promote: boolean) => void }) => (
      <PromotionDialog
        open={open}
        onOpenChange={setOpen}
        onPromote={(promote) => {
          onPromote(promote);
          setOpen(false);
        }}
      />
    ),
    [open]
  );

  return {
    openPromotionDialog,
    PromotionDialog: PromotionDialogComponent,
  };
}
