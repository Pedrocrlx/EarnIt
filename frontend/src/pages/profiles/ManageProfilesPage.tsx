import { CalendarIcon, CheckIcon, PlusIcon, ReloadIcon, UpdateIcon } from "@radix-ui/react-icons";
import { type FormEvent, useState } from "react";
import DashboardShell from "@/components/NavbarMobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/useAuth";
import { useToast } from "@/context/useToast";
import { isFutureDate } from "@/lib/validation";
import { updateChildBirthDate } from "@/services/profileService";
import CreateChildModal from "./CreateChildModal";

const metaItemClass = "flex items-center gap-1.5 text-sm text-[#404940]";

const getTodayInputValue = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
};

const ManageProfilesPage = () => {
  const { familyProfile, refreshSession } = useAuth();
  const { showToast } = useToast();
  const familyName = familyProfile?.family_name?.trim() || "Família";
  const children = familyProfile?.children ?? [];
  const [refreshing, setRefreshing] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editingBirthDate, setEditingBirthDate] = useState("");
  const [updatingChildId, setUpdatingChildId] = useState<string | null>(null);

  const actionIsRunning = updatingChildId !== null || refreshing;

  const refreshFamily = async () => {
    setRefreshing(true);
    try {
      await refreshSession();
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreated = (message: string) => {
    showToast(message);
    setCreateModalOpen(false);
    void refreshFamily();
  };

  const startEditingBirthDate = (child: (typeof children)[number]) => {
    setEditingChildId(child.id);
    setEditingBirthDate(child.birth_date ?? "");
  };

  const saveBirthDate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingChildId) {
      return;
    }

    if (isFutureDate(editingBirthDate)) {
      showToast("A data de nascimento não pode ser no futuro.", "error");
      return;
    }

    setUpdatingChildId(editingChildId);

    try {
      await updateChildBirthDate(editingChildId, editingBirthDate || null);
      setEditingChildId(null);
      await refreshSession();
      showToast("Data de nascimento atualizada.");
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível atualizar a data de nascimento.",
        "error",
      );
    } finally {
      setUpdatingChildId(null);
    }
  };

  return (
    <DashboardShell>
      <main className="flex min-h-screen w-full flex-col items-center gap-10 bg-[#f8f9fb] p-0 text-[#191c1e] lg:min-h-[1024px] lg:w-[1024px] lg:grow">
        <section className="flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-[#5f6800]">
                Gestão familiar
              </p>
              <h1 className="mt-1 font-montserrat text-2xl font-bold text-[#003514] sm:text-3xl">
                Perfis
              </h1>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={refreshFamily}
              disabled={actionIsRunning}
              aria-label="Atualizar"
              className="size-11 shrink-0 rounded-full border border-[#e1e2e4] text-[#003514] hover:bg-white"
            >
              <ReloadIcon
                className={`size-5 ${refreshing ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
            </Button>
          </header>

          {createModalOpen ? (
            <CreateChildModal
              onClose={() => setCreateModalOpen(false)}
              onCreated={handleCreated}
            />
          ) : null}

          <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold text-[#003514]">
                  Perfis das crianças
                </h2>
                <span className="rounded-full bg-[#f8f9fb] px-3 py-1 text-sm font-semibold text-[#404940]">
                  {familyName} · {children.length}
                </span>
              </div>
              <Button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                disabled={actionIsRunning}
                className="h-10 shrink-0 rounded-full bg-[#d4e251] px-4 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
              >
                <PlusIcon className="mr-2 size-4" aria-hidden="true" />
                Novo perfil
              </Button>
            </div>

            <div className="mt-5 divide-y divide-[#e1e2e4]">
              {children.length > 0 ? (
                children.map((child) => (
                  <article
                    key={child.id}
                    className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
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
                        <p className={`mt-0.5 ${metaItemClass}`}>
                          <CalendarIcon
                            className="size-4 text-[#7a8278]"
                            aria-hidden="true"
                          />
                          {child.birth_date || "Data de nascimento não definida"}
                        </p>
                      </div>
                    </div>
                    {editingChildId === child.id ? (
                      <form
                        onSubmit={saveBirthDate}
                        className="grid w-full max-w-xs gap-2"
                      >
                        <Label
                          htmlFor={`profile-birth-date-${child.id}`}
                          className="text-[#404940]"
                        >
                          Data de nascimento
                        </Label>
                        <Input
                          id={`profile-birth-date-${child.id}`}
                          type="date"
                          max={getTodayInputValue()}
                          value={editingBirthDate}
                          onChange={(event) => {
                            setEditingBirthDate(event.target.value);
                          }}
                          disabled={updatingChildId === child.id}
                          className="h-10 rounded-lg border-[#e1e2e4] bg-white"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            disabled={updatingChildId === child.id}
                            className="h-9 rounded-full bg-[#d4e251] px-4 text-xs font-semibold text-[#003514] hover:bg-[#cfdc42]"
                          >
                            {updatingChildId === child.id ? (
                              <UpdateIcon
                                className="mr-2 size-3.5 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <CheckIcon className="mr-2 size-3.5" aria-hidden="true" />
                            )}
                            Guardar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setEditingChildId(null)}
                            disabled={updatingChildId === child.id}
                            className="h-9 rounded-full px-4 text-xs font-semibold text-[#404940]"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => startEditingBirthDate(child)}
                        disabled={actionIsRunning}
                        className="h-9 shrink-0 rounded-full px-3 text-xs font-semibold text-[#003514] hover:bg-[#f3f4f6]"
                      >
                        {child.birth_date ? "Editar data" : "Definir data"}
                      </Button>
                    )}
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
