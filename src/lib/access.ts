import { accessFor } from "./business";
import { useRole } from "./role";
import { useWorkspace } from "./workspace";

export function useBusinessAccess() {
  const { me } = useRole();
  const { businessAccess, staffBusiness } = useWorkspace();
  return accessFor(me.id, staffBusiness, businessAccess);
}

export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
