import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const ConfirmDelete = ({ trigger, title, description, onConfirm, testId }) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
    <AlertDialogContent className="rounded-3xl max-w-[92vw] sm:max-w-md bg-white">
      <AlertDialogHeader>
        <AlertDialogTitle className="font-heading text-xl">{title}</AlertDialogTitle>
        <AlertDialogDescription className="text-base">{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="gap-2">
        <AlertDialogCancel className="h-12 rounded-2xl text-base" data-testid={`${testId}-cancel`}>Cancelar</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} className="h-12 rounded-2xl text-base bg-alert hover:bg-[#9c3e30]" data-testid={`${testId}-confirm`}>
          Excluir
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
