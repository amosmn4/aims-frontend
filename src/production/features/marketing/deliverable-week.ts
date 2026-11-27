import { createContext } from "react";

export const DeliverableWeek = createContext<string | null>(null);
export const DeliverableDelegate = createContext<((id: string) => void) | undefined>(undefined);
