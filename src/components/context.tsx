/**
 * Pillar Context
 * Provides API client, event emitter, and config to components
 */

import { h, createContext, type ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import type { APIClient } from '../api/client';
import type { ResolvedConfig } from '../core/config';
import type { EventEmitter } from '../core/events';

interface PillarContextValue {
  api: APIClient;
  events: EventEmitter;
  config: ResolvedConfig;
}

const PillarContext = createContext<PillarContextValue | null>(null);

interface PillarProviderProps {
  api: APIClient;
  events: EventEmitter;
  config: ResolvedConfig;
  children: ComponentChildren;
}

export function PillarProvider({ api, events, config, children }: PillarProviderProps) {
  return (
    <PillarContext.Provider value={{ api, events, config }}>
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

export function useConfig(): ResolvedConfig {
  return usePillar().config;
}

