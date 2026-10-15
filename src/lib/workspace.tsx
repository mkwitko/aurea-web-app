import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { workspaceStore } from './api';

interface WorkspaceContextValue {
  /** `null` until the user picks one — nothing stored, nothing to send. */
  workspaceId: string | null;
  setWorkspaceId: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(() => workspaceStore.id);

  function setWorkspaceId(id: string) {
    workspaceStore.set(id);
    setWorkspaceIdState(id);
    // Every cached response belongs to the workspace it was fetched under —
    // showing it under the new one is showing the user another company's
    // data. Clear, not invalidate: invalidation leaves the stale response on
    // screen during the refetch.
    queryClient.clear();
  }

  return <WorkspaceContext.Provider value={{ workspaceId, setWorkspaceId }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
