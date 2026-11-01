import Image from "next/image";

export function Logo({ className = "w-56", light = false }: { className?: string; light?: boolean }) {
  return (
    <Image
      src={light ? "/brand/snapstart-logo-light.png" : "/brand/snapstart-logo.png"}
      alt="SnapStart Business Assembly Kit"
      width={720}
      height={light ? 221 : 218}
      className={`h-auto shrink-0 ${className}`}
      unoptimized
    />
  );
}
