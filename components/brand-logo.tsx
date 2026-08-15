import Image from "next/image";

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
}

export default function BrandLogo({
  className = "h-auto w-36",
  priority = false,
}: BrandLogoProps) {
  return (
    <Image
      src="/brand/comentou-logo-primary.png"
      alt="Comentou"
      width={2091}
      height={752}
      className={className}
      priority={priority}
    />
  );
}
