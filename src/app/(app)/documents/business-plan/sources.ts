import "server-only";
import { OFFICIAL_FORMS } from "@/data/official-forms";
import { STRUCTURE_LABELS } from "@/lib/details";
import { getMyBrandState, getMyBusiness, getMyDetails, getMyMarketing, getMyPlan, listMyProducts } from "@/lib/data/my-business";
import { formsFor } from "@/lib/documents/form-catalog";
import type { PlanSources } from "@/lib/documents/plan-facts";
import { placeOf, structureOf } from "@/lib/research/applicability";
import { planCosts } from "@/lib/rules/next-action";

// Everything First Sale already knows that a business plan can use, read for the signed-in owner
export async function myPlanSources(): Promise<PlanSources | null> {
  const [business, details, plan, products, brand, marketing] = await Promise.all([
    getMyBusiness(),
    getMyDetails(),
    getMyPlan(),
    listMyProducts(),
    getMyBrandState(),
    getMyMarketing(),
  ]);
  const profile = business?.profile;
  if (!profile) return null;

  const decision = structureOf(profile, details);
  const where = placeOf(profile);
  const steps = plan?.steps ?? [];
  // Fees as Licenses and registrations shows them: research first, then the checked forms catalog
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
    products: products.map((product) => ({ name: product.name, priceCents: product.priceCents })),
    brand: brief ? { customers: brief.customers, tagline: brief.tagline, story: brief.storyApproved ? brief.story : "" } : null,
    marketing: approvedMarketing ? { summary: approvedMarketing.summary, audience: approvedMarketing.audience.who } : null,
    fees: costs ? { confirmed: costs.startup, maybe: costs.maybe, unconfirmed: costs.unknown } : null,
    steps: steps
      .filter((step) => step.requirementStatus !== "optional" && step.requirementStatus !== "outside_coverage")
      .map((step) => ({ title: step.title, done: step.status === "done", conditional: step.requirementStatus === "conditional" })),
    progress: steps.length ? { done: steps.filter((step) => step.status === "done").length, total: steps.length } : null,
    purpose: details.find((detail) => detail.key === "business_purpose")?.value.trim() || null,
  };
}
