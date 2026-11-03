// Sample customer emails for the email demo (/email/demo). Made up; confirmed ones become DEMO orders.

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
    // order and quote go to Orders & jobs; update and question get a reply only
    kind: "order" | "quote" | "update" | "question";
    // What the card is called once read, like "2 dozen chocolate chip cookies"
    title: string;
    items: { name: string; quantity: string }[];
    when: string;
    notes?: string;
    // Tracker fields the email states exactly; anything looser stays in "when"
    fulfillment?: "pickup" | "delivery" | "shipping";
    jobTime?: string;
    location?: string;
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
      fulfillment: "pickup",
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
      kind: "quote",
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
      fulfillment: "pickup",
      jobTime: "07:30",
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
      fulfillment: "delivery",
      notes: "Read from the attached PO-1182.pdf",
      reply:
        "Hi Hilltop team,\n\nGot PO 1182: 6 sourdough loaves and 4 dozen croissants for Tuesday before 7 am. We’ll have them there.\n\nThanks,\nMaple & Crumb Bakery",
    },
  },
  {
    id: "tins",
    subject: "Ordering 2 cookie tins shipped to Denver",
    fromName: "Rosa Alvarez",
    from: "rosa.alvarez@example.org",
    received: "Yesterday",
    body: "Hi!\n\nCould I order 2 of your holiday cookie tins (the 24-cookie size) shipped to my sister in Denver? Her address is 1420 Elm St, Denver, CO 80206. I’d love them there by December 15.\n\nThank you!\nRosa",
    result: {
      kind: "order",
      title: "2 holiday cookie tins, shipped",
      items: [{ name: "Holiday cookie tin, 24 cookies", quantity: "2" }],
      when: "Ship to Denver, CO, arriving by December 15",
      fulfillment: "shipping",
      location: "1420 Elm St, Denver, CO 80206",
      notes: "Ships to 1420 Elm St, Denver, CO 80206",
      reply:
        "Hi Rosa,\n\nThank you! 2 holiday cookie tins (24 cookies each) will ship to Denver in time for December 15. I’ll email you the tracking number as soon as they’re on their way.\n\nMaple & Crumb Bakery",
    },
  },
  {
    id: "pies",
    subject: "Thanksgiving pie order",
    fromName: "Gene Okafor",
    from: "gene.okafor@example.com",
    received: "Yesterday",
    body: "Hello,\n\nPutting in my Thanksgiving order: 2 pumpkin pies and 1 apple crumb pie. I can pick up Wednesday the 25th after 4 pm.\n\nGene",
    result: {
      kind: "order",
      title: "Thanksgiving pies for Gene",
      items: [
        { name: "Pumpkin pie", quantity: "2" },
        { name: "Apple crumb pie", quantity: "1" },
      ],
      when: "Pickup Wednesday the 25th, after 4 pm",
      fulfillment: "pickup",
      reply:
        "Hi Gene,\n\nYou’re all set: 2 pumpkin pies and 1 apple crumb pie, ready for pickup Wednesday the 25th after 4 pm. Happy Thanksgiving!\n\nMaple & Crumb Bakery",
    },
  },
  {
    id: "favors",
    subject: "Quote for 150 wedding favor cookies",
    fromName: "Alicia & Ben",
    from: "aliciaandben@example.net",
    received: "Monday",
    body: "Hi Maple & Crumb,\n\nWe’re getting married on June 6 and would love individually wrapped sugar cookies as favors for 150 guests, decorated with our initials (A & B) in sage green. Could you send us a quote? We’d need them delivered to Oak Hollow Barn the morning of.\n\nThank you!\nAlicia & Ben",
    result: {
      kind: "quote",
      title: "150 wedding favor cookies",
      items: [{ name: "Decorated sugar cookies, individually wrapped, A & B initials in sage green", quantity: "150" }],
      when: "Delivery June 6, morning, Oak Hollow Barn",
      fulfillment: "delivery",
      location: "Oak Hollow Barn",
      notes: "Asks for a quote",
      reply:
        "Hi Alicia and Ben,\n\nCongratulations! We’d be honored to make your favors. For 150 individually wrapped sugar cookies with sage green initials, delivered to Oak Hollow Barn on June 6, I’ll put together a quote and send it over by Friday.\n\nMaple & Crumb Bakery",
    },
  },
  {
    id: "shipping",
    subject: "Where is my order? #1043",
    fromName: "Tom Brennan",
    from: "tom.brennan@example.com",
    received: "Monday",
    body: "Hi,\n\nI ordered a box of macarons last week (order #1043) and haven’t gotten a shipping update yet. Any idea when it will arrive?\n\nThanks,\nTom",
    result: {
      kind: "update",
      title: "Shipping update for order #1043",
      items: [{ name: "Box of macarons, order #1043", quantity: "1" }],
      when: "Order #1043 shipped Monday, arriving Thursday",
      notes: "Matched to order #1043 in Orders & jobs",
      reply:
        "Hi Tom,\n\nThanks for checking in! Your macarons (order #1043) shipped on Monday and should arrive Thursday. Here’s your tracking number: 9400 1000 0000 0000 0000 00.\n\nMaple & Crumb Bakery",
    },
  },
  {
    id: "vegan",
    subject: "Do you have vegan or gluten-free options?",
    fromName: "Sam Patel",
    from: "sam.patel@example.org",
    received: "Sunday",
    body: "Hi there,\n\nMy partner is vegan and I can’t have gluten. Do you have anything we could both eat? And are you open on Sundays?\n\nSam",
    result: {
      kind: "question",
      title: "Vegan and gluten-free options",
      items: [
        { name: "Vegan and gluten-free treats", quantity: "Question" },
        { name: "Sunday hours", quantity: "Question" },
      ],
      when: "No date",
      reply:
        "Hi Sam,\n\nGreat question! Our almond flour lemon bars are both vegan and gluten-free, and we bake them every Friday. We’re open Sundays from 8 am to 1 pm.\n\nHope to see you soon,\nMaple & Crumb Bakery",
    },
  },
];
