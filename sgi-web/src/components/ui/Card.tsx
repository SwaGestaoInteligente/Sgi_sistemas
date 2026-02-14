import React from "react";
import { cn } from "./cn";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "muted";
};

export const Card: React.FC<CardProps> = ({
  className,
  variant = "default",
  ...props
}) => (
  <div
    className={cn(
      "rounded-2xl transition-all duration-200",
      "border backdrop-blur-sm",
      "shadow-[0_10px_30px_rgba(15,23,42,0.06)]",
      "hover:shadow-[0_15px_40px_rgba(15,23,42,0.08)]",
      variant === "default"
        ? "bg-white border-slate-200"
        : "bg-slate-50 border-slate-200",
      className
    )}
    {...props}
  />
);

export const CardHeader: React.FC<
  React.HTMLAttributes<HTMLDivElement>
> = ({ className, ...props }) => (
  <div className={cn("px-6 pt-6 pb-3", className)} {...props} />
);

export const CardTitle: React.FC<
  React.HTMLAttributes<HTMLHeadingElement>
> = ({ className, ...props }) => (
  <h3
    className={cn(
      "text-lg font-semibold tracking-tight text-slate-800",
      className
    )}
    {...props}
  />
);

export const CardDescription: React.FC<
  React.HTMLAttributes<HTMLParagraphElement>
> = ({ className, ...props }) => (
  <p
    className={cn(
      "text-sm text-slate-500 leading-relaxed",
      className
    )}
    {...props}
  />
);

export const CardContent: React.FC<
  React.HTMLAttributes<HTMLDivElement>
> = ({ className, ...props }) => (
  <div className={cn("px-6 pb-6", className)} {...props} />
);

export const CardFooter: React.FC<
  React.HTMLAttributes<HTMLDivElement>
> = ({ className, ...props }) => (
  <div className={cn("px-6 pb-6 pt-3", className)} {...props} />
);
