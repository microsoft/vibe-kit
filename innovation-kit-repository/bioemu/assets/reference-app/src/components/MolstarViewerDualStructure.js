import React, { useEffect, useRef, useState } from 'react';
import { MOLSTAR_CSS_URL, MOLSTAR_JS_URL } from '../constants';

/**
 * MolstarViewerDualStructure - Loads both BioEmu and AlphaFold structures in a single Molstar viewer
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

        console.log('Initializing Dual Structure Molstar Viewer...');

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
        const loadedStructures = { bioemu: false, alphafold: false, customPdb: false };

        // Load BioEmu structure (with trajectory if available)
        if (bioEmuFiles?.pdbFile?.url) {
          try {
            console.log('Loading BioEmu structure...');

            // Try trajectory first if XTC file is available
            if (bioEmuFiles.xtcFile?.url) {
              try {
                await viewer.loadTrajectory({
                  model: { kind: 'model-url', url: bioEmuFiles.pdbFile.url, format: 'pdb' },
                  coordinates: { kind: 'coordinates-url', url: bioEmuFiles.xtcFile.url, format: 'xtc', isBinary: true },
                  preset: 'default'
                });
                loadedStructures.bioemu = true;
                console.log('BioEmu trajectory loaded successfully');
              } catch (trajError) {
                console.warn('⚠️ Trajectory loading failed, falling back to PDB only:', trajError);
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
                console.log('BioEmu PDB loaded successfully');
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
              console.log('BioEmu PDB loaded successfully');
            }
          } catch (error) {
            console.warn('⚠️ Error loading BioEmu structure:', error);
          }
        }

        // Load AlphaFold structure
        if (alphaFoldFile?.url) {
          try {
            console.log('Loading AlphaFold structure...');

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
            console.log('AlphaFold structure loaded successfully');
          } catch (error) {
            console.warn('⚠️ Error loading AlphaFold structure:', error);
          }
        }

        // Load Custom PDB structure
        if (customPdbFile?.url) {
          try {
            console.log('Loading Custom PDB structure...');

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
            console.log('Custom PDB structure loaded successfully');
          } catch (error) {
            console.warn('⚠️ Error loading Custom PDB structure:', error);
          }
        }

        setLoading(false);
        console.log('✅ Triple structure viewer initialized successfully');

      } catch (error) {
        console.error('❌ Molstar initialization failed:', error);
        if (!isCleaningUpRef.current) {
          setError(`Viewer failed: ${error.message}`);
          setLoading(false);
        }
      }
    };

    // Load Molstar resources (same as working version)
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
  }, [bioEmuFiles, alphaFoldFile, customPdbFile, isDarkMode]);

  return (
    <div className="w-full h-full relative">
      {/* Main viewer container */}
      <div
        className={`w-full h-full relative ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'} rounded`}
        ref={containerRef}
        style={{ position: 'relative', minHeight: '400px' }}
      >
        {loading && (
          <div className={`absolute inset-0 flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'} bg-opacity-90 z-10 rounded`}>
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-t-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className={`mt-4 ${isDarkMode ? 'text-white' : 'text-gray-900'} font-medium`}>Loading Dual Structure Viewer...</p>
              <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>Preparing BioEmu and AlphaFold comparison...</p>
            </div>
          </div>
        )}

        {error && (
          <div className={`absolute inset-0 flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'} bg-opacity-90 z-10 rounded`}>
            <div className="bg-red-900 p-4 rounded-lg max-w-md mx-4">
              <h3 className="text-white font-bold mb-2">🚨 Structure Loading Failed</h3>
              <p className="text-red-200 text-sm">{error}</p>
              <div className="mt-2 text-xs text-yellow-200">
                💡 Try refreshing or check structure file availability
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MolstarViewerDualStructure;
