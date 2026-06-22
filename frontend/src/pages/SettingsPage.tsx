import { KeyRound, LoaderCircle, Mail, Save, ShieldCheck, Sigma } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import DashboardShell from "@/components/NavbarMobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/useAuth";
import { DEFAULT_POINTS_PER_EURO } from "@/lib/points";
import {
  requestPinResetCode,
  resetPin as resetPinRequest,
  type PinResetCodeResponse,
} from "@/services/authService";
import { updateFamilyName as updateFamilyNameRequest } from "@/services/profileService";
import { getSettings, updateSettings } from "@/services/settingsService";

type BusyAction = "family-name" | "request-pin-code" | "reset-pin" | "points" | null;

const SettingsPage = () => {
  const { familyProfile, refreshSession } = useAuth();
  const familyName = familyProfile?.family_name?.trim() || "Família";
  const [familyNameInput, setFamilyNameInput] = useState(familyName);
  const [resetCode, setResetCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [pinCodeExpiresAt, setPinCodeExpiresAt] = useState<string | null>(null);
  const [pointsPerEuroInput, setPointsPerEuroInput] = useState(String(DEFAULT_POINTS_PER_EURO));

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const settings = await getSettings();
        if (isMounted) {
          setPointsPerEuroInput(String(settings.points_per_euro));
        }
      } catch {
        if (isMounted) {
          setErrorMessage("Não foi possível carregar a conversão de pontos.");
        }
      }
    };

    void loadSettings();

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

  const requestPinCode = async () => {
    setBusyAction("request-pin-code");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response: PinResetCodeResponse = await requestPinResetCode();
      setPinCodeExpiresAt(response.expires_at ?? null);
      setSuccessMessage("Código de redefinição enviado para o email da conta.");
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível enviar o código de redefinição.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const resetPin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedCode = resetCode.trim();
    const normalizedPin = newPin.replace(/\D/g, "");
    const normalizedConfirmPin = confirmPin.replace(/\D/g, "");

    if (!normalizedCode) {
      setErrorMessage("Introduza o código recebido por email.");
      setSuccessMessage("");
      return;
    }

    if (!/^\d{4}$/.test(normalizedPin)) {
      setErrorMessage("O novo PIN deve ter 4 dígitos.");
      setSuccessMessage("");
      return;
    }

    if (normalizedPin !== normalizedConfirmPin) {
      setErrorMessage("A confirmação do PIN não corresponde.");
      setSuccessMessage("");
      return;
    }

    setBusyAction("reset-pin");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await resetPinRequest({ code: normalizedCode, new_pin: normalizedPin });
      setResetCode("");
      setNewPin("");
      setConfirmPin("");
      setPinCodeExpiresAt(null);
      await refreshSession();
      setSuccessMessage("PIN parental redefinido.");
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível redefinir o PIN parental.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const savePointsConversion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const pointsPerEuro = Number(pointsPerEuroInput);
    if (!Number.isInteger(pointsPerEuro) || pointsPerEuro < 1) {
      setErrorMessage("A conversão deve ser um número inteiro positivo.");
      setSuccessMessage("");
      return;
    }

    setBusyAction("points");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const nextSettings = await updateSettings(pointsPerEuro);
      setPointsPerEuroInput(String(nextSettings.points_per_euro));
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
                    Defina quantos pontos equivalem a 1 €.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <Label htmlFor="points-per-euro" className="text-[#404940]">
                  Pontos por euro
                </Label>
                <Input
                  id="points-per-euro"
                  type="number"
                  min="1"
                  step="1"
                  value={pointsPerEuroInput}
                  onChange={(event) => setPointsPerEuroInput(event.target.value)}
                  disabled={actionIsRunning}
                  className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                />
                <p className="text-sm text-[#59625a]">
                  Exemplo: {pointsPerEuroInput || DEFAULT_POINTS_PER_EURO} pontos = 1 €.
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
                Peça um código por email e use-o para definir um novo PIN de 4 dígitos.
              </p>

              <Button
                type="button"
                onClick={requestPinCode}
                disabled={actionIsRunning}
                className="mt-5 h-11 rounded-full border border-[#e1e2e4] bg-white px-5 text-sm font-semibold text-[#003514] hover:bg-[#f3f4f6] disabled:opacity-60"
              >
                {busyAction === "request-pin-code" ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Mail className="mr-2 size-4" aria-hidden="true" />
                )}
                Enviar código
              </Button>

              {pinCodeExpiresAt ? (
                <p className="mt-3 text-xs font-semibold text-[#59625a]">
                  Código válido até {new Date(pinCodeExpiresAt).toLocaleString("pt-PT")}.
                </p>
              ) : null}

              <form onSubmit={resetPin} className="mt-5 grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pin-reset-code" className="text-[#404940]">
                    Código de email
                  </Label>
                  <Input
                    id="pin-reset-code"
                    autoCapitalize="characters"
                    value={resetCode}
                    onChange={(event) => setResetCode(event.target.value.trim())}
                    disabled={actionIsRunning}
                    className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-parent-pin" className="text-[#404940]">
                      Novo PIN
                    </Label>
                    <Input
                      id="new-parent-pin"
                      type="password"
                      inputMode="numeric"
                      value={newPin}
                      onChange={(event) =>
                        setNewPin(event.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      disabled={actionIsRunning}
                      className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-parent-pin" className="text-[#404940]">
                      Confirmar PIN
                    </Label>
                    <Input
                      id="confirm-parent-pin"
                      type="password"
                      inputMode="numeric"
                      value={confirmPin}
                      onChange={(event) =>
                        setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      disabled={actionIsRunning}
                      className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={actionIsRunning}
                  className="h-11 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
                >
                  {busyAction === "reset-pin" ? (
                    <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <KeyRound className="mr-2 size-4" aria-hidden="true" />
                  )}
                  Redefinir PIN
                </Button>
              </form>
            </section>
          </section>
        </section>
      </main>
    </DashboardShell>
  );
};

export default SettingsPage;
