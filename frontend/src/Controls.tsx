import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "disabled" | "onClick" | "onPointerDown" | "type"
> & {
  children: ReactNode;
  className?: string;
};

/** Shared circular icon control used throughout the lesson and help views. */
export function IconButton({
  children,
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  const classes = ["control-button", "icon-button", className].filter(Boolean).join(" ");
  return <button className={classes} type={type} {...props}>{children}</button>;
}

/** Compact workspace control that toggles a panel between split and expanded width. */
export function WorkspaceWidthButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  const classes = [
    "control-button",
    "pill-button",
    "workspace-width-button",
    active ? "active" : ""
  ].filter(Boolean).join(" ");
  return (
    <button
      className={classes}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
