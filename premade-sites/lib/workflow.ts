import { z } from 'zod';

export const WORKFLOW_FORMAT = 'pagecraft.template-workflow.v1' as const;
export const VIEWPORTS = [390, 768, 1024, 1440] as const;
export const EDIT_CHECKS = ['global-colors', 'global-typography', 'replace-images', 'long-headings', 'duplicate-reorder-delete', 'shared-and-instance-styles', 'responsive-inspector', 'save-reopen', 'publish-output', 'media-and-links', 'global-navigation-footer', 'form-behavior', 'stress-content'] as const;
export const VISUAL_CHECKS = ['text-floor', 'containers', 'image-crops', 'overflow', 'keyboard', 'mobile-menu', 'console', 'composition', 'responsive-hierarchy'] as const;
const text = z.string().trim().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const evidence = z.object({ path: text, sha256: hash });
const decision = z.object({ actor: z.literal('user'), outcome: z.enum(['approved', 'rejected']), quote: text, at: z.string().datetime(), evidence: text });
const fingerprint = z.object({ header: text, hero: text, textAnchor: text, inventory: text, cta: text, footer: text });
export const workflowSchema = z.object({
  format: z.literal(WORKFLOW_FORMAT),
  brief: z.object({ audience: text, primaryAction: text, pages: z.array(text).min(1), content: text, imagery: text, provenance: z.array(z.object({ asset: text, source: text, license: text })).default([]) }),
  directions: z.array(z.object({ id: text, thesis: text, fingerprint, comparison: text, sections: z.array(z.object({ purpose: text, archetype: text, composition: text, typography: text, imagery: text, action: text })).min(2) })),
  selection: z.object({ directionId: text, decision }).nullable(),
  targets: z.object({ cloud: z.object({ hostRevision: text, editorVersion: text }), wordpress: z.object({ hostRevision: text, editorVersion: text }) }).nullable(),
  findings: z.array(z.object({ severity: z.enum(['error', 'warning']), page: text, node: text, viewport: text, detail: text, correction: text, resolved: z.boolean() })),
  qa: z.array(z.object({ host: z.enum(['cloud', 'wordpress']), packageSha256: hash, hostRevision: text, editorVersion: text, at: z.string().datetime(), editChecks: z.array(z.enum(EDIT_CHECKS)), pages: z.array(z.object({ slug: text, viewport: z.number().int().positive(), checks: z.array(z.enum(VISUAL_CHECKS)) })), breakpointChecks: text, evidence: z.array(evidence).min(1) })),
  visualReview: z.object({ packageSha256: hash, verdict: z.enum(['pass', 'revise']), rationale: text, evidence: z.array(evidence).min(1) }).nullable(),
  approval: z.object({ packageSha256: hash, decision }).nullable(),
});
export type Workflow = z.infer<typeof workflowSchema>;
export function newWorkflow(): Workflow {
  return { format: WORKFLOW_FORMAT, brief: { audience: 'Define the intended audience', primaryAction: 'Define the primary action', pages: ['index'], content: 'Write the content brief', imagery: 'Assign image roles', provenance: [] }, directions: [], selection: null, targets: null, findings: [], qa: [], visualReview: null, approval: null };
}

/** Structured records are a review ledger, not proof that an agent performed a check. */
export function promotionFindings(value: unknown, packageSha256: string, pages: string[]): string[] {
  const parsed = workflowSchema.safeParse(value);
  if (!parsed.success) return parsed.error.issues.map(issue => `workflow:${issue.path.join('.')}: ${issue.message}`);
  const w = parsed.data;
  const out: string[] = [];
  if (w.directions.length < 3 || new Set(w.directions.map(d => d.id)).size !== w.directions.length) out.push('direction: record three distinct candidate ids');
  if (!w.selection || w.selection.decision.outcome !== 'approved' || !w.directions.some(d => d.id === w.selection?.directionId)) out.push('direction: user selection is required');
  if (w.brief.pages.slice().sort().join('\n') !== pages.slice().sort().join('\n')) out.push('brief: sitemap must match packaged pages');
  for (const f of w.findings.filter(f => !f.resolved && f.severity === 'error')) out.push(`${f.page}:${f.node}:${f.viewport}: ${f.detail}; fix: ${f.correction}`);
  for (const host of ['cloud', 'wordpress'] as const) {
    const target = w.targets?.[host];
    const qa = w.qa.filter(q => q.host === host && q.packageSha256 === packageSha256 && q.hostRevision === target?.hostRevision && q.editorVersion === target?.editorVersion).sort((a, b) => b.at.localeCompare(a.at))[0];
    if (!qa) { out.push(`${host}: current package and pinned host/editor QA required`); continue; }
    for (const check of EDIT_CHECKS) if (!qa.editChecks.includes(check)) out.push(`${host}: editing exercise missing ${check}`);
    for (const page of pages) for (const width of VIEWPORTS) {
      const row = qa.pages.find(p => p.slug === page && p.viewport === width);
      for (const check of VISUAL_CHECKS) if (!row?.checks.includes(check)) out.push(`${host}:${page}:${width}: verify ${check}`);
    }
  }
  if (w.visualReview?.packageSha256 !== packageSha256 || w.visualReview.verdict !== 'pass') out.push('visual-review: current package must pass independent rendered review');
  if (w.approval?.packageSha256 !== packageSha256 || w.approval.decision.outcome !== 'approved') out.push('approval: explicit user approval of current package required');
  return out;
}
