import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';

const styles: Record<Variant, string> = {
  primary: 'bg-red text-white hover:bg-terracotta',
  ghost: 'border border-gray/40 text-white hover:border-yellow hover:text-yellow',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`min-h-11 rounded-panel px-4 font-sub font-semibold transition-colors disabled:opacity-50 ${styles[variant]} ${className}`}
    />
  );
}
