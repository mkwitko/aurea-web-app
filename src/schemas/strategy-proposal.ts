import { z } from 'zod';

/**
 * Mirrors the agent's output schema in
 * `back/src/ai/agents/propose-strategies.ts`.
 *
 * The contract types `AgentRun.output` as `unknown`, which is honest: it holds
 * whatever the task type produced. The page parses instead of casting — a cast
 * would turn a malformed run into a crash halfway through a render.
 */
const hypothesisSchema = z.object({
  statement: z.string(),
  rationale: z.string(),
  targetMetric: z.string(),
  expectedOutcome: z.string(),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

const optionSchema = z.object({
  name: z.string(),
  strategicThesis: z.string(),
  growthMechanism: z.string(),
  expectedOutcome: z.string(),
  channels: z.array(z.string()),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
  tradeoffs: z.string(),
  hypotheses: z.array(hypothesisSchema),
  // Titles of the learnings this option leans on. Optional because the first
  // cycle has none, and old runs stored before the field existed must still
  // parse.
  basedOnLearnings: z.array(z.string()).optional(),
});

// Count bounds stay because the UI's side-by-side layout depends on them;
// length caps are the backend's business, since it validated the output
// before persisting it.
const proposalSchema = z
  .object({
    options: z.array(optionSchema).min(2).max(3),
    recommendedIndex: z.number().int().min(0),
    rationale: z.string(),
  })
  .refine((value) => value.recommendedIndex < value.options.length);

export type Proposal = z.infer<typeof proposalSchema>;
export type ProposedOption = z.infer<typeof optionSchema>;

export function parseProposal(output: unknown): { ok: true; value: Proposal } | { ok: false } {
  const parsed = proposalSchema.safeParse(output);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}

// Mirrors propose-strategies' `inputSchema` (`{ goalId: uuid }`) on the back
// end. `AgentRun.input` is unknown on the wire same as `output` — a run's own
// input is the only honest source for "which goal was this run about", so
// pages that name it parse here instead of casting straight into a uuid.
const runInputSchema = z.object({ goalId: z.string() });

export function parseRunGoalId(input: unknown): string | null {
  const parsed = runInputSchema.safeParse(input);
  return parsed.success ? parsed.data.goalId : null;
}
