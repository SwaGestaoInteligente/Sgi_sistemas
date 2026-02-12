import React from "react";
import { cn } from "./cn";

export type HeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export const Header: React.FC<HeaderProps> = ({
  className,
  title,
  subtitle,
  actions,
  ...props
}) => (
  <div
    className={cn(
      "flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3",
      className
    )}
    {...props}
  >
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
