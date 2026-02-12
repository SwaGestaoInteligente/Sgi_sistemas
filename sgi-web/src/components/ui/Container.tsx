import React from "react";
import { cn } from "./cn";

export type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: "sm" | "md" | "lg" | "xl";
};

const sizeClasses: Record<NonNullable<ContainerProps["size"]>, string> = {
  sm: "max-w-3xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl"
};

export const Container: React.FC<ContainerProps> = ({
  className,
  size = "lg",
  ...props
}) => (
  <div className={cn("mx-auto w-full px-4", sizeClasses[size], className)} {...props} />
);
