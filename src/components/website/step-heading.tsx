import { SECTION_TITLE } from "@/components/styles";

export function StepHeading({ number, title, id }: { number: number; title: string; id: string }) {
  return (
    <h2 id={id} className={`${SECTION_TITLE} flex scroll-mt-6 items-center gap-3`}>
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-base text-white">
        {number}
      </span>
      <span>
        <span className="sr-only">Step {number}: </span>
        {title}
      </span>
    </h2>
  );
}
