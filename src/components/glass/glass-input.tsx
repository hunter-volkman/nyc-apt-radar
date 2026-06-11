import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type GlassInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helper?: string;
};

type GlassTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  helper?: string;
};

export function GlassInput({ label, helper, className, ...props }: GlassInputProps) {
  return (
    <label className="grid gap-2">
      <span className="fine-label">{label}</span>
      <input className={cn("glass-field min-h-12 px-4 py-3", className)} {...props} />
      {helper ? <span className="text-xs leading-5 text-white/54">{helper}</span> : null}
    </label>
  );
}

export function GlassTextarea({ label, helper, className, ...props }: GlassTextareaProps) {
  return (
    <label className="grid gap-2">
      <span className="fine-label">{label}</span>
      <textarea className={cn("glass-field min-h-36 resize-y px-4 py-3", className)} {...props} />
      {helper ? <span className="text-xs leading-5 text-white/54">{helper}</span> : null}
    </label>
  );
}
