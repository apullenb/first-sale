import "server-only";
import { OFFICIAL_FORMS } from "@/data/official-forms";
import { STRUCTURE_LABELS } from "@/lib/details";
import { priceLabel } from "@/lib/rules/products";
import { getMyBrandState, getMyBusiness, getMyDetails, getMyMarketing, getMyPaperwork, listMyProducts } from "@/lib/data/my-business";
import { formsFor } from "@/lib/documents/form-catalog";
import type { PlanSources } from "@/lib/documents/plan-facts";
import { placeOf, structureOf } from "@/lib/research/applicability";
import { planCosts } from "@/lib/rules/next-action";
import { stillToSettle } from "@/lib/rules/paperwork";

// Everything SnapStart already knows that a business plan can use, read for the signed-in owner
export async function myPlanSources(): Promise<PlanSources | null> {
  const [business, details, paper, products, brand, marketing] = await Promise.all([
    getMyBusiness(),
    getMyDetails(),
    getMyPaperwork(),
    listMyProducts(),
    getMyBrandState(),
    getMyMarketing(),
  ]);
  const profile = business?.profile;
  if (!profile) return null;

  const decision = structureOf(profile, details);
  const where = placeOf(profile);
  // Only steps that apply, as Start your business lists them
  const steps = (paper?.basis ? paper.view.tasks : []).map((task) => ({ ...task.step, requirementStatus: task.requirementStatus, conditions: task.conditions }));
  // Fees as Start your business shows them: research first, then the checked forms catalog
  const priced = steps.map((step) => {
    const form = formsFor(OFFICIAL_FORMS, step, where, decision.structure).find((each) => !each.kept) ?? null;
    return {
      ...step,
      feeCents: step.feeCents ?? form?.fee?.cents ?? null,
      renewal: step.renewal ?? (form?.renewal ? { text: form.renewal.text, feeCents: form.renewal.cents } : null),
      formKey: form?.key ?? null,
    };
  });
  const costs = steps.length ? planCosts(priced) : null;
  const brief = brand?.brief ?? null;
  const approvedMarketing = marketing?.approvedAt && marketing.plan ? marketing.plan : null;

  return {
    profile,
    structure: decision.structure && decision.from ? { name: STRUCTURE_LABELS[decision.structure], from: decision.from } : null,
    products: products.map((product) => ({ name: product.name, priceCents: product.priceCents, price: priceLabel(product), unitCostCents: product.unitCostCents })),
    brand: brief ? { customers: brief.customers, tagline: brief.tagline, story: brief.storyApproved ? brief.story : "" } : null,
    marketing: approvedMarketing ? { summary: approvedMarketing.summary, audience: approvedMarketing.audience.who } : null,
    fees: costs ? { confirmed: costs.startup, maybe: costs.maybe, unconfirmed: costs.unknown } : null,
    // Rules still to settle are listed as "if it applies", never as steps
    steps: [
      ...steps.map((step) => ({ title: step.title, done: step.status === "done", conditional: step.requirementStatus === "conditional" })),
      ...(paper?.basis ? stillToSettle(paper.view) : []).map((standing) => ({ title: standing.step.title, done: false, conditional: true })),
    ],
    progress: steps.length ? { done: steps.filter((step) => step.status === "done").length, total: steps.length } : null,
    purpose: details.find((detail) => detail.key === "business_purpose")?.value.trim() || null,
  };
}
