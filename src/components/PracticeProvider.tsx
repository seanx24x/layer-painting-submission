"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { guides } from "@/lib/guides";
import { getGuidePaintMaterials } from "@/lib/guide-primer";
import {
  SESSION_STORAGE_KEY,
  type GuideSessionDefinition,
  type PracticeSession,
  type SessionAction,
  type SessionError,
  type SessionsByGuide,
} from "@/lib/session";
import { createPracticeStorage } from "@/lib/practice-storage";

export const definitions: GuideSessionDefinition[] = guides.map((guide) => ({
  id: guide.id,
  version: 1,
  stepIds: guide.steps.map((step) => step.id),
  preparedIds: [
    ...getGuidePaintMaterials(guide).map((paint) => paint.id),
    ...guide.tools.map((_, i) => `tool-${i}`),
  ],
}));
const Context = createContext<{
  sessions: SessionsByGuide;
  ready: boolean;
  error: SessionError | null;
  unsavedChanges: boolean;
  change: (guideId: string, action?: SessionAction) => PracticeSession | undefined;
  advance: (guideId: string, stepId: string) => { session: PracticeSession; completionAdded: boolean } | undefined;
  retry: () => boolean;
  reset: () => boolean;
} | null>(null);

export function PracticeProvider({ children }: { children: ReactNode }) {
  const [storage] = useState(() => createPracticeStorage(definitions));
  const [snapshot, setSnapshot] = useState(storage.getSnapshot);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    function restore() {
      storage.restore();
      setSnapshot(storage.getSnapshot());
    }
    // Browser storage is an external system; hydrate after the server render.
    restore();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    function synchronize(event: StorageEvent) {
      if (event.key === SESSION_STORAGE_KEY || event.key === null) restore();
    }
    window.addEventListener("storage", synchronize);
    return () => window.removeEventListener("storage", synchronize);
  }, [storage]);
  useEffect(() => {
    if (!snapshot.unsavedChanges) return;
    const protectUnsavedWork = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectUnsavedWork);
    return () => window.removeEventListener("beforeunload", protectUnsavedWork);
  }, [snapshot.unsavedChanges]);
  function change(guideId: string, action?: SessionAction) {
    if (!ready) return;
    storage.change(guideId, action);
    const next = storage.getSnapshot();
    setSnapshot(next);
    return next.sessions[guideId];
  }
  function advance(guideId: string, stepId: string) {
    if (!ready) return;
    const result = storage.changeWithResult(guideId, { type: "advance-step", stepId });
    setSnapshot(storage.getSnapshot());
    if (!result.session) return;
    return { session: result.session, completionAdded: result.completionAdded };
  }
  function retry() {
    const saved = storage.retry();
    setSnapshot(storage.getSnapshot());
    return saved;
  }
  function reset() {
    const saved = storage.reset();
    setSnapshot(storage.getSnapshot());
    return saved;
  }
  return (
    <Context.Provider value={{ ...snapshot, ready, change, advance, retry, reset }}>
      {children}
    </Context.Provider>
  );
}
export function usePractice() {
  const value = useContext(Context);
  if (!value) throw new Error("PracticeProvider is required.");
  return value;
}
