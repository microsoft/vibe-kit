import React, { useEffect, useRef, useState } from 'react';
import { MOLSTAR_CSS_URL, MOLSTAR_JS_URL } from '../constants';

/**
 * MolstarViewerEnhanced - 3D Protein Structure Viewer
 * 
 * Displays PDB structures with optional XTC trajectory animation using Molstar.
 */
const MolstarViewerFixedEnhanced = ({ pdbFile, xtcFile }) => {
  const containerRef = useRef(null);
  const molstarContainerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const scriptLoadedRef = useRef(false);
  const isCleaningUpRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

        console.log('Initializing Simplified Molstar Viewer...');

        // Enhanced viewer configuration - DISABLE left panel to save space
        const viewer = await window.molstar.Viewer.create(viewerDiv, {
          layoutShowControls: true,           // ENABLE - needed for trajectory controls to show
          layoutShowSequence: true,           // ENABLE - amino acid sequence panel with residue highlighting
          layoutShowLog: false,               // DISABLE - prevent text overlap
          layoutShowLeftPanel: false,         // DISABLE - hide download/import panel to save space
          layoutShowRightPanel: false,        // DISABLE - right panel to save space  
          layoutIsExpanded: false,            // DISABLE - prevent text overlap
          viewportShowAnimation: true,        // ENABLE - trajectory playback controls
          viewportShowTrajectoryControls: true, // ENABLE - trajectory controls
          viewportShowExpand: true,           // ENABLE - expand button
          viewportShowSelectionMode: true,    // ENABLE - measurement and selection tools
          viewportShowSettings: true,         // ENABLE - settings panel

          // HIDE REMOTE STATES SECTION - Remove confusing remote state snapshots
          layoutShowRemoteState: false,       // DISABLE - completely hide "Remote States" section

          pluginConfig: {
            layout: {
              initial: {
                isExpanded: false,
                showControls: true,
                regionState: {
                  bottom: 'full',
                  left: 'hidden',   // Hide left panel to maximize 3D viewer space
                  right: 'hidden',
                  top: 'full'
                }
              }
            },
            canvas3d: {
              camera: { manualReset: true, mode: 'perspective' },
              renderer: {
                antialias: true,
                pixelScale: 1,
                backgroundColor: 'black'  // Dark theme for research environments
              },
              postprocessing: {
                outline: { name: 'off', params: {} },
                occlusion: { name: 'off', params: {} },
                shadow: { name: 'off', params: {} }
              }
            },
            structure: {
              representation: {
                moleculaSurfaceParams: { alpha: 0.7, smoothing: 2 }
              }
            }
          }
        });

        if (isCleaningUpRef.current) {
          viewer?.dispose();
          return;
        }

        viewerInstanceRef.current = viewer;

        // Force hide right panel after viewer creation
        try {
          if (viewer.plugin?.layout?.events?.updated) {
            viewer.plugin.layout.setProps({
              showRightPanel: false,
              isExpanded: false
            });
          }
        } catch (e) {
          console.log('Could not hide right panel:', e);
        }

        // --- NEW: Try to load trajectory if both files are present ---
        if (pdbFile?.url && xtcFile?.url) {
          try {
            console.log('Attempting to load trajectory with viewer.loadTrajectory...');
            await viewer.loadTrajectory({
              model: { kind: 'model-url', url: pdbFile.url, format: 'pdb' },
              coordinates: { kind: 'coordinates-url', url: xtcFile.url, format: 'xtc', isBinary: true },
              preset: 'default'
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
        console.log('Loading PDB structure...');
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

    // Load Molstar resources
    const loadMolstarResources = () => {
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = MOLSTAR_CSS_URL;
      document.head.appendChild(cssLink);

      const script = document.createElement('script');
      script.src = MOLSTAR_JS_URL;

      script.onload = () => {
        scriptLoadedRef.current = true;
        console.log('✅ Molstar script loaded');
        initializeViewer();
      };

      script.onerror = () => {
        setError('Failed to load Molstar library');
        setLoading(false);
      };

      document.head.appendChild(script);
    };

    if (window.molstar) {
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
          console.warn('Cleanup warning:', e);
        }
        viewerInstanceRef.current = null;
      }
    };
  }, [pdbFile, xtcFile]); // React to file changes

  return (
    <div className="w-full h-full relative">
      {/* Clean 3D viewer container - no internal controls */}
      <div
        className="w-full h-full relative bg-gray-900 rounded"
        ref={containerRef}
        style={{ position: 'relative', minHeight: '400px' }}
      >        {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 z-10 rounded">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-t-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-white font-medium">Loading 3D Protein Structure...</p>
            <p className="mt-2 text-gray-400 text-sm">Building interactive molecular viewer...</p>
          </div>
        </div>
      )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 z-10 rounded">
            <div className="bg-red-900 p-4 rounded-lg max-w-md mx-4">
              <h3 className="text-white font-bold mb-2">🚨 Structure Loading Failed</h3>
              <p className="text-red-200 text-sm">{error}</p>
              <div className="mt-2 text-xs text-yellow-200">
                💡 Try refreshing or check BioEmu API connection
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MolstarViewerFixedEnhanced;
