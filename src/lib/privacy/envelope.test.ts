import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { documentContext, isSealed, masterKeys, openFile, rewrapFile, SealedFileError, sealFile } from "./envelope";

const key = (fill: number) => Buffer.alloc(32, fill).toString("base64");
const keys = masterKeys({ DOCUMENT_ENCRYPTION_KEY: key(1) })!;
const file = new TextEncoder().encode("%PDF-1.7 Dear owner, your SSN is on file.");
const here = documentContext("biz-a", "doc-1");

describe("sealFile and openFile", () => {
  it("round-trips, and the stored bytes don't contain the file", () => {
    const sealed = sealFile(file, here, keys);
    expect(isSealed(sealed)).toBe(true);
    expect(Buffer.from(sealed).includes(Buffer.from("SSN"))).toBe(false);
    expect(openFile(sealed, here, keys)).toEqual(file);
  });

  it("gives each file its own key, so the same file never seals the same way twice", () => {
    expect(Buffer.from(sealFile(file, here, keys)).equals(Buffer.from(sealFile(file, here, keys)))).toBe(false);
  });

  it("won't open a sealed file copied to another document or business", () => {
    const sealed = sealFile(file, here, keys);
    expect(() => openFile(sealed, documentContext("biz-a", "doc-2"), keys)).toThrow(SealedFileError);
    expect(() => openFile(sealed, documentContext("biz-b", "doc-1"), keys)).toThrow(SealedFileError);
  });

  it("detects any change to the stored bytes", () => {
    const sealed = sealFile(file, here, keys);
    for (const at of [5, 30, sealed.length - 1]) {
      const changed = new Uint8Array(sealed);
      changed[at] ^= 1;
      expect(() => openFile(changed, here, keys)).toThrow(SealedFileError);
    }
  });

  it("won't open with the wrong master key", () => {
    const other = masterKeys({ DOCUMENT_ENCRYPTION_KEY: key(2) })!;
    expect(() => openFile(sealFile(file, here, keys), here, other)).toThrow(SealedFileError);
  });

  it("reads files saved before encryption as they are, and refuses a sealed file with no key configured", () => {
    expect(openFile(file, here, keys)).toEqual(file);
    expect(openFile(file, here, null)).toEqual(file);
    expect(() => openFile(sealFile(file, here, keys), here, null)).toThrow(SealedFileError);
  });

  it("handles large and empty files", () => {
    const big = new Uint8Array(randomBytes(4_000_000));
    expect(Buffer.from(openFile(sealFile(big, here, keys), here, keys)).equals(Buffer.from(big))).toBe(true);
    expect(openFile(sealFile(new Uint8Array(), here, keys), here, keys)).toEqual(new Uint8Array());
  });
});

describe("key rotation", () => {
  it("re-wraps a file under the newest key without re-encrypting its bytes, and old keys keep opening old files", () => {
    const sealed = sealFile(file, here, keys);
    const both = masterKeys({ DOCUMENT_ENCRYPTION_KEYS: `1:${key(1)},2:${key(3)}` })!;
    expect(both.current).toBe(2);
    expect(openFile(sealed, here, both)).toEqual(file);

    const rewrapped = rewrapFile(sealed, here, both);
    expect(rewrapped[4]).toBe(2);
    // Same encrypted body: only the 32-byte key changed
    expect(Buffer.from(rewrapped.subarray(77)).equals(Buffer.from(sealed.subarray(77)))).toBe(true);
    const onlyNew = masterKeys({ DOCUMENT_ENCRYPTION_KEYS: `2:${key(3)}` })!;
    expect(openFile(rewrapped, here, onlyNew)).toEqual(file);
    expect(() => openFile(sealed, here, onlyNew)).toThrow(/key 1/);
  });

  it("rejects malformed keys", () => {
    expect(() => masterKeys({ DOCUMENT_ENCRYPTION_KEY: "short" })).toThrow(SealedFileError);
    expect(() => masterKeys({ DOCUMENT_ENCRYPTION_KEYS: `0:${key(1)}` })).toThrow(SealedFileError);
    expect(masterKeys({})).toBeNull();
  });
});
