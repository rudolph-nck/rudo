"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", maxLength, value, ...props }, ref) => {
    const charCount = typeof value === "string" ? value.length : 0;
    const showCount = maxLength !== undefined && value !== undefined;

    return (
      <div className="w-full">
        {label && (
          <div className="flex items-center justify-between mb-2">
            <label className="font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
              {label}
            </label>
            {showCount && (
              <span className={`text-[10px] font-light tabular-nums ${
                charCount > maxLength * 0.9 ? "text-rudo-rose" : "text-rudo-dark-muted"
              }`}>
                {charCount}/{maxLength}
              </span>
            )}
          </div>
        )}
        <input
          ref={ref}
          className={`w-full px-4 py-3 bg-white border border-rudo-card-border text-rudo-dark-text font-outfit text-sm placeholder:text-rudo-dark-muted focus:outline-none focus:border-rudo-blue/40 transition-colors ${className}`}
          maxLength={maxLength}
          value={value}
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
