type VerifiedBadgeProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function VerifiedBadge({ size = "sm", className = "" }: VerifiedBadgeProps) {
  const sizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <span className={`inline-flex items-center ${className}`} title="Verified">
      <svg
        viewBox="0 0 22 22"
        fill="none"
        className={sizes[size]}
      >
        <circle cx="11" cy="11" r="9" fill="#38bdf8" />
        <path
          d="M8 11.5l2 2 4-4.5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </span>
  );
}
