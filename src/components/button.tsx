// components/ui/button.tsx
import React from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/utils";

export const Button = React.forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        {...props}
        className={cn(
          "inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500",
          className
        )}
      />
    );
  }
);
Button.displayName = "Button";