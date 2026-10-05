import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const SheetDialog = ({ open, onOpenChange, title, description, children, testId }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent data-testid={testId} className="bg-white rounded-3xl max-w-[94vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-6">
      <DialogHeader className="text-left">
        <DialogTitle className="font-heading text-2xl">{title}</DialogTitle>
        {description && <DialogDescription className="text-base">{description}</DialogDescription>}
      </DialogHeader>
      {children}
    </DialogContent>
  </Dialog>
);
