import { z } from 'zod';

/**
 * Mirrors the agent's output schema in
 * `back/src/ai/agents/research-growth-context.ts`.
 *
 * The contract types `AgentRun.output` as `unknown`, which is honest: it holds
 * whatever the task type produced. The page parses instead of casting — a cast
 * would turn a malformed run into a crash halfway through a render.
 *
 * Length caps are the backend's business, since it validated the output before
 * persisting it. What is kept here is everything the UI actually branches on:
 * the target (which decides whether a finding is selectable) and the shape of
 * a competitor (which renders differently from a plain statement).
 *
 * Two deliberate divergences from the backend schema:
 *
 * - `sourceUrl` and `competitor.url` stay plain strings, not `z.string().url()`.
 *   The backend validates the URL shape on Zod 3; this repo is on Zod 4, whose
 *   URL validation is not the same, so a URL the backend accepted and stored
 *   could be rejected here — and because a rejected parse fails the *whole*
 *   result, that would trade one bad link for an entire run the founder can't
 *   see. The cost of accepting a bad URL is contained downstream instead, at
 *   the render: the finding card parses the URL once inside a try/catch and
 *   uses that single parse for both decisions it needs — an unparseable URL
 *   renders as a link without a domain label, and a URL whose scheme is not
 *   http or https renders as plain text with no link at all. Containing it
 *   there costs one bad link; containing it here would cost the whole run.
 * - Every upper bound is dropped here (`findings`, `opportunities`,
 *   `strengths`, `weaknesses`, `supportingFindings`), unlike the sibling
 *   `strategy-proposal.ts`, which keeps `min(2).max(3)` on its options. That
 *   sibling's side-by-side layout depends on there being exactly two or three
 *   options — a structural bound the layout needs. This file's UI is a
 *   vertical list that renders whatever count arrives, so there is no layout
 *   depending on a cap; the backend's own caps are a business rule it already
 *   enforced before persisting, not something this parser needs to repeat.
 */
const competitorSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  positioning: z.string().optional(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
});

const findingSchema = z.object({
  dimension: z.enum(['MARKET', 'COMPETITOR', 'CUSTOMER', 'TREND']),
  statement: z.string(),
  evidence: z.string(),
  sourceUrl: z.string(),
  sourceTitle: z.string(),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  target: z.enum(['TREND', 'THREAT', 'COMPETITOR', 'NONE']),
  competitor: competitorSchema.optional(),
});

const opportunitySchema = z.object({
  statement: z.string(),
  rationale: z.string(),
  supportingFindings: z.array(z.number()),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

const researchSchema = z.object({
  summary: z.string(),
  findings: z.array(findingSchema).min(1),
  opportunities: z.array(opportunitySchema).default([]),
});

export type ResearchResult = z.infer<typeof researchSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type Opportunity = z.infer<typeof opportunitySchema>;

export function parseResearch(output: unknown): { ok: true; value: ResearchResult } | { ok: false } {
  const parsed = researchSchema.safeParse(output);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}
