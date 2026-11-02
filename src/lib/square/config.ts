import "server-only";
import { OwnerFacingError } from "@/lib/errors";

export function squareConfig() {
  const environment = process.env.SQUARE_ENVIRONMENT || "sandbox";
  if (!["sandbox", "production"].includes(environment)) throw new OwnerFacingError("Square environment is not configured correctly.");
  const applicationId = process.env.SQUARE_APPLICATION_ID;
  const applicationSecret = process.env.SQUARE_APPLICATION_SECRET;
  const redirectUri = process.env.SQUARE_REDIRECT_URI;
  const encryptionKey = process.env.SQUARE_TOKEN_ENCRYPTION_KEY;
  if (!applicationId || !applicationSecret || !redirectUri || !encryptionKey || Buffer.from(encryptionKey, "base64").length !== 32) {
    throw new OwnerFacingError("Square connection is not configured yet. Ask the SnapStart administrator to finish setup.");
  }
  const redirect = new URL(redirectUri);
  if (redirect.protocol !== "https:" && !(environment === "sandbox" && redirect.hostname === "localhost" && redirect.protocol === "http:")) {
    throw new OwnerFacingError("Square needs a secure callback address.");
  }
  return { environment, applicationId, applicationSecret, redirectUri, encryptionKey,
    baseUrl: environment === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com" };
}
