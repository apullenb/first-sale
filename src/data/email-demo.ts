// Sample customer emails for the forwarding demo (/email/demo). Made up; nothing here is real or saved.

export const DEMO_BUSINESS = "Maple & Crumb Bakery";
export const DEMO_ADDRESS = "maple-crumb+sample@inbound.example";
export const DEMO_OWNER_EMAIL = "hello@maplecrumb.example";
export const DEMO_CODE = "482913";

export interface DemoEmail {
  id: string;
  subject: string;
  fromName: string;
  from: string;
  // Set when the owner forwarded it from their own inbox
  forwardedBy?: string;
  via?: string;
  received: string;
  body: string;
  attachment?: { name: string; size: string };
  result: {
    kind: "order" | "request";
    // What the card is called once read, like "2 dozen chocolate chip cookies"
    title: string;
    items: { name: string; quantity: string }[];
    when: string;
    notes?: string;
    reply: string;
  };
}

export const DEMO_EMAILS: DemoEmail[] = [
  {
    id: "cookies",
    subject: "Order for Saturday pickup: 2 dozen chocolate chip cookies",
    fromName: "Dana Whitfield",
    from: "dana.whitfield@example.com",
    received: "8:12 AM",
    body: "Hi there!\n\nI’d like to order 2 dozen chocolate chip cookies for pickup this Saturday around 10 am. They’re for my son’s soccer team, so no nuts please.\n\nThanks so much,\nDana",
    result: {
      kind: "order",
      title: "2 dozen chocolate chip cookies",
      items: [{ name: "Chocolate chip cookies", quantity: "2 dozen" }],
      when: "Pickup Saturday, about 10 am",
      notes: "No nuts, for a soccer team",
      reply:
        "Hi Dana,\n\nThanks for your order! 2 dozen chocolate chip cookies (no nuts) will be ready for pickup Saturday at 10 am.\n\nSee you then,\nMaple & Crumb Bakery",
    },
  },
  {
    id: "cake",
    subject: "Do you do custom birthday cakes?",
    fromName: "Marcus Lee",
    from: "marcus.lee@example.net",
    received: "9:40 AM",
    body: "Hello,\n\nDo you make custom birthday cakes? My daughter turns 7 on the 21st and loves dinosaurs. We’d need something for about 20 people. What flavors do you have, and how much would that be?\n\nMarcus",
    result: {
      kind: "request",
      title: "Custom dinosaur birthday cake",
      items: [{ name: "Custom birthday cake, dinosaur theme", quantity: "1 (serves about 20)" }],
      when: "Needed by the 21st",
      notes: "Asks which flavors you offer and the price",
      reply:
        "Hi Marcus,\n\nWe’d love to make your daughter’s dinosaur cake! For about 20 people we suggest a two-layer cake. Our flavors are vanilla, chocolate and lemon.\n\nI’ll send you a price once you pick a flavor.\n\nMaple & Crumb Bakery",
    },
  },
  {
    id: "breakfast",
    subject: "Fwd: Office breakfast order for Friday",
    fromName: "Priya Shah",
    from: "priya.shah@northwind.example",
    forwardedBy: DEMO_OWNER_EMAIL,
    via: "Forwarded from Gmail",
    received: "11:05 AM",
    body: "---------- Forwarded message ---------\nFrom: Priya Shah <priya.shah@northwind.example>\nSubject: Office breakfast order for Friday\n\nHi! Could we get 3 dozen assorted muffins and 1 cinnamon coffee cake for our team breakfast this Friday? I can pick up at 7:30 am.\n\nThank you,\nPriya",
    result: {
      kind: "order",
      title: "Office breakfast for Northwind",
      items: [
        { name: "Assorted muffins", quantity: "3 dozen" },
        { name: "Cinnamon coffee cake", quantity: "1" },
      ],
      when: "Pickup Friday, 7:30 am",
      reply:
        "Hi Priya,\n\nThanks for thinking of us! 3 dozen assorted muffins and a cinnamon coffee cake will be ready Friday at 7:30 am.\n\nMaple & Crumb Bakery",
    },
  },
  {
    id: "wholesale",
    subject: "Weekly wholesale order, PO 1182",
    fromName: "Hilltop Café",
    from: "orders@hilltopcafe.example",
    received: "2:47 PM",
    body: "Hi Maple & Crumb team,\n\nAttached is this week’s purchase order. Same delivery time as usual, Tuesday before 7 am.\n\nThanks,\nHilltop Café",
    attachment: { name: "PO-1182.pdf", size: "84 KB" },
    result: {
      kind: "order",
      title: "Hilltop Café weekly order",
      items: [
        { name: "Sourdough loaves", quantity: "6" },
        { name: "Butter croissants", quantity: "4 dozen" },
      ],
      when: "Delivery Tuesday, before 7 am",
      notes: "Read from the attached PO-1182.pdf",
      reply:
        "Hi Hilltop team,\n\nGot PO 1182: 6 sourdough loaves and 4 dozen croissants for Tuesday before 7 am. We’ll have them there.\n\nThanks,\nMaple & Crumb Bakery",
    },
  },
];
