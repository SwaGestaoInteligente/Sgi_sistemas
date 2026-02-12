import React from "react";
import { cn } from "./cn";

export type SidebarItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
};

export type SidebarSection = {
  title?: string;
  items: SidebarItem[];
};

export type SidebarProps = React.HTMLAttributes<HTMLElement> & {
  sections: SidebarSection[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
};

export const Sidebar: React.FC<SidebarProps> = ({
  className,
  sections,
  header,
  footer,
  ...props
}) => (
  <aside
    className={cn(
      "flex h-full w-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
      className
    )}
    {...props}
  >
    {header && <div>{header}</div>}
    <nav className="flex flex-1 flex-col gap-4">
      {sections.map((section, idx) => (
        <div key={`${section.title ?? "section"}-${idx}`} className="space-y-2">
          {section.title && (
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {section.title}
            </div>
          )}
          <div className="space-y-1">
            {section.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition",
                  item.active
                    ? "bg-blue-50 text-blue-700 shadow-sm"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <span className="flex items-center gap-2">
                  {item.icon && <span className="text-base">{item.icon}</span>}
                  {item.label}
                </span>
                {item.badge && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
    {footer && <div>{footer}</div>}
  </aside>
);
