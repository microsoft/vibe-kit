import React, { useEffect, useRef, useState } from 'react';
// import XtcFormatConverter from './utils/XtcFormatConverter'; // COMMENTED OUT - Focus on basic structure first

// Permanently suppress known-harmless Molstar warnings for predicted structures.
// BioEMU outputs have zero CRYST1 params (no crystal symmetry), which causes
// Mol* to log these on every model load/switch. They are non-user-visible.
const _origConsoleError = console.error;
const _molstarSuppressed = ['non-invertible', 'Invalid typed array length'];
console.error = (...args) => {
  if (_molstarSuppressed.some(s => String(args[0] ?? '').includes(s))) return;
  _origConsoleError.apply(console, args);
};

/**
 * MolstarViewerFixed Enhanced - Professional 3D Protein Structure Display
 * 
 * FEATURES:
 * - PDB structure loading and display
 * - XTC trajectory animation with controls
 * - Sequence viewer with bidirectional highlighting
 * - Selection and measurement tools
 * - Clean UI optimized for research
 * 
 * @param {Object} pdbFile - The PDB file data from BioEmu API
 * @param {Object} xtcFile - The XTC trajectory file data
 */
const MolstarViewerFixedEnhanced = ({ pdbFile, xtcFile, isDarkMode = true }) => {
  const containerRef = useRef(null);
  const molstarContainerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const scriptLoadedRef = useRef(false);
  const isCleaningUpRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // COMMENTED OUT - Trajectory features for later implementation
  // const [totalFrames, setTotalFrames] = useState(0);
  // const [trajectoryValid, setTrajectoryValid] = useState(false);
  // const [diagnostics, setDiagnostics] = useState({});
  // Create isolated DOM container for Molstar
  useEffect(() => {
    const molstarDiv = document.createElement('div');
    molstarDiv.className = 'molstar-isolated-container-enhanced';
    molstarDiv.style.cssText = `
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
    `;
    
    molstarContainerRef.current = molstarDiv;
    
    if (containerRef.current) {
      containerRef.current.appendChild(molstarDiv);
    }

    return () => {
      if (molstarContainerRef.current && molstarContainerRef.current.parentNode) {
        try {
          molstarContainerRef.current.parentNode.removeChild(molstarContainerRef.current);
        } catch (e) {
          // Ignore removal errors
        }
      }
      molstarContainerRef.current = null;
    };
  }, []);

  useEffect(() => {
    // --- WebGL context loss handler ---
    const handleWebGLContextLost = (e) => {
      e.preventDefault();
      setError('WebGL context lost. Please reload the page or check your graphics settings.');
    };
    if (molstarContainerRef.current) {
      molstarContainerRef.current.addEventListener('webglcontextlost', handleWebGLContextLost, false);
    }
    return () => {
      if (molstarContainerRef.current) {
        molstarContainerRef.current.removeEventListener('webglcontextlost', handleWebGLContextLost, false);
      }
    };
  }, []);

  useEffect(() => {
    // --- Container size check ---
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) {
        setError('Molstar container is not visible or too small. Please ensure the viewer area is displayed and has a non-zero size.');
        setLoading(false);
        return;
      }
    }
    if (!pdbFile) {
      setError('No PDB file provided - requires Azure BioEmu API data');
      setLoading(false);
      return;
    }
    if (!molstarContainerRef.current) {
      setError('Molstar container not ready');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    isCleaningUpRef.current = false;

    // --- URL validation ---
    const isValidUrl = (url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };
    if (pdbFile?.url && !isValidUrl(pdbFile.url)) {
      setError('Invalid PDB file URL.');
      setLoading(false);
      return;
    }
    if (xtcFile?.url && !isValidUrl(xtcFile.url)) {
      setError('Invalid XTC file URL.');
      setLoading(false);
      return;
    }

    const initializeViewer = async () => {
      if (isCleaningUpRef.current) return;

      try {
        // Clear container and create viewer div
        molstarContainerRef.current.innerHTML = '';
        const viewerDiv = document.createElement('div');
        viewerDiv.style.cssText = 'width: 100%; height: 100%;';
        molstarContainerRef.current.appendChild(viewerDiv);

        if (isCleaningUpRef.current) return;
        // Enhanced viewer configuration
        const viewer = await window.molstar.Viewer.create(viewerDiv, {
          layoutShowControls: true,
          layoutShowSequence: true,
          layoutShowLog: false,
          layoutShowLeftPanel: false,
          layoutShowRightPanel: false,        // Hide Structure Tools panel
          layoutIsExpanded: false,
          viewportShowAnimation: true,
          viewportShowTrajectoryControls: true,
          viewportShowExpand: true,
          viewportShowSelectionMode: true,
          viewportShowSettings: true,
          layoutShowRemoteState: false,
        });

        if (isCleaningUpRef.current) {
          viewer?.dispose();
          return;
        }

        viewerInstanceRef.current = viewer;

        // Set canvas 3D background to match our app theme
        // Molstar's built-in dark theme handles all UI chrome — we only set the 3D viewport bg
        try {
          const canvas = viewer.plugin?.canvas3d;
          if (canvas) {
            const bgColor = isDarkMode ? 0x1b1b1f : 0xf0f0f0;
            canvas.setProps({
              renderer: {
                ...canvas.props.renderer,
                backgroundColor: bgColor,
              },
            });
          }
        } catch (e) {
          // Non-critical — Molstar default dark bg is fine
        }

        // Side panels hidden via CSS (.molstar-isolated-container-enhanced .msp-layout-right/left)

        // --- Try to load trajectory if both files are present ---
        if (pdbFile?.url && xtcFile?.url) {
          try {
            await viewer.loadTrajectory({
              model: { kind: 'model-url', url: pdbFile.url, format: 'pdb' },
              coordinates: { kind: 'coordinates-url', url: xtcFile.url, format: 'xtc', isBinary: true },
              preset: 'default',
              presetParams: { showUnitcell: false }
            });
            setLoading(false);
            return;
          } catch (trajError) {
            console.error('❌ viewer.loadTrajectory failed:', trajError);
            setError('Failed to load trajectory: ' + trajError.message);
            // Fallback to PDB-only below
          }
        }
        // --- END NEW ---

        // Load PDB structure (fallback or if no XTC)
        const pdbData = await viewer.plugin.builders.data.download({ 
          url: pdbFile.url, 
          isBinary: false 
        });
        if (isCleaningUpRef.current) return;
        const trajectory = await viewer.plugin.builders.structure.parseTrajectory(pdbData, 'pdb');
        const model = await viewer.plugin.builders.structure.createModel(trajectory);
        const structure = await viewer.plugin.builders.structure.createStructure(model);
        await viewer.plugin.builders.structure.representation.addRepresentation(structure, {
          type: 'cartoon',
          color: 'secondary-structure',
          size: 'uniform',
          smoothing: 2
        });
        if (!isCleaningUpRef.current) {
          setLoading(false);
        }

      } catch (error) {
        console.error('❌ Molstar initialization failed:', error);
        if (!isCleaningUpRef.current) {
          setError(`Viewer failed: ${error.message}`);
          setLoading(false);
        }
      }
    };

    // Molstar CDN version — v5.7.0 is the first with built-in theme/dark.css
    const MOLSTAR_VERSION = '5.7.0';
    const CDN_BASE = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer`;

    // Ensure correct Molstar CSS skin is loaded (dark or light)
    const ensureSkin = () => {
      const skinUrl = isDarkMode
        ? `${CDN_BASE}/theme/dark.css`
        : `${CDN_BASE}/molstar.css`;
      const existing = document.getElementById('molstar-skin');
      if (existing && existing.getAttribute('href') === skinUrl) return;
      if (existing) existing.remove();
      const link = document.createElement('link');
      link.id = 'molstar-skin';
      link.rel = 'stylesheet';
      link.href = skinUrl;
      document.head.appendChild(link);
    };

    // Load Molstar resources
    const loadMolstarResources = () => {
      ensureSkin();

      const script = document.createElement('script');
      script.src = `${CDN_BASE}/molstar.js`;
      
      script.onload = () => {
        scriptLoadedRef.current = true;
        initializeViewer();
      };
      
      script.onerror = () => {
        setError('Failed to load Molstar library');
        setLoading(false);
      };
      
      document.head.appendChild(script);
    };
    
    if (window.molstar) {
      ensureSkin();
      initializeViewer();
    } else if (!scriptLoadedRef.current) {
      loadMolstarResources();
    }

    return () => {
      isCleaningUpRef.current = true;
      
      if (viewerInstanceRef.current) {
        try {
          if (typeof viewerInstanceRef.current.dispose === 'function') {
            viewerInstanceRef.current.dispose();
          } else if (viewerInstanceRef.current.plugin?.dispose) {
            viewerInstanceRef.current.plugin.dispose();
          }
        } catch (e) {
        }
        viewerInstanceRef.current = null;
      }
    };
  }, [pdbFile, xtcFile, isDarkMode]); // React to file and theme changes

  return (
    <div className="w-full h-full relative">
      {/* Clean 3D viewer container */}
      <div 
        className="w-full h-full relative rounded" 
        ref={containerRef}
        style={{ position: 'relative', minHeight: '400px', background: isDarkMode ? 'var(--bg-base)' : 'var(--bg-layer-2)' }}
      >        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 rounded" style={{ background: isDarkMode ? 'rgba(27,27,31,0.9)' : 'rgba(245,245,245,0.9)' }}>
            <div className="text-center">
              <div style={{ width: 64, height: 64, border: '4px solid var(--stroke-default)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto' }} className="animate-spin"></div>
              <p className="text-heading" style={{ marginTop: 16, fontSize: 14 }}>Loading 3D Protein Structure...</p>
              <p className="text-body" style={{ marginTop: 8, fontSize: 13 }}>Building interactive molecular viewer...</p>
            </div>
          </div>
        )}
          {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10 rounded" style={{ background: isDarkMode ? 'rgba(27,27,31,0.9)' : 'rgba(245,245,245,0.9)' }}>
            <div className="error-card" style={{ maxWidth: 400, margin: 16 }}>
              <div className="error-card__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div className="error-card__body">
                <div className="error-card__title">Structure Loading Failed</div>
                <div className="error-card__message">{error}</div>
                <div className="text-caption" style={{ marginTop: 8 }}>Try refreshing or check BioEmu API connection</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MolstarViewerFixedEnhanced;
