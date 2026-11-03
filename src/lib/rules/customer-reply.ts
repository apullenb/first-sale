import type { ExtractedRequest } from "@/lib/orders/extract";

export function draftCustomerReply(request: ExtractedRequest): string {
  if (request.category === "supplier_bill" || request.category === "other")
    return "";
  const greeting = request.customerName
    ? `Hi ${request.customerName},`
    : "Hello,";
  const questions = [
    !request.title ? "Could you describe what you need?" : "",
    !request.requestedDate
      ? `What date would you need ${request.category === "job" ? "the work" : "your order"}?`
      : "",
    request.category === "job" && !request.location
      ? "Where would the work take place?"
      : "",
  ].filter(Boolean);
  return `${greeting}\n\nThanks for getting in touch${request.title ? ` about ${request.title}` : ""}. I’m reviewing your ${request.category === "job" ? "job" : request.category === "update" ? "requested changes" : "request"}. ${questions.length ? questions.join(" ") : "I’ll check the details and get back to you."}\n\nI’ll confirm availability, timing and payment details with you before accepting or changing the work.`;
}
