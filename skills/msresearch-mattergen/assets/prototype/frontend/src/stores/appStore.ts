import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Structure, StructureMetrics } from '../api/types'

interface AppState {
  // MatterGen state
  mattergenStructures: Structure[]
  mattergenSelection: Set<string>
  mattergenJobId: string | null
  latestMattergenBatchId: string | null

  // MatterSim state
  mattersimStructures: Structure[]
  mattersimSelection: Set<string>
  evaluationStatus: 'idle' | 'running' | 'complete'

  // Global UI state
  appMode: 'research' | 'production'
  demoMode: boolean // Controlled by backend DEMO_MODE env var, not user-togglable
  isGenerating: boolean
  tourActive: boolean

  // MatterGen actions
  setMattergenResults: (jobId: string, structures: Structure[]) => void
  clearMattergenResults: () => void
  toggleMattergenSelection: (id: string) => void
  selectAllMattergen: () => void
  clearMattergenSelection: () => void
  removeFromMattergen: (ids: string[]) => void

  // MatterSim actions
  addToMattersim: (structures: Structure[]) => void
  addUploadedToMattersim: (structures: Structure[]) => void
  clearMattersim: () => void
  removeFromMattersim: (ids: string[]) => void
  toggleMattersimSelection: (id: string) => void
  selectAllMattersim: () => void
  clearMattersimSelection: () => void
  setEvaluationStatus: (status: 'idle' | 'running' | 'complete') => void
  updateMetrics: (metrics: Record<string, StructureMetrics>) => void

  // Global UI actions
  setAppMode: (mode: 'research' | 'production') => void
  setDemoMode: (enabled: boolean) => void // Internal use only - set from backend config
  setIsGenerating: (generating: boolean) => void
  startTour: () => void
  endTour: () => void

  // Cross-cutting
  getStructureById: (id: string, context?: 'mattergen' | 'mattersim') => Structure | undefined
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      mattergenStructures: [],
      mattergenSelection: new Set<string>(),
      mattergenJobId: null,
      latestMattergenBatchId: null,
      mattersimStructures: [],
      mattersimSelection: new Set<string>(),
      evaluationStatus: 'idle',
      appMode: 'research',
      demoMode: false, // Default to false, will be set from backend config
      isGenerating: false,
      tourActive: false,

      // MatterGen actions
      setMattergenResults: (jobId, structures) =>
        set((state) => {
          // Append new structures to the list with batch ID
          const newStructures = structures.map((s, i) => ({
            ...s,
            index: state.mattergenStructures.length + i,
            generationBatchId: jobId,
          }))
          
          return {
            mattergenJobId: jobId,
            latestMattergenBatchId: jobId,
            // Append new structures to the end
            mattergenStructures: [...state.mattergenStructures, ...newStructures],
            mattergenSelection: new Set<string>(),
          }
        }),

      clearMattergenResults: () =>
        set({
          mattergenJobId: null,
          latestMattergenBatchId: null,
          mattergenStructures: [],
          mattergenSelection: new Set<string>(),
        }),

      toggleMattergenSelection: (id) =>
        set((state) => {
          const newSelection = new Set(state.mattergenSelection)
          if (newSelection.has(id)) {
            newSelection.delete(id)
          } else {
            newSelection.add(id)
          }
          return { mattergenSelection: newSelection }
        }),

      selectAllMattergen: () =>
        set((state) => ({
          mattergenSelection: new Set(state.mattergenStructures.map((s) => s.id)),
        })),

      clearMattergenSelection: () => set({ mattergenSelection: new Set<string>() }),

      removeFromMattergen: (ids) =>
        set((state) => {
          const idsToRemove = new Set(ids)
          return {
            mattergenStructures: state.mattergenStructures.filter(
              (s) => !idsToRemove.has(s.id)
            ),
            mattergenSelection: new Set(
              [...state.mattergenSelection].filter((id) => !idsToRemove.has(id))
            ),
          }
        }),

      // MatterSim actions
      addToMattersim: (structures) =>
        set((state) => {
          // Avoid duplicates by ID
          const existingIds = new Set(state.mattersimStructures.map((s) => s.id))
          const filteredStructures = structures.filter((s) => !existingIds.has(s.id))
          
          // Assign indices based on position in final array
          const newStructures = filteredStructures.map((s, i) => ({
            ...s,
            index: state.mattersimStructures.length + i,
            source: 'transfer' as const,
          }))
          
          return {
            mattersimStructures: [...state.mattersimStructures, ...newStructures],
          }
        }),

      addUploadedToMattersim: (structures) =>
        set((state) => {
          // Assign indices based on position in final array
          const newStructures = structures.map((s, i) => ({
            ...s,
            index: state.mattersimStructures.length + i,
            source: 'upload' as const,
          }))
          
          return {
            mattersimStructures: [...state.mattersimStructures, ...newStructures],
          }
        }),

      clearMattersim: () =>
        set({
          mattersimStructures: [],
          mattersimSelection: new Set<string>(),
          evaluationStatus: 'idle',
        }),

      removeFromMattersim: (ids) =>
        set((state) => {
          const idsToRemove = new Set(ids)
          return {
            mattersimStructures: state.mattersimStructures.filter(
              (s) => !idsToRemove.has(s.id)
            ),
            mattersimSelection: new Set(
              [...state.mattersimSelection].filter((id) => !idsToRemove.has(id))
            ),
          }
        }),

      toggleMattersimSelection: (id) =>
        set((state) => {
          const newSelection = new Set(state.mattersimSelection)
          if (newSelection.has(id)) {
            newSelection.delete(id)
          } else {
            newSelection.add(id)
          }
          return { mattersimSelection: newSelection }
        }),

      selectAllMattersim: () =>
        set((state) => ({
          mattersimSelection: new Set(state.mattersimStructures.map((s) => s.id)),
        })),

      clearMattersimSelection: () => set({ mattersimSelection: new Set<string>() }),

      setEvaluationStatus: (status) => set({ evaluationStatus: status }),

      updateMetrics: (metrics) =>
        set((state) => ({
          mattersimStructures: state.mattersimStructures.map((s) =>
            metrics[s.id] ? { ...s, metrics: metrics[s.id] } : s
          ),
        })),

      // Global UI actions
      setAppMode: (mode) => set({ appMode: mode }),
      setDemoMode: (enabled) => set({ demoMode: enabled }),
      setIsGenerating: (generating) => set({ isGenerating: generating }),
      startTour: () => set({ tourActive: true }),
      endTour: () => set({ tourActive: false }),

      // Cross-cutting
      getStructureById: (id, context) => {
        const state = get()
        // Prioritize the array matching the context so we get the version with metrics
        if (context === 'mattersim') {
          return (
            state.mattersimStructures.find((s) => s.id === id) ||
            state.mattergenStructures.find((s) => s.id === id)
          )
        }
        return (
          state.mattergenStructures.find((s) => s.id === id) ||
          state.mattersimStructures.find((s) => s.id === id)
        )
      },
    }),
    {
      name: 'mattergen-prototype-storage',
      // Only persist structures, not UI state like selection or demoMode (controlled by backend)
      partialize: (state) => ({
        mattergenStructures: state.mattergenStructures,
        mattergenJobId: state.mattergenJobId,
        latestMattergenBatchId: state.latestMattergenBatchId,
        mattersimStructures: state.mattersimStructures,
      }),
      // Handle Set serialization
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const parsed = JSON.parse(str)
          return {
            ...parsed,
            state: {
              ...parsed.state,
              mattergenSelection: new Set<string>(),
              mattersimSelection: new Set<string>(),
              evaluationStatus: 'idle',
            },
          }
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: (name) => {
          localStorage.removeItem(name)
        },
      },
    }
  )
)
