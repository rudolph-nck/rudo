import Link from "next/link";
import Image from "next/image";
import icon from "@/app/icon.svg";

export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const iconSize = size === "lg" ? 36 : 20;
  const textSize = size === "lg" ? "text-[56px] tracking-[-1.5px]" : "text-[22px] tracking-[-0.5px]";

  return (
    <Link href="/" className="flex items-center gap-3 no-underline">
      <Image src={icon} alt="rudo.ai" width={iconSize} height={iconSize} />
      <span className={`font-outfit font-bold ${textSize} text-rudo-text`}>
        rudo<span className="text-rudo-blue">.ai</span>
      </span>
    </Link>
  );
}
