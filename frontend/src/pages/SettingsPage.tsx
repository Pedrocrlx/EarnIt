import { KeyRound, LoaderCircle, Mail, Save, ShieldCheck, Sigma } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import DashboardShell from "@/components/NavbarMobile";
import { ParentPinDialog } from "@/components/ParentPinDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/useAuth";
import {
  getPointValue,
  setPointValue,
  updateFamilyName as updateFamilyNameRequest,
} from "@/services/profileService";

type BusyAction = "family-name" | "points" | null;

const SettingsPage = () => {
  const { familyProfile, refreshSession } = useAuth();
  const familyName = familyProfile?.family_name?.trim() || "Família";
  const [familyNameInput, setFamilyNameInput] = useState(familyName);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [pointValueInput, setPointValueInput] = useState("");
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

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
          setErrorMessage("Não foi possível carregar a conversão de pontos.");
        }
      }
    };

    void loadPointValue();

    return () => {
      isMounted = false;
    };
  }, []);

  const actionIsRunning = busyAction !== null;

  const updateFamilyName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextFamilyName = familyNameInput.trim();
    if (!nextFamilyName) {
      setErrorMessage("Indique o nome da família.");
      setSuccessMessage("");
      return;
    }

    setBusyAction("family-name");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updateFamilyNameRequest(nextFamilyName);
      await refreshSession();
      setSuccessMessage("Nome da família atualizado.");
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível atualizar o nome da família.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const onPinReset = () => {
    setPinDialogOpen(false);
    setErrorMessage("");
    setSuccessMessage("PIN parental redefinido.");
  };

  const savePointsConversion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const pointValue = Number(pointValueInput);
    if (!Number.isFinite(pointValue) || pointValue <= 0 || pointValue > 1000) {
      setErrorMessage("O valor de 1 ponto deve estar entre 0 e 1000 €.");
      setSuccessMessage("");
      return;
    }

    // The backend stores up to 4 decimal places (e.g. 0.0001 = 100 pontos por 0,01 €).
    const decimals = (pointValueInput.split(".")[1] ?? "").length;
    if (decimals > 4) {
      setErrorMessage("Use no máximo 4 casas decimais (ex.: 0,0001).");
      setSuccessMessage("");
      return;
    }

    setBusyAction("points");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const next = await setPointValue(pointValueInput.trim());
      setPointValueInput(String(Number(next.point_value_eur)));
      setSuccessMessage("Conversão de pontos atualizada.");
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível atualizar a conversão de pontos.",
      );
    } finally {
      setBusyAction(null);
    }
  };

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

          <section className="box-border flex min-h-[202px] w-full max-w-[946px] flex-none flex-col items-start gap-6 rounded-2xl border border-[#e1e2e4] bg-white p-[25px] shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-[#eef7d1] text-[#5f6800]">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-montserrat text-xl font-bold text-[#003514]">
                  {familyName}
                </h2>
                <p className="mt-1 text-sm leading-5 text-[#404940]">
                  Atualize os detalhes da família e redefina o PIN parental.
                </p>
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-[#f8f9fb] px-4 py-3">
                <p className="text-xs font-semibold uppercase text-[#59625a]">
                  Segurança
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[#003514]">
                  <KeyRound className="size-4" aria-hidden="true" />
                  PIN parental
                </p>
              </div>
              <div className="rounded-lg bg-[#f8f9fb] px-4 py-3">
                <p className="text-xs font-semibold uppercase text-[#59625a]">
                  Recuperação
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[#003514]">
                  <Mail className="size-4" aria-hidden="true" />
                  Código por email
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
              onSubmit={savePointsConversion}
              className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)] sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-[#eef7d1] text-[#5f6800]">
                  <Sigma className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-[#003514]">Conversão de pontos</h2>
                  <p className="mt-1 text-sm leading-5 text-[#404940]">
                    Defina quanto vale 1 ponto em euros, até 4 casas decimais
                    (ex.: 0,0001 € → 100 pontos = 0,01 €).
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#59625a]">
                Nota: a recompensa mínima de uma tarefa é sempre 1 ponto.
              </p>
              <div className="mt-5 space-y-2">
                <Label htmlFor="point-value" className="text-[#404940]">
                  Atualmente: 1 ponto = {pointValueInput || "—"} €.
                </Label>
                <Input
                  id="point-value"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={pointValueInput}
                  onChange={(event) => setPointValueInput(event.target.value)}
                  disabled={actionIsRunning}
                  className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                />
                <p className="text-sm text-[#59625a]">
                  Exemplo: 100 pontos ={" "}
                  {pointValueInput
                    ? (Number(pointValueInput) * 100).toLocaleString("pt-PT", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "—"}{" "}
                  €.
                </p>
              </div>
              <Button
                type="submit"
                disabled={actionIsRunning}
                className="mt-5 h-11 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
              >
                {busyAction === "points" ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="mr-2 size-4" aria-hidden="true" />
                )}
                Guardar conversão
              </Button>
            </form>

            <form
              onSubmit={updateFamilyName}
              className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)] sm:p-6"
            >
              <h2 className="text-lg font-bold text-[#003514]">
                Nome da família
              </h2>
              <div className="mt-5 space-y-2">
                <Label htmlFor="settings-family-name" className="text-[#404940]">
                  Nome
                </Label>
                <Input
                  id="settings-family-name"
                  value={familyNameInput}
                  onChange={(event) => setFamilyNameInput(event.target.value)}
                  disabled={actionIsRunning}
                  className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                />
              </div>
              <Button
                type="submit"
                disabled={actionIsRunning}
                className="mt-5 h-11 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
              >
                {busyAction === "family-name" ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="mr-2 size-4" aria-hidden="true" />
                )}
                Guardar
              </Button>
            </form>

            <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)] sm:p-6">
              <h2 className="text-lg font-bold text-[#003514]">
                Redefinir PIN parental
              </h2>
              <p className="mt-1 text-sm leading-5 text-[#404940]">
                Receba um código por email e defina um novo PIN de 4 dígitos.
              </p>

              <Button
                type="button"
                onClick={() => {
                  setErrorMessage("");
                  setSuccessMessage("");
                  setPinDialogOpen(true);
                }}
                disabled={actionIsRunning}
                className="mt-5 h-11 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
              >
                <KeyRound className="mr-2 size-4" aria-hidden="true" />
                Redefinir PIN
              </Button>
            </section>
          </section>
        </section>

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
