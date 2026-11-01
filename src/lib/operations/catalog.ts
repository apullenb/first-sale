export const OPERATION_KINDS = ["email", "requests"] as const;
export type OperationKind = (typeof OPERATION_KINDS)[number];

export const OPERATIONS = {
  email: {
    title: "Connect your email",
    href: "/email",
    description: "Keep customer messages together and prepare replies for your review.",
    trigger: "A customer email arrives in the inbox you choose.",
    steps: ["Read messages from your chosen inbox", "Prepare a reply using your saved business details", "Put the draft in your review queue"],
    choices: ["Gmail", "Outlook", "Other email"],
    sourceLabel: "Which email service do you use?",
    goals: ["Draft customer replies", "Flag messages that need my attention"],
  },
  requests: {
    title: "Track orders & customer requests",
    href: "/orders",
    description: "Turn incoming requests into a list of work, with reminders to follow up.",
    trigger: "An order or customer request arrives from your chosen source.",
    steps: ["Create an item for review", "Flag missing details and show a follow-up reminder", "Wait for you to confirm the next step"],
    choices: ["Email", "Website", "Enter requests myself"],
    sourceLabel: "Where do your requests come from?",
    goals: ["Track orders", "Track questions and custom requests"],
  },
} as const;
