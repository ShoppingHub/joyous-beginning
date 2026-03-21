import opadLogoSvg from "@/assets/opad-logo.svg";

interface OpadLogoProps {
  size?: number;
  className?: string;
}

export function OpadLogo({ size = 32, className = "" }: OpadLogoProps) {
  return (
    <img
      src={opadLogoSvg}
      alt="opad.me logo"
      width={size}
      height={size}
      className={className}
    />
  );
}
