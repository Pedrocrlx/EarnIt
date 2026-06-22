import {
  CalendarDays,
  LoaderCircle,
  Plus,
  UserRound,
  UsersRound,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import DashboardShell from "@/components/NavbarMobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/useAuth";
import { createChild as createChildRequest } from "@/services/profileService";

type MutationState = "idle" | "saving-family" | "creating-child";

type CreateChildForm = {
  avatarUrl: string;
  birthDate: string;
  name: string;
};

const initialChildForm: CreateChildForm = {
  avatarUrl: "",
  birthDate: "",
  name: "",
};

const ManageProfilesPage = () => {
  const { familyProfile, refreshSession } = useAuth();
  const familyName = familyProfile?.family_name?.trim() || "Família";
  const children = familyProfile?.children ?? [];
  const [childForm, setChildForm] = useState<CreateChildForm>(initialChildForm);
  const [mutationState, setMutationState] = useState<MutationState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const actionIsRunning = mutationState !== "idle";

  const refreshFamily = async () => {
    await refreshSession();
  };

  const createChild = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const childName = childForm.name.trim();
    if (!childName) {
      setErrorMessage("Indique o nome da criança.");
      setSuccessMessage("");
      return;
    }

    setMutationState("creating-child");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await createChildRequest({
        name: childName,
        birth_date: childForm.birthDate || null,
        avatar_url: childForm.avatarUrl.trim() || null,
      });
      setChildForm(initialChildForm);
      await refreshFamily();
      setSuccessMessage("Perfil criado.");
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível criar o perfil.",
      );
    } finally {
      setMutationState("idle");
    }
  };



  return (
    <DashboardShell>
      <main className="min-h-screen bg-[#f8f9fb] px-4 py-6 text-[#191c1e] sm:px-6 lg:px-10">
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <header>
            <p className="text-sm font-semibold uppercase text-[#5f6800]">
              Gestão familiar
            </p>
            <h1 className="mt-1 font-montserrat text-2xl font-bold text-[#003514] sm:text-3xl">
              Gerir perfis
            </h1>
          </header>

          <section className="box-border flex min-h-[202px] w-full max-w-[946px] flex-none flex-col items-start gap-6 rounded-2xl border border-[#e1e2e4] bg-white p-[25px] shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
            <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-[#eef7d1] text-[#5f6800]">
                  <UsersRound className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-montserrat text-xl font-bold text-[#003514]">
                    {familyName}
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-[#404940]">
                    Reveja e mantenha os perfis ligados à conta parental.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-[#f8f9fb] px-4 py-3">
                <p className="text-xs font-semibold uppercase text-[#59625a]">
                  Total de crianças
                </p>
                <p className="mt-1 text-2xl font-bold text-[#003514]">
                  {children.length}
                </p>
              </div>
            </div>
          </section>

          {errorMessage ? (
            <p className="w-full max-w-[946px] rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="w-full max-w-[946px] rounded-lg bg-[#eef7d1] px-4 py-3 text-sm font-semibold text-[#5f6800]">
              {successMessage}
            </p>
          ) : null}

          <section className="grid w-full max-w-[946px] gap-6 lg:grid-cols-2">
            <form
              onSubmit={createChild}
              className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)] sm:p-6"
            >
              <h2 className="text-lg font-bold text-[#003514]">
                Novo perfil
              </h2>
              <div className="mt-5 grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="child-name" className="text-[#404940]">
                    Nome da criança
                  </Label>
                  <Input
                    id="child-name"
                    value={childForm.name}
                    onChange={(event) =>
                      setChildForm((currentForm) => ({
                        ...currentForm,
                        name: event.target.value,
                      }))
                    }
                    disabled={actionIsRunning}
                    className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="child-birth-date" className="text-[#404940]">
                    Data de nascimento (opcional)
                  </Label>
                  <Input
                    id="child-birth-date"
                    type="date"
                    value={childForm.birthDate}
                    onChange={(event) =>
                      setChildForm((currentForm) => ({
                        ...currentForm,
                        birthDate: event.target.value,
                      }))
                    }
                    disabled={actionIsRunning}
                    className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="child-avatar-url" className="text-[#404940]">
                    URL do avatar
                  </Label>
                  <Input
                    id="child-avatar-url"
                    value={childForm.avatarUrl}
                    onChange={(event) =>
                      setChildForm((currentForm) => ({
                        ...currentForm,
                        avatarUrl: event.target.value,
                      }))
                    }
                    disabled={actionIsRunning}
                    placeholder="https://..."
                    className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] placeholder:text-[#6b7280] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={actionIsRunning}
                className="mt-5 h-11 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
              >
                {mutationState === "creating-child" ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="mr-2 size-4" aria-hidden="true" />
                )}
                Criar perfil
              </Button>
            </form>
          </section>

          <section className="w-full max-w-[946px] rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)] sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#003514]">
                  Perfis das crianças
                </h2>
                <p className="mt-1 text-sm leading-5 text-[#404940]">
                  Só o perfil parental pode ver e gerir esta lista.
                </p>
              </div>
              <UserRound className="size-5 text-[#404940]" aria-hidden="true" />
            </div>

            <div className="mt-5 divide-y divide-[#e1e2e4]">
              {children.length > 0 ? (
                children.map((child) => (
                  <article
                    key={child.id}
                    className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#003514] text-sm font-bold uppercase text-white">
                        {child.avatar_url ? (
                          <img
                            src={child.avatar_url}
                            alt={`Perfil de ${child.name}`}
                            className="size-full object-cover"
                          />
                        ) : (
                          child.name.slice(0, 1)
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#191c1e]">
                          {child.name}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[#404940]">
                          <CalendarDays className="size-4" aria-hidden="true" />
                          {child.birth_date || "Data de nascimento não definida"}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                  Ainda não existem perfis de crianças.
                </p>
              )}
            </div>
          </section>
        </section>
      </main>
    </DashboardShell>
  );
};

export default ManageProfilesPage;
