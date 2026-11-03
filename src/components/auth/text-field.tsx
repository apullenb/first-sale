import type { InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "@/components/icons";
import { INPUT } from "@/components/styles";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: string;
  error: string | null;
  hint?: string;
  // Sits beside the input, e.g. a show-password button
  addon?: ReactNode;
}

export function TextField({ id, label, error, hint, addon, ...input }: TextFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[15.5px] font-semibold">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${error ? INPUT.replace("border-field", "border-danger") : INPUT} min-w-0 flex-1`}
          {...input}
        />
        {addon}
      </div>
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm font-semibold text-danger">
          <Icon name="info" size="sm" className="mt-px" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[14.5px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
