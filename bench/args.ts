import { hasPrices, type Prices } from "./pricing";

// Command-line flags, and the guards a paid run must pass before anything is sent

export interface BenchOptions {
  tasks: string[] | null;
  cases: string[] | null;
  repeat: number;
  provider: "mock" | "muse";
  live: boolean;
  yes: boolean;
  budgetUsd: number | null;
  images: boolean;
  help: boolean;
}

export const USAGE = `Usage: npm run bench -- [flags]

  --tasks <a,b>       Only these tasks (default: all)
  --cases <a,b>       Only these cases (default: all)
  --repeat <n>        Runs per task and case (default 1)
  --provider <name>   mock (default, free) or muse (paid)
  --live              Needed for --provider muse
  --yes               Confirms paid calls
  --budget <usd>      A call starts only if spend so far, calls still running and its
                      own worst case (whole prompt, every output token allowed) fit
  --images            Live: also run the image tasks, billed per picture (practice
                      mode always runs them, free)
  --help              This text

Live example: npm run bench -- --provider muse --live --yes --budget 2 --tasks intake,taglines`;

export class ArgsError extends Error {}

const list = (value: string) =>
  value
    .split(",")
    .map((each) => each.trim())
    .filter(Boolean);

export function parseArgs(argv: readonly string[]): BenchOptions {
  const options: BenchOptions = { tasks: null, cases: null, repeat: 1, provider: "mock", live: false, yes: false, budgetUsd: null, images: false, help: false };
  let providerGiven = false;
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    const value = () => {
      const next = argv[++index];
      if (next === undefined || next.startsWith("--")) throw new ArgsError(`${flag} needs a value`);
      return next;
    };
    switch (flag) {
      case "--tasks":
        options.tasks = list(value());
        break;
      case "--cases":
        options.cases = list(value());
        break;
      case "--repeat": {
        const repeat = Number(value());
        if (!Number.isInteger(repeat) || repeat < 1 || repeat > 20) throw new ArgsError("--repeat must be a whole number from 1 to 20");
        options.repeat = repeat;
        break;
      }
      case "--provider": {
        const provider = value();
        if (provider !== "mock" && provider !== "muse") throw new ArgsError('--provider must be "mock" or "muse"');
        options.provider = provider;
        providerGiven = true;
        break;
      }
      case "--budget": {
        const budget = Number(value());
        if (!Number.isFinite(budget) || budget <= 0) throw new ArgsError("--budget must be a positive number of US dollars");
        options.budgetUsd = budget;
        break;
      }
      case "--live":
        options.live = true;
        break;
      case "--yes":
        options.yes = true;
        break;
      case "--images":
        options.images = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new ArgsError(`Unknown flag ${flag}`);
    }
  }
  // --live alone means Muse; asking for the mock and --live together is a mistake
  if (options.live && !providerGiven) options.provider = "muse";
  return options;
}

// Null when the run may start; otherwise why it can't. Checked before any provider is created.
export function liveRefusal(options: BenchOptions, prices: Prices): string | null {
  if (options.provider === "mock") {
    return options.live ? "--live needs --provider muse; the mock is never billed." : null;
  }
  const missing = [!options.live && "--live", !options.yes && "--yes", options.budgetUsd === null && "--budget <usd>"].filter(Boolean);
  if (missing.length) return `A paid Muse run needs ${missing.join(", ")}.`;
  if (!hasPrices(prices) || prices.searchPerQuery === null) {
    return `Prices for ${prices.model} aren't checked in bench/pricing.ts, so spend can't be estimated. Live runs are refused.`;
  }
  if (options.images && prices.imagePerPicture === null) return "The per-image price isn't checked in bench/pricing.ts, so --images is refused.";
  return null;
}
