import { CheckIcon, UpdateIcon } from "@radix-ui/react-icons";
import { type FormEvent, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/context/useToast";
import { updateFamilyName as updateFamilyNameRequest } from "@/services/profileService";

type FamilyNameModalProps = {
  initialName: string;
  onClose: () => void;
  onSaved: (name: string, message: string) => void;
};

const FamilyNameModal = ({ initialName, onClose, onSaved }: FamilyNameModalProps) => {
  const { showToast } = useToast();
  const [nameInput, setNameInput] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextName = nameInput.trim();
    if (!nextName) {
      showToast("Indique o nome da família.", "error");
      return;
    }

    setSubmitting(true);

    try {
      await updateFamilyNameRequest(nextName);
      onSaved(nextName, "Nome da família atualizado.");
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível atualizar o nome da família.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Alterar nome" onClose={onClose} closeDisabled={submitting}>
      <form onSubmit={save} className="mt-4">
        <div className="space-y-2">
          <Label htmlFor="family-name-input" className="text-[#404940]">
            Nome da família
          </Label>
          <Input
            id="family-name-input"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            disabled={submitting}
            className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
          />
        </div>

        <div className="mt-5 flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            className="h-11 flex-1 rounded-full bg-[#f3f4f6] text-sm font-semibold text-[#003514] hover:bg-[#e8eaed] hover:text-[#003514]"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="h-11 flex-1 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
          >
            {submitting ? (
              <UpdateIcon className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckIcon className="mr-2 size-4" aria-hidden="true" />
            )}
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default FamilyNameModal;
