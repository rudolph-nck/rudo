"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block mb-2 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-4 py-3 bg-white border border-rudo-card-border text-rudo-dark-text font-outfit text-sm placeholder:text-rudo-dark-muted focus:outline-none focus:border-rudo-blue/40 transition-colors ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-rudo-rose">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
