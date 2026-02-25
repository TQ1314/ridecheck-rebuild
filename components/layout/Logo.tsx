import Image from "next/image";
import logoSrc from "@assets/12496_1771993161726.jpg";

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className = "" }: LogoProps) {
  return (
    <Image
      src={logoSrc}
      alt="RideCheck"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      priority
    />
  );
}
