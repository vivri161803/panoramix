import { IconAlertCircle } from "./icons";

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <div id={id} role="alert" className="px-error">
      <IconAlertCircle /> {message}
    </div>
  );
}
