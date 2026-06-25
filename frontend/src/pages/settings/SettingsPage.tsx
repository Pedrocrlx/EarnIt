import { ExitIcon, LockClosedIcon, Pencil1Icon, ValueIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardShell from "@/components/NavbarMobile";
import { ParentPinDialog } from "@/components/ParentPinDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/useAuth";
import { useToast } from "@/context/useToast";
import { getPointValue } from "@/services/profileService";
import FamilyNameModal from "./FamilyNameModal";
import PointValueModal from "./PointValueModal";

const SettingsPage = () => {
  const { familyProfile, refreshSession, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const familyName = familyProfile?.family_name?.trim() || "Família";
  const [pointValueInput, setPointValueInput] = useState("");
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pointModalOpen, setPointModalOpen] = useState(false);
  const [familyModalOpen, setFamilyModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPointValue = async () => {
      try {
        const { point_value_eur } = await getPointValue();
        if (isMounted) {
          setPointValueInput(String(Number(point_value_eur)));
        }
      } catch {
        if (isMounted) {
          showToast("Não foi possível carregar a conversão de pontos.", "error");
        }
      }
    };

    void loadPointValue();

    return () => {
      isMounted = false;
    };
  }, [showToast]);

  const onPinReset = () => {
    setPinDialogOpen(false);
    showToast("PIN parental redefinido.");
  };

  const logoutAndExit = async () => {
    await logout();
    navigate("/");
  };

  const openModal = (open: (value: boolean) => void) => {
    open(true);
  };

  const onPointValueSaved = (pointValueEur: string, message: string) => {
    setPointValueInput(pointValueEur);
    showToast(message);
    setPointModalOpen(false);
  };

  const onFamilyNameSaved = (_name: string, message: string) => {
    showToast(message);
    setFamilyModalOpen(false);
    void refreshSession();
  };

  const pointsPreviewEuros = pointValueInput
    ? (Number(pointValueInput) * 100).toLocaleString("pt-PT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";

  return (
    <DashboardShell>
      <main className="flex min-h-screen w-full flex-col items-center gap-10 bg-[#f8f9fb] p-0 text-[#191c1e] lg:min-h-[1024px] lg:w-[1024px] lg:grow">
        <section className="flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
          <header>
            <p className="text-sm font-semibold uppercase text-[#5f6800]">
              Definições parentais
            </p>
            <h1 className="mt-1 font-montserrat text-2xl font-bold text-[#003514] sm:text-3xl">
              Definições
            </h1>
          </header>

          <section className="grid w-full max-w-[946px] gap-6 lg:grid-cols-2">
            <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)] sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-[#eef7d1] text-[#5f6800]">
                  <ValueIcon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-[#003514]">Conversão de pontos</h2>
                  <p className="mt-1 text-sm leading-5 text-[#404940]">
                    Quanto vale 1 ponto em euros para a família.
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-lg bg-[#f8f9fb] px-4 py-3">
                <p className="text-xs font-semibold uppercase text-[#59625a]">Atual</p>
                <p className="mt-1 text-sm font-bold text-[#003514]">
                  1 ponto = {pointValueInput || "—"} €
                </p>
                <p className="mt-1 text-sm text-[#59625a]">
                  100 pontos = {pointsPreviewEuros} €
                </p>
              </div>
              <Button
                type="button"
                onClick={() => openModal(setPointModalOpen)}
                disabled={!pointValueInput}
                className="mt-5 h-11 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
              >
                <ValueIcon className="mr-2 size-4" aria-hidden="true" />
                Alterar conversão
              </Button>
            </section>

            <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)] sm:p-6">
              <h2 className="text-lg font-bold text-[#003514]">Nome da família</h2>
              <div className="mt-5 rounded-lg bg-[#f8f9fb] px-4 py-3">
                <p className="text-xs font-semibold uppercase text-[#59625a]">Atual</p>
                <p className="mt-1 text-sm font-bold text-[#003514]">{familyName}</p>
              </div>
              <Button
                type="button"
                onClick={() => openModal(setFamilyModalOpen)}
                className="mt-5 h-11 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
              >
                <Pencil1Icon className="mr-2 size-4" aria-hidden="true" />
                Alterar nome
              </Button>
            </section>

            <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)] sm:p-6">
              <h2 className="text-lg font-bold text-[#003514]">
                Redefinir PIN parental
              </h2>
              <p className="mt-1 text-sm leading-5 text-[#404940]">
                Receba um código por email e defina um novo PIN de 4 dígitos.
              </p>
              <Button
                type="button"
                onClick={() => openModal(setPinDialogOpen)}
                className="mt-5 h-11 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
              >
                <LockClosedIcon className="mr-2 size-4" aria-hidden="true" />
                Redefinir PIN
              </Button>
            </section>
          </section>

          <section className="w-full max-w-[946px] rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)] sm:p-6">
            <h2 className="text-lg font-bold text-[#003514]">Terminar sessão</h2>
            <p className="mt-1 text-sm leading-5 text-[#404940]">
              Termina a sessão da conta parental neste dispositivo. Para apenas mudar de
              perfil, use “Trocar Perfil” na barra lateral.
            </p>
            <Button
              type="button"
              onClick={logoutAndExit}
              className="mt-5 h-11 rounded-full bg-[#fff4de] px-5 text-sm font-semibold text-[#7a4100] hover:bg-[#ffe9c2] hover:text-[#7a4100] disabled:opacity-60"
            >
              <ExitIcon className="mr-2 size-4" aria-hidden="true" />
              Terminar sessão
            </Button>
          </section>
        </section>

        {pointModalOpen ? (
          <PointValueModal
            initialPointValue={pointValueInput}
            onClose={() => setPointModalOpen(false)}
            onSaved={onPointValueSaved}
          />
        ) : null}

        {familyModalOpen ? (
          <FamilyNameModal
            initialName={familyName}
            onClose={() => setFamilyModalOpen(false)}
            onSaved={onFamilyNameSaved}
          />
        ) : null}

        {pinDialogOpen ? (
          <ParentPinDialog
            initialStep="forgot"
            onClose={() => setPinDialogOpen(false)}
            onResetSuccess={onPinReset}
          />
        ) : null}
      </main>
    </DashboardShell>
  );
};

export default SettingsPage;
