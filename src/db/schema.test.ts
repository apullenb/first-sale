import { describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import { users } from "./schema";

describe("users table", () => {
  it("allows only one account per email, ignoring case", async () => {
    const db = await createTestDb();
    await db.insert(users).values({ name: "First", email: "owner@example.test" });

    await expect(db.insert(users).values({ name: "Second", email: "Owner@Example.test" })).rejects.toThrow();
  });
});
