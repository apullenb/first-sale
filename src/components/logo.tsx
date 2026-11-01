import Image from "next/image";

export function Logo({ className = "w-56", light = false }: { className?: string; light?: boolean }) {
  return (
    <Image
      src={light ? "/brand/snapstart-logo-light.png" : "/brand/snapstart-logo.png"}
      alt="SnapStart Business Assembly Kit"
      width={light ? 1832 : 1844}
      height={light ? 562 : 559}
      className={`h-auto shrink-0 ${className}`}
      unoptimized
    />
  );
}
