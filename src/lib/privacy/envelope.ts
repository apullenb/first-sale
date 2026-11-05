import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Envelope encryption for files at rest. Each file gets its own random 256-bit key; that key is encrypted ("wrapped")
// with a master key from the environment, and both layers use AES-256-GCM. The file's owner and id are bound in as
// associated data, so a ciphertext copied to another row or business fails to open. Master keys carry an id, so a new
// key can be added and files re-wrapped (rewrapFile) without touching their encrypted bytes.
//
// Layout: "SSE1" | key id (1 byte) | wrap iv (12) | wrapped key (32) | wrap tag (16) | iv (12) | tag (16) | ciphertext

const MAGIC = Buffer.from("SSE1");
const HEADER = MAGIC.length + 1 + 12 + 32 + 16 + 12 + 16;

export interface MasterKeys {
  // The newest key seals new files; any listed key opens
  current: number;
  keys: Map<number, Buffer>;
}

export class SealedFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SealedFileError";
  }
}

// DOCUMENT_ENCRYPTION_KEYS="1:<base64>,2:<base64>", or DOCUMENT_ENCRYPTION_KEY="<base64>" as key 1. Null when unset.
export function masterKeys(env: Record<string, string | undefined> = process.env): MasterKeys | null {
  const list = env.DOCUMENT_ENCRYPTION_KEYS?.trim() || (env.DOCUMENT_ENCRYPTION_KEY?.trim() ? `1:${env.DOCUMENT_ENCRYPTION_KEY.trim()}` : "");
  if (!list) return null;
  const keys = new Map<number, Buffer>();
  for (const entry of list.split(",")) {
    const [id, value] = entry.split(":").map((part) => part.trim());
    const key = Buffer.from(value ?? "", "base64");
    const n = Number(id);
    if (!Number.isInteger(n) || n < 1 || n > 255 || key.length !== 32) throw new SealedFileError("Each document encryption key needs an id from 1 to 255 and 32 bytes in base64.");
    keys.set(n, key);
  }
  return { current: Math.max(...keys.keys()), keys };
}

export const isSealed = (data: Uint8Array) => data.length >= HEADER && Buffer.from(data.subarray(0, MAGIC.length)).equals(MAGIC);

function gcm(key: Buffer, iv: Buffer, aad: Buffer, data: Buffer): { out: Buffer; tag: Buffer } {
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const out = Buffer.concat([cipher.update(data), cipher.final()]);
  return { out, tag: cipher.getAuthTag() };
}

function ungcm(key: Buffer, iv: Buffer, aad: Buffer, tag: Buffer, data: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

// The wrapped key is bound to the file's context and its key id, the file's bytes to the context
const wrapAad = (context: string, keyId: number) => Buffer.from(`${context}|key:${keyId}`);

export function sealFile(data: Uint8Array, context: string, keys: MasterKeys): Uint8Array {
  const fileKey = randomBytes(32);
  const iv = randomBytes(12);
  const body = gcm(fileKey, iv, Buffer.from(context), Buffer.from(data));
  const wrapIv = randomBytes(12);
  const wrapped = gcm(keys.keys.get(keys.current)!, wrapIv, wrapAad(context, keys.current), fileKey);
  fileKey.fill(0);
  return new Uint8Array(Buffer.concat([MAGIC, Buffer.from([keys.current]), wrapIv, wrapped.out, wrapped.tag, iv, body.tag, body.out]));
}

function parts(sealed: Uint8Array) {
  const buf = Buffer.from(sealed);
  let at = MAGIC.length;
  const take = (n: number) => buf.subarray(at, (at += n));
  const keyId = take(1)[0];
  return { keyId, wrapIv: take(12), wrappedKey: take(32), wrapTag: take(16), iv: take(12), tag: take(16), body: buf.subarray(at) };
}

function unwrap(sealed: ReturnType<typeof parts>, context: string, keys: MasterKeys): Buffer {
  const master = keys.keys.get(sealed.keyId);
  if (!master) throw new SealedFileError(`This file was sealed with document key ${sealed.keyId}, which isn't configured.`);
  try {
    return ungcm(master, sealed.wrapIv, wrapAad(context, sealed.keyId), sealed.wrapTag, sealed.wrappedKey);
  } catch {
    throw new SealedFileError("This file’s key doesn’t open here: it belongs to another document, or was changed.");
  }
}

export function openFile(data: Uint8Array, context: string, keys: MasterKeys | null): Uint8Array {
  // Files saved before encryption was turned on are read as they are
  if (!isSealed(data)) return data;
  if (!keys) throw new SealedFileError("This file is encrypted, and no document encryption key is configured.");
  const sealed = parts(data);
  const fileKey = unwrap(sealed, context, keys);
  try {
    return new Uint8Array(ungcm(fileKey, sealed.iv, Buffer.from(context), sealed.tag, sealed.body));
  } catch {
    throw new SealedFileError("This file’s contents were changed after it was saved.");
  } finally {
    fileKey.fill(0);
  }
}

// Key rotation: re-encrypts only the 32-byte file key under the newest master key; the file's own bytes stay as they are
export function rewrapFile(data: Uint8Array, context: string, keys: MasterKeys): Uint8Array {
  if (!isSealed(data)) return sealFile(data, context, keys);
  const sealed = parts(data);
  if (sealed.keyId === keys.current) return data;
  const fileKey = unwrap(sealed, context, keys);
  const wrapIv = randomBytes(12);
  const wrapped = gcm(keys.keys.get(keys.current)!, wrapIv, wrapAad(context, keys.current), fileKey);
  fileKey.fill(0);
  return new Uint8Array(Buffer.concat([MAGIC, Buffer.from([keys.current]), wrapIv, wrapped.out, wrapped.tag, sealed.iv, sealed.tag, sealed.body]));
}

export const documentContext = (businessId: string, documentId: string) => `snapstart:document:${businessId}:${documentId}`;
