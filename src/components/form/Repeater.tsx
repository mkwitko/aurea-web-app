import { useEffect, useState, type ReactNode } from 'react';
import { nanoid } from 'nanoid';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export interface RepeaterProps<T> {
  items: T[] | undefined;
  onChange: (items: T[]) => void;
  /** Fábrica do item vazio. Use as constantes EMPTY_* de types/business-context. */
  newItem: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  itemLabel: (index: number) => string;
  addLabel: string;
  removeLabel: string;
  emptyLabel?: string;
}

/**
 * Array de objetos editável. Três tipos do domínio (CampaignKpi,
 * ChannelPerformance, Competitor) não têm `id`, então o índice seria a única
 * `key` disponível — e índice como key remonta os inputs quando um item do meio
 * é removido, fazendo o texto do usuário saltar de linha. Por isso o Repeater
 * mantém sua própria lista de keys estáveis, em `useState` (não `useRef`): mutar
 * um ref durante o render é descartável sob StrictMode/transições — um render
 * abandonado deixaria o ref mutado para um commit que nunca aconteceu. A
 * re-sincronização por tamanho (quando `items` é substituído de fora, ex.: um
 * futuro preenchimento por IA) acontece só depois do commit, num `useEffect`.
 */
export function Repeater<T>({
  items,
  onChange,
  newItem,
  renderItem,
  itemLabel,
  addLabel,
  removeLabel,
  emptyLabel,
}: RepeaterProps<T>) {
  const list = items ?? [];
  const [keys, setKeys] = useState<string[]>(() => list.map(() => nanoid()));

  useEffect(() => {
    setKeys((prev) => {
      if (prev.length === list.length) return prev;
      if (prev.length < list.length) {
        return [...prev, ...Array.from({ length: list.length - prev.length }, () => nanoid())];
      }
      return prev.slice(0, list.length);
    });
  }, [list.length]);

  const add = () => {
    setKeys((prev) => [...prev, nanoid()]);
    onChange([...list, newItem()]);
  };

  const removeAt = (index: number) => {
    setKeys((prev) => prev.filter((_, i) => i !== index));
    onChange(list.filter((_, i) => i !== index));
  };

  const updateAt = (index: number, patch: Partial<T>) => {
    onChange(list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="space-y-4">
      {list.length === 0 && emptyLabel && (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      )}

      {list.map((item, index) => (
        // "$" nunca aparece num nanoid — sentinela segura para a linha ainda
        // sem key própria no primeiro paint após uma substituição externa de
        // `items`, antes do useEffect gerar a key real. Cada índice pendente
        // recebe seu próprio placeholder, então duas linhas novas nunca
        // colidem entre si nem com uma key real já existente.
        <Card key={keys[index] ?? `$pending-${index}`}>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-semibold">{itemLabel(index)}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={removeLabel}
                onClick={() => removeAt(index)}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
                {removeLabel}
              </Button>
            </div>
            {renderItem(item, (patch) => updateAt(index, patch), index)}
          </CardContent>
        </Card>
      ))}

      <Button type="button" variant="outline" onClick={add} className="w-full gap-1.5">
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </div>
  );
}
