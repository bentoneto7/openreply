import { Flame, Siren, Snowflake, Thermometer, ThermometerSnowflake } from "lucide-react";
import type { LeadTemperature } from "@/lib/heatmap/priority";
import { TEMPERATURE_LABEL } from "@/lib/heatmap/priority";

/**
 * Temperatura do lead.
 *
 * A especificação proíbe depender só de cor, então cada faixa carrega três
 * codificações redundantes: rótulo escrito, ícone e nível em pontos. As cores
 * seguem uma rampa de luminância monotônica (98,2 → 94,5 → 91,3 → 80,0 → 40,2
 * em L*), que é o que mantém a ordem legível sob daltonismo — dicromacia
 * preserva luminância, mesmo quando o matiz colapsa.
 *
 * No tema escuro a rampa inverte o sentido, mantendo os mesmos matizes. Ela é
 * calibrada contra o fundo da página, não em absoluto: no claro, prioridade
 * baixa é quase branca e some no fundo branco. Repetir esses valores no escuro
 * faria a etiqueta mais fria virar a mais brilhante da tela e roubar a atenção
 * da mais quente — a hierarquia visual sairia de cabeça para baixo. Aqui o
 * escuro vai de slate-900 (some no fundo) a red-600 (salta), preservando tanto
 * a monotonia quanto o significado: brilho acompanha urgência.
 */
const config: Record<LeadTemperature, { className: string; icon: typeof Flame; level: number }> = {
  PRIORIDADE: {
    className: "border-red-700 bg-red-700 text-white dark:border-red-500 dark:bg-red-600",
    icon: Siren,
    level: 5,
  },
  QUENTE: {
    className:
      "border-orange-400 bg-orange-300 text-orange-950 dark:border-orange-600 dark:bg-orange-800 dark:text-orange-50",
    icon: Flame,
    level: 4,
  },
  INTERESSADO: {
    className:
      "border-amber-300 bg-amber-200 text-amber-900 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100",
    icon: Thermometer,
    level: 3,
  },
  ENGAJADO: {
    className:
      "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
    icon: ThermometerSnowflake,
    level: 2,
  },
  OBSERVADOR: {
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    icon: Snowflake,
    level: 1,
  },
};

export default function TemperatureBadge({ temperature, score }: { temperature: LeadTemperature; score?: number }) {
  const { className, icon: Icon, level } = config[temperature];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      {TEMPERATURE_LABEL[temperature]}
      <span aria-hidden="true" className="tracking-tighter">
        {"●".repeat(level)}
        <span className="opacity-40">{"○".repeat(5 - level)}</span>
      </span>
      <span className="sr-only">
        , nível {level} de 5{score === undefined ? "" : `, score ${score} de 100`}
      </span>
      {score !== undefined && <span aria-hidden="true" className="font-normal opacity-80">{score}</span>}
    </span>
  );
}
