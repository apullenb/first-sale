import { sha1, type SiteFile } from "@/lib/website/site/bundle";
import { HostError, type HostProvider, type PublishResult, type PublishTarget } from "./types";

// Netlify's API, as documented at https://docs.netlify.com/api/get-started/ (read 2026-10-28):
// make the site, send each file's SHA1, upload only the files Netlify asks for, then wait for "ready".

export const NETLIFY_API = "https://api.netlify.com/api/v1";

interface NetlifySite {
  id: string;
  name: string;
  ssl_url?: string;
  url?: string;
  admin_url?: string;
}

interface NetlifyDeploy {
  id: string;
  required?: string[];
  state?: string;
  error_message?: string | null;
}

export interface NetlifyOptions {
  fetchImpl?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
  // For a different name when the first is taken
  random?: () => string;
  // How many times to ask whether the deploy is live
  polls?: number;
}

const RECONNECT = "Netlify didn’t accept First Sale’s connection any more. Connect Netlify again, then publish.";
const BUSY = "Netlify allows only a few publishes a minute. Wait a minute, then publish again.";

export function netlifyHost(token: string, options: NetlifyOptions = {}): HostProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const random = options.random ?? (() => Math.random().toString(36).slice(2, 6));
  const polls = options.polls ?? 10;

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetchImpl(`${NETLIFY_API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...init.headers },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    // 401 is a token Netlify no longer takes; 403 is about one site, so reconnecting wouldn't help
    if (response.status === 401) throw new HostError(RECONNECT, true);
    if (response.status === 429) throw new HostError(BUSY);
    return response;
  }

  async function json<T>(response: Response, what: string): Promise<T> {
    if (!response.ok) throw new HostError(`Netlify couldn’t ${what} (error ${response.status}). Try again in a few minutes.`);
    return (await response.json()) as T;
  }

  async function existing(siteId: string): Promise<NetlifySite | null> {
    const response = await call(`/sites/${encodeURIComponent(siteId)}`);
    // Deleted, or in an account this connection can't reach
    if (response.status === 404 || response.status === 403) {
      await response.body?.cancel();
      return null;
    }
    return json<NetlifySite>(response, "find your site");
  }

  async function create(name: string): Promise<NetlifySite> {
    for (const candidate of [name, `${name}-${random()}`, `${name}-${random()}`]) {
      const response = await call("/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: candidate }),
      });
      // 422: someone already has that name
      if (response.status === 422) {
        await response.body?.cancel();
        continue;
      }
      return json<NetlifySite>(response, "make your site");
    }
    throw new HostError("Netlify said those site names are taken. Try again, or pick a different web address in step 2.");
  }

  return {
    id: "netlify",
    name: "Netlify",
    simulated: false,
    async publish(files: SiteFile[], target: PublishTarget): Promise<PublishResult> {
      let site = target.siteId ? await existing(target.siteId) : null;
      if (!site) {
        site = await create(target.siteName);
        // Remembered at once, so a failed upload doesn't leave a second site next time
        await target.onCreated?.({ siteId: site.id, siteName: site.name });
      }
      const digests = new Map(files.map((file) => [`/${file.path}`, sha1(file.body)]));
      const deploy = await json<NetlifyDeploy>(
        await call(`/sites/${encodeURIComponent(site.id)}/deploys`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: Object.fromEntries(digests) }),
        }),
        "start publishing",
      );

      const required = new Set(deploy.required ?? []);
      for (const file of files) {
        const digest = sha1(file.body);
        if (!required.has(digest)) continue;
        // Same bytes under two names upload once
        required.delete(digest);
        const path = file.path.split("/").map(encodeURIComponent).join("/");
        const uploaded = await call(`/deploys/${encodeURIComponent(deploy.id)}/files/${path}`, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: file.body.slice(),
        });
        if (!uploaded.ok) throw new HostError(`Netlify didn’t take one of your site’s files (error ${uploaded.status}). Try again in a few minutes.`);
        await uploaded.body?.cancel();
      }

      let state = deploy.state ?? "";
      for (let poll = 0; state !== "ready" && poll < polls; poll++) {
        await wait(1500);
        state = await deployState(deploy.id);
      }

      // Shown as links in the app, so only plain https addresses are kept
      const name = /^[a-z0-9-]{1,63}$/.test(site.name) ? site.name : target.siteName;
      const live = [site.ssl_url, site.url].find((url) => url?.startsWith("https://") && URL.canParse(url));
      return {
        siteId: site.id,
        siteName: name,
        url: live ?? `https://${name}.netlify.app`,
        adminUrl: site.admin_url?.startsWith("https://app.netlify.com/") ? site.admin_url : null,
        deployId: deploy.id,
        state: state === "ready" ? "ready" : "processing",
      };
    },
    async check(deployId: string) {
      return (await deployState(deployId)) === "ready" ? "ready" : "processing";
    },
  };

  async function deployState(deployId: string): Promise<string> {
    const latest = await json<NetlifyDeploy>(await call(`/deploys/${encodeURIComponent(deployId)}`), "check your site");
    if (latest.state === "error") {
      throw new HostError(`Netlify couldn’t put your site online${latest.error_message ? `: ${latest.error_message.slice(0, 200)}` : ""}. Try publishing again.`);
    }
    return latest.state ?? "";
  }
}
