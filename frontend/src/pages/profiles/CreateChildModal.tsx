import { ImageIcon, PlusIcon, UpdateIcon } from "@radix-ui/react-icons";
import { type FormEvent, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/context/useToast";
import { AVATAR_ACCEPT, validateAvatarFile } from "@/lib/avatar";
import {
  createChild as createChildRequest,
  uploadChildAvatar,
} from "@/services/profileService";

type CreateChildModalProps = {
  onClose: () => void;
  onCreated: (message: string) => void;
};

const getTodayInputValue = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
};

const CreateChildModal = ({ onClose, onCreated }: CreateChildModalProps) => {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const createChild = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const childName = name.trim();
    if (!childName) {
      showToast("Indique o nome da criança.", "error");
      return;
    }

    if (avatarFile) {
      const avatarError = validateAvatarFile(avatarFile);
      if (avatarError) {
        showToast(avatarError, "error");
        return;
      }
    }

    setSubmitting(true);

    try {
      const child = await createChildRequest({
        name: childName,
        birth_date: birthDate || null,
        avatar_url: null,
      });

      // The child exists even if the avatar upload fails — surface a partial
      // success rather than silently dropping the created profile.
      if (avatarFile) {
        try {
          await uploadChildAvatar(child.id, avatarFile);
        } catch (caughtError) {
          onCreated(
            caughtError instanceof Error
              ? `Perfil criado, mas não foi possível guardar o avatar: ${caughtError.message}`
              : "Perfil criado, mas não foi possível guardar o avatar.",
          );
          return;
        }
      }

      onCreated("Perfil criado.");
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível criar o perfil.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Novo perfil" onClose={onClose} closeDisabled={submitting}>
      <form onSubmit={createChild} className="mt-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="child-name" className="text-[#404940]">
              Nome da criança
            </Label>
            <Input
              id="child-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={submitting}
              className="h-11 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="child-birth-date" className="text-[#404940]">
              Data de nascimento (opcional)
            </Label>
            <Input
              id="child-birth-date"
              type="date"
              max={getTodayInputValue()}
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              disabled={submitting}
              className="h-11 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="child-avatar-file" className="text-[#404940]">
              Avatar (opcional)
            </Label>
            <Input
              id="child-avatar-file"
              type="file"
              accept={AVATAR_ACCEPT}
              onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
              disabled={submitting}
              className="h-11 cursor-pointer rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-[#003514] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
            />
            <p className="flex items-center gap-1.5 text-xs text-[#59625a]">
              <ImageIcon className="size-3.5" aria-hidden="true" />
              JPEG, PNG ou WebP, até 5 MB.
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            className="h-10 flex-1 rounded-full bg-[#f3f4f6] text-sm font-semibold text-[#003514] hover:bg-[#e8eaed] hover:text-[#003514]"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="h-10 flex-1 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
          >
            {submitting ? (
              <UpdateIcon className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <PlusIcon className="mr-2 size-4" aria-hidden="true" />
            )}
            Criar perfil
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateChildModal;
