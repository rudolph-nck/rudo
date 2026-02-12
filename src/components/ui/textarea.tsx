"use client";

import { TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block mb-2 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`w-full px-4 py-3 bg-white border border-rudo-card-border text-rudo-dark-text font-outfit text-sm placeholder:text-rudo-dark-muted focus:outline-none focus:border-rudo-blue/40 transition-colors resize-none ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-rudo-rose">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
