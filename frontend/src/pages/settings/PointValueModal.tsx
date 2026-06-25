import { LoaderCircle, Save } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/context/useToast";
import { setPointValue } from "@/services/profileService";

type PointValueModalProps = {
  initialPointValue: string;
  onClose: () => void;
  onSaved: (pointValueEur: string, message: string) => void;
};

const PointValueModal = ({ initialPointValue, onClose, onSaved }: PointValueModalProps) => {
  const { showToast } = useToast();
  const [pointValueInput, setPointValueInput] = useState(initialPointValue);
  const [submitting, setSubmitting] = useState(false);

  const previewEuros = pointValueInput
    ? (Number(pointValueInput) * 100).toLocaleString("pt-PT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";

  const savePointsConversion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const pointValue = Number(pointValueInput);
    if (!Number.isFinite(pointValue) || pointValue <= 0 || pointValue > 1000) {
      showToast("O valor de 1 ponto deve estar entre 0 e 1000 €.", "error");
      return;
    }

    // The backend stores up to 4 decimal places (e.g. 0.0001 = 100 pontos por 0,01 €).
    const decimals = (pointValueInput.split(".")[1] ?? "").length;
    if (decimals > 4) {
      showToast("Use no máximo 4 casas decimais (ex.: 0,0001).", "error");
      return;
    }

    setSubmitting(true);

    try {
      const next = await setPointValue(pointValueInput.trim());
      onSaved(String(Number(next.point_value_eur)), "Conversão de pontos atualizada.");
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível atualizar a conversão de pontos.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Alterar conversão" onClose={onClose} closeDisabled={submitting}>
      <p className="mt-2 text-sm leading-5 text-[#404940]">
        Defina quanto vale 1 ponto em euros, até 4 casas decimais (ex.: 0,0001 € →
        100 pontos = 0,01 €).
      </p>
      <p className="mt-2 text-xs leading-5 text-[#59625a]">
        Nota: a recompensa mínima de uma tarefa é sempre 1 ponto.
      </p>

      <form onSubmit={savePointsConversion} className="mt-4">
        <div className="space-y-2">
          <Label htmlFor="point-value" className="text-[#404940]">
            1 ponto = {pointValueInput || "—"} €
          </Label>
          <Input
            id="point-value"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={pointValueInput}
            onChange={(event) => setPointValueInput(event.target.value)}
            disabled={submitting}
            className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
          />
          <p className="text-sm text-[#59625a]">Pré-visualização: 100 pontos = {previewEuros} €.</p>
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
              <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="mr-2 size-4" aria-hidden="true" />
            )}
            Guardar conversão
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default PointValueModal;
