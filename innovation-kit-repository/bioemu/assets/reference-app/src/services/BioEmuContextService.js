/**
 * BioEmu Context Service
 * Tracks real-time frontend state for the Copilot
 */

export class BioEmuContextBuilder {
  constructor() {
    this.reset();
  }

  reset() {
    this.context = {
      // Current view state
      currentView: {
        activeTab: null,
        activeViewer: null,
        selectedFrame: null,
        activeAnalysisType: null,
        viewerState: {}
      },
      
      // App state
      app: {
        isDarkMode: false,
        isDemoMode: false
      },
      
      // Current protein
      currentProtein: null,
      
      // Structures availability
      structures: {
        bioemu: { available: false },
        alphafold: { available: false }
      },
      
      // Analysis data availability
      analysis: {
        trajectory: { available: false },
        flexibility: { available: false },
        secondaryStructure: { available: false }
      },
      
      // Session info
      session: {
        startTime: new Date(),
        interactions: 0,
        lastUpdate: new Date()
      }
    };
    
    return this;
  }

  // === Real-time Frontend State Tracking ===
  
  setActiveTab(tab) {
    this.context.currentView.activeTab = tab;
    this._updateTimestamp();
    return this;
  }
  
  setActiveViewer(viewerType, viewerState = {}) {
    this.context.currentView.activeViewer = viewerType;
    this.context.currentView.viewerState = viewerState;
    this._updateTimestamp();
    return this;
  }
  
  setSelectedFrame(frameNumber, frameData = {}) {
    this.context.currentView.selectedFrame = {
      number: frameNumber,
      data: frameData,
      timestamp: new Date().toISOString()
    };
    this._updateTimestamp();
    return this;
  }
  
  setActiveAnalysisType(analysisType, analysisData = null) {
    this.context.currentView.activeAnalysisType = {
      type: analysisType,
      data: analysisData,
      timestamp: new Date().toISOString()
    };
    this._updateTimestamp();
    return this;
  }

  // === App State Methods ===
  
  setAppState(appState) {
    this.context.app = { ...this.context.app, ...appState };
    this._updateTimestamp();
    return this;
  }
  
  setCurrentProtein(proteinData, source = 'custom') {
    this.context.currentProtein = {
      ...proteinData,
      source,
      timestamp: new Date().toISOString()
    };
    this._updateTimestamp();
    return this;
  }

  // === Structure Methods ===
  
  setBioEmuStructures(available, metadata = {}) {
    this.context.structures.bioemu = {
      available,
      ...metadata,
      timestamp: new Date().toISOString()
    };
    this._updateTimestamp();
    return this;
  }
  
  setAlphaFoldStructure(available, metadata = {}) {
    this.context.structures.alphafold = {
      available,
      ...metadata,
      timestamp: new Date().toISOString()
    };
    this._updateTimestamp();
    return this;
  }

  // === Analysis Methods ===
  
  setAnalysisData(analysisType, available, data = null) {
    if (this.context.analysis[analysisType]) {
      this.context.analysis[analysisType] = {
        available,
        data,
        timestamp: new Date().toISOString()
      };
    }
    this._updateTimestamp();
    return this;
  }

  // === Utility Methods ===
  
  _updateTimestamp() {
    this.context.session.lastUpdate = new Date();
    this.context.session.interactions++;
  }
  
  getFullContext() {
    return this.context;
  }
  
  getContextSummary() {
    return {
      currentTab: this.context.currentView.activeTab,
      activeViewer: this.context.currentView.activeViewer,
      selectedFrame: this.context.currentView.selectedFrame?.number,
      activeAnalysis: this.context.currentView.activeAnalysisType?.type,
      protein: this.context.currentProtein?.name || 'None',
      structuresAvailable: {
        bioemu: this.context.structures.bioemu.available,
        alphafold: this.context.structures.alphafold.available
      },
      analysisAvailable: {
        trajectory: this.context.analysis.trajectory.available,
        flexibility: this.context.analysis.flexibility.available,
        secondaryStructure: this.context.analysis.secondaryStructure.available
      }
    };
  }
}

// Global context instance
export const bioEmuContext = new BioEmuContextBuilder();
