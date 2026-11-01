import { Logo } from "@/components/logo";

const POINTS = [
  "Find out what your business needs, with links to official sources",
  "Get your setup steps in the right order",
  "AI drafts the busywork. You approve everything.",
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-stretch justify-center gap-6 px-4 py-6 sm:px-6 md:flex-row md:gap-7 md:py-10">
      <section
        aria-label="About SnapStart Business Assembly Kit"
        className="flex flex-col gap-3 rounded-[18px] bg-sidebar p-6 text-white shadow-lift md:max-w-md md:flex-1 md:gap-4 md:p-8"
      >
        <Logo light className="w-full max-w-80" />
        <p className="font-display text-[32px] leading-[1.15] md:mt-3 md:text-[38px]">
          From idea to first sale.
        </p>
        <p className="text-lg text-white/70">Step-by-step help for first-time business owners in the US.</p>
        <ul className="mt-2 hidden flex-col gap-3 md:flex">
          {POINTS.map((point) => (
            <li key={point} className="flex items-start gap-2.5">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-sky">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>
      <main id="main" className="flex flex-col gap-4 rounded-[18px] border border-line bg-surface p-6 shadow-card md:max-w-md md:flex-1 md:p-8">
        {children}
      </main>
    </div>
  );
}
