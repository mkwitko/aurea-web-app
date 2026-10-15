/**
 * Quais seções de uma proposta o fundador já revisou.
 *
 * Revisar não é preencher: uma seção pode ser aberta, lida e salva vazia —
 * `currentPerformance` inteira é assim quando o fundador ainda não tem as
 * métricas. O backend continua (corretamente) chamando essa seção de
 * incompleta, porque o Growth Brain não ganhou dado nenhum; mas a tela do
 * negócio não pode continuar dizendo "proposta esperando revisão" sobre uma
 * seção que o fundador acabou de fechar. Um é sobre o dado, o outro é sobre a
 * atenção dele.
 *
 * Fica no `localStorage` e não no servidor porque é exatamente isso: estado da
 * atenção deste navegador sobre uma proposta que ainda não virou contexto.
 * Guardar um run só (o mais recente) é o que mantém a chave pequena — uma
 * proposta nova substitui a anterior de qualquer forma.
 */
const KEY = 'aurea.fillRun.reviewed';

interface Stored {
  runId: string;
  sections: string[];
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { runId, sections } = parsed as { runId?: unknown; sections?: unknown };
    if (typeof runId !== 'string' || !Array.isArray(sections)) return null;
    return { runId, sections: sections.filter((item): item is string => typeof item === 'string') };
  } catch {
    // Storage indisponível (modo privado, cota) ou JSON corrompido: a marca é
    // conveniência, não pode derrubar a tela.
    return null;
  }
}

/** As seções já revisadas desta proposta. Vazio para qualquer outro run. */
export function reviewedSections(runId: string | null): string[] {
  if (!runId) return [];
  const stored = read();
  return stored?.runId === runId ? stored.sections : [];
}

export function markReviewed(runId: string, section: string): void {
  const current = reviewedSections(runId);
  if (current.includes(section)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ runId, sections: [...current, section] }));
  } catch {
    /* idem: sem storage, a marca só não persiste */
  }
}
