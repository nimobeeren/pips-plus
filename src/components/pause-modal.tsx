import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PauseModalProps {
  open: boolean;
  onResume: () => void;
}

export function PauseModal({ open, onResume }: PauseModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onResume()}>
      <DialogContent
        className="max-w-xs text-center"
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center">
          <DialogTitle className="text-2xl">Your game is paused</DialogTitle>
          <DialogDescription>Ready to continue?</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={onResume}>Resume</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
