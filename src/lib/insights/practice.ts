import type { InsightReplyItem, InsightsReply } from "./types";

// Practice mode: sample insights from fixed rules over the same facts the model would read. Labeled on the page.

interface SampleFacts {
  businessName?: string;
  launch?: { date: string } | null;
  answers?: { question: string; answer: string; notSure?: boolean }[];
  decisions?: { label: string; value: string }[];
  requirements?: unknown;
  startupPlan?: { stepsBeforeSelling: number; stepsBeforeSellingDone: number } | string;
  brand?: unknown;
  website?: unknown;
}

function readFacts(message: string): SampleFacts {
  const match = message.match(/<facts>\n([\s\S]*?)\n<\/facts>/);
  try {
    return match ? (JSON.parse(match[1]) as SampleFacts) : {};
  } catch {
    return {};
  }
}

const item = (title: string, detail: string, action: string, link: InsightReplyItem["link"]): InsightReplyItem => ({ title, detail, action, link, stepKey: null });

export function samplesFromMessage(message: string): InsightsReply {
  const facts = readFacts(message);
  const answer = (question: string) => facts.answers?.find((each) => each.question === question)?.answer ?? "";
  const plan = typeof facts.startupPlan === "object" ? facts.startupPlan : null;
  const checked = typeof facts.requirements === "object" && facts.requirements !== null;
  const name = facts.businessName ?? "your business";
  const sells = answer("What you’ll sell");
  const channels = answer("How you’ll sell");
  const unsure = (facts.answers ?? []).some((each) => each.notSure);

  const strengths: InsightReplyItem[] = [];
  if (sells) {
    strengths.push(item("You know what you’ll sell", `You’ve chosen ${sells.charAt(0).toLowerCase()}${sells.slice(1)}. A clear first offer makes it easy for customers to say yes.`, "", "business"));
  }
  if (facts.launch) {
    strengths.push(item("You’ve set a launch date", `Your goal for a first sale is ${facts.launch.date}. A date on the calendar turns an idea into a plan.`, "", "checklist"));
  }
  if (plan && plan.stepsBeforeSellingDone > 0) {
    strengths.push(
      item("You’re making real progress", `You’ve finished ${plan.stepsBeforeSellingDone} of ${plan.stepsBeforeSelling} steps before your first sale. Every one counts.`, "", "checklist"),
    );
  } else if (checked) {
    strengths.push(item("You looked up the rules early", "You already know what applies where you are, so there are fewer surprises later.", "", "requirements"));
  } else {
    strengths.push(item("You’re asking the right questions early", "Answering SnapStart’s questions before you spend money is a smart way to start.", "", "business"));
  }

  const watch: InsightReplyItem[] = [];
  if (!checked) {
    watch.push(
      item(
        "See which rules apply to you",
        "Every place has its own rules for new businesses. SnapStart reads the official pages for where you are and works out what applies.",
        "Open What applies to you, and SnapStart starts checking.",
        "requirements",
      ),
    );
  } else if (plan && plan.stepsBeforeSellingDone < plan.stepsBeforeSelling) {
    watch.push(
      item("Keep your next steps moving", "Small steps add up. Your list shows the one to do next, and what can happen at the same time.", "Open your list of steps and pick the next one.", "checklist"),
    );
  }
  if (/pickup/i.test(answer("How customers get orders")) && !facts.decisions?.some((each) => each.label === "Pickup hours and place")) {
    watch.push(
      item(
        "Tell customers when and where to pick up",
        "Clear pickup times and a spot that’s easy to find save back-and-forth messages and missed pickups.",
        "Write down your pickup hours and place.",
        "pickup",
      ),
    );
  }
  if (unsure) {
    watch.push(
      item(
        "A few answers are still open",
        "Some answers are marked “not sure”. That’s normal at this stage, and settling them helps SnapStart tailor your steps.",
        "Look over your answers when you know more.",
        "business",
      ),
    );
  }

  const tips: InsightReplyItem[] = [
    /Markets/.test(channels)
      ? item("Make your table easy to say yes to", "A clear sign with your name, prices on every item and a way to pay by card help shoppers decide quickly.", "Sketch your table layout before your first market.", null)
      : item("Start with people who already know you", "Friends, neighbors and coworkers are often the first to buy and the first to tell others.", "Make a list of ten people to tell when you launch.", null),
    item("Keep a simple record of every sale", "A notebook or a spreadsheet is enough to start. It shows what sells best and what to make more of.", "Set up your sales list before your first sale.", null),
  ];

  const ideas: InsightReplyItem[] = [
    facts.brand === "Not started"
      ? item("Give your business a look people remember", "A simple logo and a couple of colors on your labels, signs and posts help customers recognize you.", "Try Create your logo when you’re ready.", "logo")
      : item("Put your logo everywhere customers see you", "Use your logo on bags, labels and posts, so every sale reminds people of you.", "", "logo"),
    facts.website === "Not started"
      ? item("Give customers a place to find you online", "Even a one-page site with what you sell and how to order helps new customers trust you.", "Compare website options when you have time.", "website")
      : item("Thank your first customers", "A handwritten note or a small extra with a first order turns buyers into fans.", "", null),
  ];

  return {
    opening: `${name.charAt(0).toUpperCase()}${name.slice(1)} is off to a real start. These are sample insights, so you can see how this page works.`,
    strengths,
    watch,
    tips,
    ideas,
  };
}
