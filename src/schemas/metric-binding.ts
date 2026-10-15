import { z } from 'zod';

/**
 * A saída do agente `propose-metric-binding`, validada antes de tocar o
 * formulário. `binding: null` é resposta, não falha: o agente devolve vazio com
 * o motivo em vez de escolher a métrica mais parecida.
 */
export const proposeMetricBindingOutput = z.object({
  binding: z
    .object({
      metric: z.string().min(1),
      dimensionFilter: z
        .object({ fieldName: z.string().min(1), value: z.string().min(1) })
        .nullish(),
    })
    .nullable(),
  rationale: z.string().min(1),
});

export type ProposeMetricBindingOutput = z.infer<typeof proposeMetricBindingOutput>;

/** Os dois campos do filtro andam juntos: metade de um filtro não é um filtro. */
export const metricBindingFormSchema = z
  .object({
    metric: z.string().trim().min(1, 'pages.experiments.binding.metricRequired'),
    filterField: z.string().trim().optional(),
    filterValue: z.string().trim().optional(),
  })
  .refine((values) => Boolean(values.filterField) === Boolean(values.filterValue), {
    message: 'pages.experiments.binding.bothFilterFields',
    path: ['filterValue'],
  });

export type MetricBindingFormValues = z.infer<typeof metricBindingFormSchema>;
