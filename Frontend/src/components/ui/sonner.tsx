import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-full !border-0 !bg-navy !text-navy-foreground !shadow-float !px-5 !font-medium",
          description: "!text-navy-foreground/75",
          actionButton: "!bg-coral !text-coral-foreground !rounded-full",
          cancelButton: "!bg-navy-soft !text-navy-foreground !rounded-full",
          icon: "!text-coral",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
