import Link from "next/link";

export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const sqSize = size === "lg" ? "w-[30px] h-[30px] rounded-[6px]" : "w-3 h-3 rounded-[3px]";
  const gap = size === "lg" ? "gap-1" : "gap-[2px]";
  const textSize = size === "lg" ? "text-[56px] tracking-[-1.5px]" : "text-[22px] tracking-[-0.5px]";

  return (
    <Link href="/" className="flex items-center gap-3 no-underline">
      <div className={`grid grid-cols-2 ${gap}`}>
        <div className={`${sqSize} bg-rudo-blue`} />
        <div className={`${sqSize} bg-rudo-blue opacity-50`} />
        <div className={`${sqSize} bg-rudo-blue opacity-25`} />
        <div className={`${sqSize} bg-rudo-blue opacity-10`} />
      </div>
      <span className={`font-outfit font-bold ${textSize} text-rudo-text`}>
        rudo
      </span>
    </Link>
  );
}
