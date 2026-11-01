import { describe, expect, it } from "vitest";
import { officialForm } from "@/data/official-forms";
import { type FilingInput, filingPaths, filingSteps } from "./filing";

const input = (overrides: Partial<FilingInput> = {}): FilingInput => ({
  title: "File your assumed name",
  agency: "Texas Secretary of State",
  feeCents: null,
  feeCheckedAt: null,
  deadline: null,
  renewal: null,
  links: [],
  prepare: [],
  doneWhen: "",
  waitingOn: [],
  following: [],
  form: null,
  missing: [],
  ...overrides,
});

const lines = (steps: ReturnType<typeof filingSteps>, kind: string) => steps.find((step) => step.kind === kind)?.lines ?? [];

describe("filingSteps", () => {
  it("says plainly what isn't known instead of guessing", () => {
    const steps = filingSteps(input());
    expect(lines(steps, "cost").map((line) => line.text)).toEqual(["Fee: unknown. No official page we read states it.", "Deadline: none found on an official page."]);
    expect(lines(steps, "submit")[0]).toMatchObject({ unknown: true });
    expect(lines(steps, "form")[0]).toMatchObject({ unknown: true });
    expect(steps.map((step) => step.kind)).toEqual(["before", "form", "cost", "submit", "receipt"]);
  });

  it("gives checked fees, deadlines and ways to submit with their sources", () => {
    const steps = filingSteps(input({ form: officialForm("tx-assumed-name-503"), waitingOn: ["Choose a business structure"], following: ["Get an EIN"], missing: ["Add your business street address."] }));
    expect(lines(steps, "before")[0].text).toBe("Finish “Choose a business structure” first.");
    expect(lines(steps, "before")[1].source).toMatchObject({ url: "https://countyclerk.traviscountytx.gov/departments/recording/dbas/" });
    expect(lines(steps, "gather")[0]).toMatchObject({ text: "Still needed from you: Add your business street address.", unknown: true });
    const cost = lines(steps, "cost");
    expect(cost[0]).toMatchObject({ text: "Fee: $25 to file.", source: { url: "https://www.sos.texas.gov/corp/forms/503_boc.pdf", checkedOn: "2026-10-27" } });
    expect(cost[1].text).toBe("Deadline: none found on an official page.");
    expect(lines(steps, "submit").at(-1)!.text).toMatch(/SnapStart never files anything/);
    expect(lines(steps, "after").at(-1)!.text).toBe("Then you can start “Get an EIN”.");
  });

  it("shows both fees when two official pages disagree", () => {
    const steps = filingSteps(input({ form: officialForm("tx-llc-205"), feeCents: 25000, feeCheckedAt: "2026-10-27T15:00:00Z", links: [{ title: "Fees page", url: "https://www.sos.texas.gov/x", government: "State of Texas", confirms: true }] }));
    const cost = lines(steps, "cost");
    expect(cost[0]).toMatchObject({ text: "Fee: $250.", source: { url: "https://www.sos.texas.gov/x" } });
    expect(cost[1].text).toMatch(/^Another official page says: \$300/);
  });

  it("lists the IRS's three ways to apply, each with how long it takes", () => {
    const submit = lines(filingSteps(input({ form: officialForm("irs-ss4") })), "submit");
    expect(submit.map((line) => line.text.split(".")[0])).toEqual([
      "Apply online with the IRS’s own tool",
      "Fax the signed form to the IRS at 855-641-6935 (for businesses in the 50 states and DC)",
      "Mail the signed form at least 4 to 5 weeks before you need the EIN",
      "A paper form must be signed and dated by you",
      "You check, sign and submit it yourself",
    ]);
    expect(submit[2].address).toEqual(["Internal Revenue Service", "Attn: EIN Operation", "Cincinnati, OH 45999"]);
  });

  it("says which links were checked by hand, because their sites refuse automated requests", () => {
    const steps = filingSteps(input({ form: officialForm("irs-ss4") }));
    const online = lines(steps, "form").find((line) => line.link?.url === "https://sa.www4.irs.gov/modiein/individual/index.jsp");
    expect(online?.link?.checkedByHand).toBe("2026-10-27");
    // Pages the server read itself aren't marked
    const permit = filingSteps(input({ form: officialForm("tx-sales-tax-permit") }));
    expect(lines(permit, "form").some((line) => line.link?.checkedByHand)).toBe(false);
    expect(lines(permit, "submit").some((line) => line.source?.byHand)).toBe(false);
  });
});

describe("filingPaths", () => {
  it("splits a form into a paper way and an online way, each with only its own ways to send", () => {
    const paths = filingPaths(officialForm("irs-ss4")!);
    expect(paths.paper!.send.map((line) => line.text.split(".")[0])).toEqual([
      "Fax the signed form to the IRS at 855-641-6935 (for businesses in the 50 states and DC)",
      "Mail the signed form at least 4 to 5 weeks before you need the EIN",
      "A paper form must be signed and dated by you",
      "Not filed: you sign and send it yourself",
    ]);
    expect(paths.online).toMatchObject({ url: "https://sa.www4.irs.gov/modiein/individual/index.jsp", checkedByHand: "2026-10-27" });
    expect(paths.online!.send.at(-1)!.text).toMatch(/SnapStart never files anything/);
  });

  it("gives the mailing address of a form that's otherwise filed online", () => {
    const paper = filingPaths(officialForm("tx-llc-205")!).paper!.send;
    expect(paper[0]).toMatchObject({ address: ["Secretary of State", "P.O. Box 13697", "Austin, TX 78711-3697"] });
  });
});
