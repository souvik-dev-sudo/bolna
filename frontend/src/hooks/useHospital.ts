import { useCallback, useSyncExternalStore } from "react";
import { hospitals, type Hospital } from "@/config/hospitals";

// The selected hospital, remembered in this browser and shared by every component that reads it.
const KEY = "nn.hospital";
const listeners = new Set<() => void>();
let memory: string | null = null;

function read(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHospital(): [Hospital, (id: string) => void] {
  const id = useSyncExternalStore(subscribe, read, () => null);
  const hospital = hospitals.find((h) => h.id === id) ?? hospitals[0];
  const select = useCallback((next: string) => {
    memory = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage blocked: kept in memory for this page */
    }
    listeners.forEach((l) => l());
  }, []);
  return [hospital, select];
}
