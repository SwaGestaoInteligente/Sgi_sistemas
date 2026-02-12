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
      "rounded-2xl border shadow-sm",
      variant === "default" ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50",
      className
    )}
    {...props}
  />
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div className={cn("px-5 pt-5 pb-3", className)} {...props} />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  ...props
}) => (
  <h3 className={cn("text-lg font-semibold text-slate-900", className)} {...props} />
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => (
  <p className={cn("text-sm text-slate-500", className)} {...props} />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div className={cn("px-5 pb-5", className)} {...props} />
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div className={cn("px-5 pb-5 pt-2", className)} {...props} />
);
