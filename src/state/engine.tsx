import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { WorkerEngine, type EngineStatus } from "../lib/browserEmbedder";
import { MODEL } from "../lib/config";

const engine = new WorkerEngine(MODEL.id);
const EngineContext = createContext<WorkerEngine>(engine);

export function EngineProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void engine.load();
  }, []);
  return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>;
}

export function useEngine(): WorkerEngine {
  return useContext(EngineContext);
}

export function useEngineStatus(): EngineStatus {
  const e = useEngine();
  const [s, setS] = useState(e.status);
  useEffect(() => e.subscribe(setS), [e]);
  return s;
}
