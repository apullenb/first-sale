import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { squareConfig } from "./config";

export function encryptTokens(value: unknown, businessId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(squareConfig().encryptionKey, "base64"), iv);
  cipher.setAAD(Buffer.from(businessId));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64")).join(".");
}

export function decryptTokens(value: string, businessId: string): unknown {
  const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(squareConfig().encryptionKey, "base64"), iv);
  decipher.setAAD(Buffer.from(businessId));
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"));
}
