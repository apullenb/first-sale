import { describe, expect, it } from "vitest";
import { type CustomerOrder, customerKey, customersFrom, matchCustomers } from "./customers";

let next = 0;
const order = (overrides: Partial<CustomerOrder>): CustomerOrder => ({
  id: `o${++next}`,
  customerName: "Sam Rivera",
  customerEmail: "",
  customerPhone: "",
  status: "confirmed",
  isDemo: false,
  totalCents: null,
  payments: [],
  createdAt: "2026-11-01T10:00:00.000Z",
  ...overrides,
});

describe("customers from orders", () => {
  it("groups by email, then phone, then name", () => {
    expect(customerKey(order({ customerEmail: " Sam@Example.test " }))).toBe("email:sam@example.test");
    expect(customerKey(order({ customerPhone: "(614) 555-0100" }))).toBe("phone:6145550100");
    expect(customerKey(order({ customerPhone: "12", customerName: "  Sam   Rivera " }))).toBe("name:sam rivera");
  });

  it("adds up orders, payments kept and balance owed, newest details first", () => {
    const customers = customersFrom([
      order({ customerEmail: "sam@example.test", totalCents: 5000, payments: [{ kind: "payment", amountCents: 2000 }], createdAt: "2026-10-01T10:00:00.000Z" }),
      order({ customerName: "Samuel Rivera", customerEmail: "SAM@example.test", customerPhone: "614-555-0100", totalCents: 3000, createdAt: "2026-11-02T10:00:00.000Z" }),
      order({ customerEmail: "sam@example.test", status: "cancelled", totalCents: 1000, payments: [{ kind: "payment", amountCents: 1000 }, { kind: "refund", amountCents: 400 }] }),
      order({ customerEmail: "sam@example.test", status: "needs_review", totalCents: 9000 }),
      order({ customerName: "Jo", totalCents: 800, payments: [{ kind: "payment", amountCents: 800 }], status: "fulfilled" }),
    ]);
    expect(customers).toHaveLength(2);
    const [sam, jo] = customers;
    expect(sam).toMatchObject({
      key: "email:sam@example.test",
      name: "Samuel Rivera",
      phone: "614-555-0100",
      orders: 3,
      spentCents: 2600,
      balanceCents: 6000,
      lastOrderAt: "2026-11-02T10:00:00.000Z",
      demo: false,
    });
    expect(sam.orderIds).toHaveLength(4);
    expect(jo).toMatchObject({ name: "Jo", orders: 1, spentCents: 800, balanceCents: 0 });
  });

  it("marks customers who only have DEMO orders and leaves out unnamed imports", () => {
    const customers = customersFrom([
      order({ customerName: "Dana", customerEmail: "dana@example.test", isDemo: true }),
      order({ customerName: "Customer to confirm" }),
    ]);
    expect(customers.map((customer) => [customer.name, customer.demo])).toEqual([["Dana", true]]);
  });

  it("suggests real past customers by name, email or phone", () => {
    const customers = customersFrom([
      order({ customerName: "Dana Whitfield", customerEmail: "dana@example.test" }),
      order({ customerName: "Danny", customerPhone: "555-0199" }),
      order({ customerName: "Dana Demo", customerEmail: "demo@example.test", isDemo: true }),
    ]);
    expect(matchCustomers(customers, "dan").map((customer) => customer.name)).toEqual(["Dana Whitfield", "Danny"]);
    expect(matchCustomers(customers, "0199").map((customer) => customer.name)).toEqual(["Danny"]);
    expect(matchCustomers(customers, " ")).toEqual([]);
  });
});
