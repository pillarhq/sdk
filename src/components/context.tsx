/**
 * Pillar Context
 * Provides API client and event emitter to components
 */

import { h, createContext, type ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import type { APIClient } from '../api/client';
import type { EventEmitter } from '../core/events';

interface PillarContextValue {
  api: APIClient;
  events: EventEmitter;
}

const PillarContext = createContext<PillarContextValue | null>(null);

interface PillarProviderProps {
  api: APIClient;
  events: EventEmitter;
  children: ComponentChildren;
}

export function PillarProvider({ api, events, children }: PillarProviderProps) {
  return (
    <PillarContext.Provider value={{ api, events }}>
      {children}
    </PillarContext.Provider>
  );
}

export function usePillar(): PillarContextValue {
  const context = useContext(PillarContext);
  if (!context) {
    throw new Error('usePillar must be used within a PillarProvider');
  }
  return context;
}

export function useAPI(): APIClient {
  return usePillar().api;
}

export function useEvents(): EventEmitter {
  return usePillar().events;
}

