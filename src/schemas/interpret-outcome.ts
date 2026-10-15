import { z } from 'zod';

/**
 * The run's output, re-parsed on the client. `AgentRun.output` is Json, so a
 * refused or half-written run can hold anything — the panel renders only what
 * matches this shape. Deliberately `.strict()`: a verdict field the backend
 * never defined must not reach the screen.
 */
export const interpretOutcomeOutput = z
  .object({
    reading: z.string().min(1),
    drivers: z.array(z.string().min(1)).min(1).max(3),
    caveats: z.array(z.string().min(1)).max(3),
    learning: z
      .object({
        title: z.string().min(1),
        statement: z.string().min(1),
        evidence: z.array(z.string().min(1)).min(1).max(5),
        confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
      })
      .strict(),
  })
  .strict();

export type InterpretOutcomeOutput = z.infer<typeof interpretOutcomeOutput>;

// Mirrors the agent's `inputSchema` (`{ experimentId: uuid }`) in
// `back/src/ai/agents/interpret-outcome.ts`. `AgentRun.input` is unknown on
// the wire same as `output` — a run's own input is the only honest source for
// "which experiment was this run about" — exactly the reasoning
// `parseRunGoalId` (`schemas/strategy-proposal.ts`) already applies to
// `research-growth-context` and `propose-strategies` runs.
const runInputSchema = z.object({ experimentId: z.string() });

export function parseRunExperimentId(input: unknown): string | null {
  const parsed = runInputSchema.safeParse(input);
  return parsed.success ? parsed.data.experimentId : null;
}
