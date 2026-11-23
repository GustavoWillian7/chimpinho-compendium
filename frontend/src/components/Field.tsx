import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';

export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-gray">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className="min-h-11 rounded-panel border border-gray/40 bg-black px-3 text-white focus:border-yellow"
      />
    </div>
  );
}
