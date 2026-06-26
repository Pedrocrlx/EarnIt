import { CameraIcon, ImageIcon, UpdateIcon } from "@radix-ui/react-icons";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AVATAR_ACCEPT, validateAvatarFile } from "@/lib/avatar";

type TaskProofDialogProps = {
  busy: boolean;
  onClose: () => void;
  onSubmit: (proof: File) => void;
  taskTitle: string;
};

export const TaskProofDialog = ({
  busy,
  onClose,
  onSubmit,
  taskTitle,
}: TaskProofDialogProps) => {
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState("");
  const previewUrl = useMemo(
    () => (proof ? URL.createObjectURL(proof) : null),
    [proof],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const selectProof = (file: File | null) => {
    setError("");
    if (!file) {
      setProof(null);
      return true;
    }
    const validationError = validateAvatarFile(file);
    if (validationError) {
      setProof(null);
      setError(validationError.replace("avatar", "comprovativo"));
      return false;
    }
    setProof(file);
    return true;
  };

  return (
    <Modal
      title="Fotografia da tarefa"
      subtitle={`Mostra como ficou: ${taskTitle}`}
      onClose={onClose}
      closeDisabled={busy}
      widthClassName="max-w-lg"
    >
      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="task-proof" className="text-[#404940]">
            Fotografia obrigatória
          </Label>
          <Input
            id="task-proof"
            type="file"
            accept={AVATAR_ACCEPT}
            capture="environment"
            disabled={busy}
            onChange={(event) => {
              if (!selectProof(event.target.files?.[0] ?? null)) {
                event.target.value = "";
              }
            }}
            className="h-12 cursor-pointer rounded-lg border-[#e1e2e4] bg-white text-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-[#003514]"
          />
          <p className="flex items-center gap-1.5 text-xs text-[#59625a]">
            <ImageIcon className="size-3.5" aria-hidden="true" />
            JPEG, PNG ou WebP, até 5 MB.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        {previewUrl ? (
          <div className="overflow-hidden rounded-2xl border border-[#d9ddd7] bg-[#f3f4f6]">
            <img
              src={previewUrl}
              alt="Pré-visualização do comprovativo"
              className="max-h-80 w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#c8d0c1] bg-[#f8f9fb] px-5 text-center text-sm font-semibold text-[#59625a]">
            <CameraIcon className="size-7 text-[#5f6800]" aria-hidden="true" />
            Adiciona uma fotografia para enviar a tarefa.
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
            className="h-11 flex-1 rounded-full bg-[#f3f4f6] text-sm font-semibold text-[#003514]"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => proof && onSubmit(proof)}
            disabled={busy || !proof}
            className="h-11 flex-1 rounded-full bg-[#d4e251] text-sm font-bold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-50"
          >
            {busy ? (
              <UpdateIcon className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CameraIcon className="mr-2 size-4" aria-hidden="true" />
            )}
            Enviar prova
          </Button>
        </div>
      </div>
    </Modal>
  );
};
