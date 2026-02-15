"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import Link from "next/link";

type ButtonVariant = "warm" | "blue" | "outline" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  href?: string;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  warm: "border border-rudo-rose bg-transparent text-rudo-rose hover:bg-rudo-rose hover:text-white hover:shadow-[0_0_35px_rgba(196,40,90,0.3)]",
  blue: "border border-rudo-blue bg-transparent text-rudo-blue hover:bg-rudo-blue hover:text-rudo-bg hover:shadow-[0_0_35px_rgba(56,189,248,0.25)]",
  outline: "border border-rudo-border bg-transparent text-rudo-text hover:border-rudo-blue",
  ghost: "border-none bg-transparent text-rudo-text-sec hover:text-rudo-text",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "warm", href, fullWidth, className = "", children, ...props }, ref) => {
    const baseStyles = `cyber-clip px-7 py-[11px] font-orbitron font-bold text-[10px] tracking-[2px] uppercase cursor-pointer no-underline transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed ${
      fullWidth ? "w-full text-center" : ""
    }`;

    const styles = `${baseStyles} ${variantStyles[variant]} ${className}`;

    if (href) {
      return (
        <Link href={href} className={styles}>
          {children}
        </Link>
      );
    }

    return (
      <button ref={ref} className={styles} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
