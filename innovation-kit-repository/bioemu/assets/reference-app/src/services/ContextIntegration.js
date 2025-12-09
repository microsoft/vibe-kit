/**
 * Context Integration Service
 * Provides simple methods to update Copilot context when app state changes
 */

import { bioEmuContext } from './BioEmuContextService';

export class ContextIntegration {

  // === Frontend State Tracking ===

  static onTabChanged(newTab) {
    bioEmuContext.setActiveTab(newTab);
  }

  static onViewerChanged(viewerType, viewerState = {}) {
    bioEmuContext.setActiveViewer(viewerType, viewerState);
  }

  static onFrameSelected(frameNumber, frameData = {}) {
    bioEmuContext.setSelectedFrame(frameNumber, frameData);
  }

  static onAnalysisViewed(analysisType, analysisData = null) {
    bioEmuContext.setActiveAnalysisType(analysisType, analysisData);
  }

  // === App State Updates ===

  static onAppStateChanged(appState) {
    bioEmuContext.setAppState(appState);
  }

  static onProteinChanged(proteinData, source = 'custom') {
    bioEmuContext.setCurrentProtein(proteinData, source);
  }

  // === Structure Updates ===

  static onBioEmuStructuresLoaded(available, metadata = {}) {
    bioEmuContext.setBioEmuStructures(available, metadata);
  }

  static onAlphaFoldStructureLoaded(available, metadata = {}) {
    bioEmuContext.setAlphaFoldStructure(available, metadata);
  }

  // === Analysis Updates ===

  static onTrajectoryAnalysisAvailable(available, data = null) {
    bioEmuContext.setAnalysisData('trajectory', available, data);
  }

  static onFlexibilityAnalysisAvailable(available, data = null) {
    bioEmuContext.setAnalysisData('flexibility', available, data);
  }

  static onSecondaryStructureAnalysisAvailable(available, data = null) {
    bioEmuContext.setAnalysisData('secondaryStructure', available, data);
  }

  // === Utility Methods ===

  static getContextSummary() {
    return bioEmuContext.getContextSummary();
  }

  static getFullContext() {
    return bioEmuContext.getFullContext();
  }
}

export default ContextIntegration;
