import React, { useEffect, useRef, useState } from 'react';

/**
 * MolstarViewerDualStructure - Based on working MolstarViewerFixed.enhanced.js
 * Loads both BioEmu and AlphaFold structures in a single Molstar viewer
 */
const MolstarViewerDualStructure = ({ 
  bioEmuFiles, 
  alphaFoldFile, 
  customPdbFile,
  sequence, 
  analysisData, 
  isDarkMode 
}) => {
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
    molstarDiv.className = 'molstar-isolated-container-dual';
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

  // WebGL context loss handler
  useEffect(() => {
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
    // Container size check
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) {
        setError('Molstar container is not visible or too small.');
        setLoading(false);
        return;
      }
    }

    // Check if we have at least one structure
    if (!bioEmuFiles?.pdbFile && !alphaFoldFile) {
      setError('No structure files provided');
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

    // URL validation
    const isValidUrl = (url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    if (bioEmuFiles?.pdbFile?.url && !isValidUrl(bioEmuFiles.pdbFile.url)) {
      setError('Invalid BioEmu PDB file URL.');
      setLoading(false);
      return;
    }

    if (alphaFoldFile?.url && !isValidUrl(alphaFoldFile.url)) {
      setError('Invalid AlphaFold file URL.');
      setLoading(false);
      return;
    }

    if (customPdbFile?.url && !isValidUrl(customPdbFile.url)) {
      setError('Invalid custom PDB file URL.');
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
        // Use optimized configuration for compare tab - hide left panel to save space
        const viewer = await window.molstar.Viewer.create(viewerDiv, {
          layoutShowControls: true,
          layoutShowSequence: true,
          layoutShowLog: false,
          layoutShowLeftPanel: false,         // DISABLE - hide download/import panel to save space
          layoutShowRightPanel: true,
          layoutIsExpanded: false,
          viewportShowAnimation: true,
          viewportShowTrajectoryControls: true,
          viewportShowExpand: true,
          viewportShowSelectionMode: true,
          viewportShowSettings: true,

          // HIDE REMOTE STATES SECTION - Remove confusing remote state snapshots
          layoutShowRemoteState: false,       // DISABLE - completely hide "Remote States" section

          pluginConfig: {
            layout: {
              initial: {
                isExpanded: false,
                showControls: true,
                regionState: {
                  bottom: 'full',
                  left: 'hidden',     // Hide left panel to maximize 3D viewer space
                  right: 'collapsed',
                  top: 'full'
                }
              }
            },
            canvas3d: {
              camera: { manualReset: true, mode: 'perspective' },
              renderer: { 
                antialias: true, 
                pixelScale: 1,
                backgroundColor: isDarkMode ? 'black' : 'white'
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

        // Set canvas 3D background to match app theme
        try {
          const canvas = viewer.plugin?.canvas3d;
          if (canvas) {
            canvas.setProps({
              renderer: { ...canvas.props.renderer, backgroundColor: isDarkMode ? 0x1b1b1f : 0xf0f0f0 },
            });
          }
        } catch (e) { /* non-critical */ }

        const loadedStructures = { bioemu: false, alphafold: false, customPdb: false };

        // Load BioEmu structure (with trajectory if available)
        if (bioEmuFiles?.pdbFile?.url) {
          try {
            // Try trajectory first if XTC file is available
            if (bioEmuFiles.xtcFile?.url) {
              try {
                await viewer.loadTrajectory({
                  model: { kind: 'model-url', url: bioEmuFiles.pdbFile.url, format: 'pdb' },
                  coordinates: { kind: 'coordinates-url', url: bioEmuFiles.xtcFile.url, format: 'xtc', isBinary: true },
                  preset: 'default'
                });
                loadedStructures.bioemu = true;
              } catch (trajError) {
                // Fallback to PDB only
                const pdbData = await viewer.plugin.builders.data.download({ 
                  url: bioEmuFiles.pdbFile.url, 
                  isBinary: false 
                });
                const trajectory = await viewer.plugin.builders.structure.parseTrajectory(pdbData, 'pdb');
                const model = await viewer.plugin.builders.structure.createModel(trajectory);
                const structure = await viewer.plugin.builders.structure.createStructure(model);
                await viewer.plugin.builders.structure.representation.addRepresentation(structure, {
                  type: 'cartoon',
                  color: 'secondary-structure',
                  size: 'uniform',
                  smoothing: 2
                });
                loadedStructures.bioemu = true;
              }
            } else {
              // Load PDB only
              const pdbData = await viewer.plugin.builders.data.download({ 
                url: bioEmuFiles.pdbFile.url, 
                isBinary: false 
              });
              const trajectory = await viewer.plugin.builders.structure.parseTrajectory(pdbData, 'pdb');
              const model = await viewer.plugin.builders.structure.createModel(trajectory);
              const structure = await viewer.plugin.builders.structure.createStructure(model);
              await viewer.plugin.builders.structure.representation.addRepresentation(structure, {
                type: 'cartoon',
                color: 'secondary-structure',
                size: 'uniform',
                smoothing: 2
              });
              loadedStructures.bioemu = true;
            }
          } catch (error) {
          }
        }

        // Load AlphaFold structure
        if (alphaFoldFile?.url) {
          try {
            const alphaFoldData = await viewer.plugin.builders.data.download({ 
              url: alphaFoldFile.url, 
              isBinary: false 
            });
            const trajectory = await viewer.plugin.builders.structure.parseTrajectory(alphaFoldData, 'pdb');
            const model = await viewer.plugin.builders.structure.createModel(trajectory);
            const structure = await viewer.plugin.builders.structure.createStructure(model);
            
            // Use different representation for AlphaFold (confidence coloring)
            await viewer.plugin.builders.structure.representation.addRepresentation(structure, {
              type: 'cartoon',
              color: 'confidence',
              size: 'uniform',
              smoothing: 2
            });
            
            loadedStructures.alphafold = true;
          } catch (error) {
          }
        }

        // Load Custom PDB structure
        if (customPdbFile?.url) {
          try {
            const customPdbData = await viewer.plugin.builders.data.download({ 
              url: customPdbFile.url, 
              isBinary: false 
            });
            const trajectory = await viewer.plugin.builders.structure.parseTrajectory(customPdbData, 'pdb');
            const model = await viewer.plugin.builders.structure.createModel(trajectory);
            const structure = await viewer.plugin.builders.structure.createStructure(model);
            
            // Use different representation for Custom PDB (element coloring)
            await viewer.plugin.builders.structure.representation.addRepresentation(structure, {
              type: 'cartoon',
              color: 'element-symbol',
              size: 'uniform',
              smoothing: 2
            });
            
            loadedStructures.customPdb = true;
          } catch (error) {
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('❌ Molstar initialization failed:', error);
        if (!isCleaningUpRef.current) {
          setError(`Viewer failed: ${error.message}`);
          setLoading(false);
        }
      }
    };

    // Load Molstar resources (same as working version)
    const MOLSTAR_VERSION = '5.7.0';
    const CDN_BASE = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer`;

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
  }, [bioEmuFiles, alphaFoldFile, customPdbFile, isDarkMode]);

  return (
    <div className="w-full h-full relative">
      {/* Main viewer container */}
      <div 
        className="w-full h-full relative rounded"
        ref={containerRef}
        style={{ position: 'relative', minHeight: '400px', background: 'var(--bg-base)' }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 rounded" style={{ background: isDarkMode ? 'rgba(27,27,31,0.9)' : 'rgba(245,245,245,0.9)' }}>
            <div className="text-center">
              <div style={{ width: 64, height: 64, border: '4px solid var(--stroke-default)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto' }} className="animate-spin"></div>
              <p className="text-heading" style={{ marginTop: 16, fontSize: 14 }}>Loading Dual Structure Viewer...</p>
              <p className="text-body" style={{ marginTop: 8, fontSize: 13 }}>Preparing BioEmu and AlphaFold comparison...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10 rounded" style={{ background: isDarkMode ? 'rgba(27,27,31,0.9)' : 'rgba(245,245,245,0.9)' }}>
            <div className="error-card" style={{ maxWidth: 400, margin: 16 }}>
              <div className="error-card__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div className="error-card__body">
                <div className="error-card__title">Structure Loading Failed</div>
                <div className="error-card__message">{error}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MolstarViewerDualStructure;
