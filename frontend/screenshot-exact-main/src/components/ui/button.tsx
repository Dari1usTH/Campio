import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium cursor-pointer select-none transition-[transform,background-color,box-shadow,color] duration-200 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-soft hover:bg-navy-soft dark:hover:bg-cream-soft",
        coral:
          "bg-coral text-coral-foreground font-semibold shadow-coral hover:-translate-y-0.5 hover:brightness-105",
        cream: "bg-cream-soft text-navy shadow-soft hover:bg-surface-raised",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-transparent text-foreground hover:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted/70",
        ghost: "text-foreground hover:bg-secondary",
        ghostLight: "text-navy-foreground hover:bg-navy-foreground/10",
        link: "rounded-md text-foreground underline underline-offset-4 decoration-coral decoration-2 hover:text-coral-ink",
      },
      size: {
        default: "h-11 px-5 text-sm",
        sm: "h-11 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-base md:h-16 md:px-10 md:text-lg",
        icon: "h-11 w-11",
        iconSm: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
