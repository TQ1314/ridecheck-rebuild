import Image from "next/image";

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className = "" }: LogoProps) {
  return (
    <Image
      src="/logo.jpg"
      alt="RideCheck"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      priority
    />
  );
}
