import React from "react";
import { cn } from "./cn";

type TitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  level?: 1 | 2 | 3 | 4;
};

export const Title: React.FC<TitleProps> = ({
  level = 2,
  className,
  ...props
}) => {
  const Tag = `h${level}` as const;
  const size =
    level === 1
      ? "text-3xl"
      : level === 2
      ? "text-2xl"
      : level === 3
      ? "text-xl"
      : "text-lg";
  return (
    <Tag className={cn("font-semibold text-slate-900", size, className)} {...props} />
  );
};

type TextProps = React.HTMLAttributes<HTMLParagraphElement> & {
  size?: "sm" | "md" | "lg";
  muted?: boolean;
};

export const Text: React.FC<TextProps> = ({
  size = "md",
  muted,
  className,
  ...props
}) => (
  <p
    className={cn(
      size === "lg" ? "text-lg" : size === "sm" ? "text-sm" : "text-base",
      muted ? "text-slate-500" : "text-slate-700",
      className
    )}
    {...props}
  />
);

export const Label: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({
  className,
  ...props
}) => (
  <span
    className={cn("text-xs font-semibold uppercase tracking-wide text-slate-400", className)}
    {...props}
  />
);
