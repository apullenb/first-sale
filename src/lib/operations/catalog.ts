export const OPERATION_KINDS = ["email", "requests"] as const;
export type OperationKind = (typeof OPERATION_KINDS)[number];

export const OPERATIONS = {
  email: {
    title: "Connect your email",
    href: "/email",
    description: "Forward customer emails to your own SnapStart address. They become orders or requests for you to check, with replies you send from your own email.",
    trigger: "You forward a customer email to your SnapStart address.",
    steps: ["Read emails sent to your SnapStart address", "Prepare a reply using your saved business details", "Put the draft in your review queue"],
    choices: ["Gmail", "Outlook", "Other email"],
    sourceLabel: "Which email service do you use?",
    goals: ["Draft customer replies", "Flag messages that need my attention"],
  },
  requests: {
    title: "Orders & jobs",
    href: "/orders",
    description: "Track customer work, due dates, progress and payments in one place.",
    trigger: "An order or customer request arrives from your chosen source.",
    steps: ["Create an item for review", "Flag missing details and show a follow-up reminder", "Wait for you to confirm the next step"],
    choices: ["Email", "Website", "Enter requests myself"],
    sourceLabel: "Where do your requests come from?",
    goals: ["Track orders", "Track questions and custom requests"],
  },
} as const;
