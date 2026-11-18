import { useState, type InputHTMLAttributes } from "react";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";

export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`field-input w-full pr-12 ${props.className ?? ""}`}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? (
          <VisibilityOffOutlined fontSize="small" />
        ) : (
          <VisibilityOutlined fontSize="small" />
        )}
      </button>
    </span>
  );
}
