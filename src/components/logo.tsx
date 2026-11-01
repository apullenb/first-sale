import Image from "next/image";

// Full logo for light backgrounds; the light version is for the dark sign-in panel
export function Logo({ className = "w-56", light = false }: { className?: string; light?: boolean }) {
  return (
    <Image
      src={light ? "/brand/snapstart-logo-light.png" : "/brand/snapstart-logo.png"}
      alt="SnapStart Business Assembly Kit"
      width={720}
      height={light ? 221 : 268}
      className={`h-auto shrink-0 ${className}`}
      unoptimized
    />
  );
}

// The S mark alone, for the dark sidebar and phone bar
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return <Image src="/brand/snapstart-mark-light.png" alt="" width={96} height={96} className={`shrink-0 ${className}`} unoptimized />;
}
