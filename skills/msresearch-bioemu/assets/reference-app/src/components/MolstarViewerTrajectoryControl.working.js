import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';

/**
 * MolstarViewerTrajectoryControl - Working frame synchronization
 * 
 * CONFIRMED WORKING: Programmatic frame control via native UI simulation
 * RIGHT PANEL DISABLED FOR ANALYZE TAB
 */
const MolstarViewerTrajectoryControl = forwardRef(({ 
  pdbFile, 
  xtcFile, 
  targetFrame, 
  onFrameChange,
  isDarkMode = true
}, ref) => {
  const containerRef = useRef(null);
  const molstarContainerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const scriptLoadedRef = useRef(false);
  const isCleaningUpRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [trajectoryReady, setTrajectoryReady] = useState(false);
  
  // Track actual frame to avoid reading corrupted input
  const [actualMolstarFrame, setActualMolstarFrame] = useState(1);
  
  // Create isolated DOM container for Molstar
  useEffect(() => {
    const molstarDiv = document.createElement('div');
    molstarDiv.className = 'molstar-isolated-container';
    molstarDiv.style.cssText = `
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
    `;
    
    molstarContainerRef.current = molstarDiv;
    
    const container = containerRef.current;
    if (container) {
      container.appendChild(molstarDiv);
    }

    return () => {
      if (molstarDiv && container) {
        try {
          container.removeChild(molstarDiv);
        } catch (e) {
        }
      }
    };
  }, []);

  // Expose frame control method to parent
  useImperativeHandle(ref, () => ({
    jumpToFrame: async (frameIndex) => {
      if (!trajectoryReady || !viewerInstanceRef.current) {
        return false;
      }
      
      try {
        // WORKING METHOD: Use Molstar's native trajectory controls simulation
        try {
          // Find trajectory controls in the UI with multiple selector attempts
          let modelIndexInput = document.querySelector('.msp-control-group input[type="number"]');
          
          // Try alternative selectors if the first one fails
          if (!modelIndexInput) {
            modelIndexInput = document.querySelector('input[type="number"]');
          }
          if (!modelIndexInput) {
            modelIndexInput = document.querySelector('.msp-control-group input');
          }
          if (!modelIndexInput) {
            modelIndexInput = document.querySelector('[data-testid*="model"] input, [aria-label*="model"] input, [placeholder*="model"] input');
          }
          
          if (modelIndexInput) {
            // Use relative navigation with next/prev buttons - THIS WORKED BEFORE
            const currentMolstarFrame = actualMolstarFrame; // FIX: Use tracking instead of corrupted input
            const targetMolstarFrame = frameIndex + 1; // Convert to 1-based
            const frameDifference = targetMolstarFrame - currentMolstarFrame;
            if (frameDifference === 0) {
              setCurrentFrame(frameIndex);
              return true;
            }
            
            // Find navigation buttons with multiple selector attempts
            let nextButton = document.querySelector('button[title*="next"], button[title*="Next"]');
            let prevButton = document.querySelector('button[title*="prev"], button[title*="Previous"]');
            
            // Try alternative button selectors
            if (!nextButton) {
              nextButton = document.querySelector('button[aria-label*="next"], button[aria-label*="Next"]');
            }
            if (!prevButton) {
              prevButton = document.querySelector('button[aria-label*="prev"], button[aria-label*="Previous"]');
            }
            if (!nextButton) {
              nextButton = document.querySelector('button:has([class*="arrow"]), button:has([class*="right"])');
            }
            if (!prevButton) {
              prevButton = document.querySelector('button:has([class*="arrow"]), button:has([class*="left"])');
            }
            
            if (frameDifference > 0 && nextButton) {
              // Move forward - INSTANT (no delays, just requestAnimationFrame)
              for (let i = 0; i < frameDifference; i++) {
                nextButton.click();
                await new Promise(resolve => requestAnimationFrame(resolve)); // Browser-optimal timing
              }
            } else if (frameDifference < 0 && prevButton) {
              // Move backward - INSTANT (no delays, just requestAnimationFrame)
              const stepsBack = Math.abs(frameDifference);
              for (let i = 0; i < stepsBack; i++) {
                prevButton.click();
                await new Promise(resolve => requestAnimationFrame(resolve)); // Browser-optimal timing
              }
            } else {
              return false;
            }
            
            // Wait and verify - LIGHTNING FAST
            await new Promise(resolve => setTimeout(resolve, 1)); // Minimal verification: 1ms
            
            const finalFrame = parseInt(document.querySelector('input[type="number"]')?.value || '1');
            if (finalFrame === targetMolstarFrame) {
              setCurrentFrame(frameIndex);
              setActualMolstarFrame(targetMolstarFrame); // FIX: Update tracking
              return true;
            } else {
              return false;
            }
          }
          
          // Try clicking trajectory navigation buttons as fallback
          const nextButton = document.querySelector('button[title*="next"], button[title*="Next"]');
          const prevButton = document.querySelector('button[title*="prev"], button[title*="Previous"]');
          
          if (nextButton || prevButton) {
            const currentFrame = actualMolstarFrame - 1; // FIX: Use tracking instead of corrupted input
            const frameDiff = frameIndex - currentFrame;
            
            if (frameDiff > 0 && nextButton) {
              // Click next button multiple times - INSTANT
              for (let i = 0; i < frameDiff; i++) {
                nextButton.click();
                await new Promise(resolve => requestAnimationFrame(resolve)); // Browser-optimal timing
              }
            } else if (frameDiff < 0 && prevButton) {
              // Click previous button multiple times - INSTANT
              for (let i = 0; i < Math.abs(frameDiff); i++) {
                prevButton.click();
                await new Promise(resolve => requestAnimationFrame(resolve)); // Browser-optimal timing
              }
            }
            setCurrentFrame(frameIndex);
            setActualMolstarFrame(frameIndex + 1); // FIX: Update tracking
            return true;
          }
        } catch (nativeError) {
        }
        return false;
        
      } catch (error) {
        console.error('❌ jumpToFrame error:', error);
        return false;
      }
    }
  }));

  // Main effect for loading Molstar and initializing viewer
  useEffect(() => {
    // Container size check
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) {
        setError('Molstar container is not visible or too small');
        setLoading(false);
        return;
      }
    }
    
    if (!pdbFile) {
      setError('No PDB file provided');
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
        // Viewer configuration optimized for trajectory control - MINIMAL UI
        const viewer = await window.molstar.Viewer.create(viewerDiv, {
          layoutShowControls: false,          // DISABLE - hide all control panels
          layoutShowSequence: false,          // DISABLE - save space
          layoutShowLog: false,               // DISABLE - prevent text overlap
          layoutShowLeftPanel: false,         // DISABLE - hide download/import panel
          layoutShowRightPanel: false,        // DISABLE - hide tools panel
          layoutIsExpanded: false,            // DISABLE - prevent expansion
          disableRightPanel: true,            // FORCE DISABLE - additional setting
          viewportShowAnimation: true,        // ENABLE - trajectory playback controls
          viewportShowTrajectoryControls: true, // ENABLE - trajectory controls
          viewportShowExpand: false,          // DISABLE - no expand button to save space
          viewportShowSelectionMode: false,   // DISABLE - save space
          viewportShowSettings: false,        // DISABLE - save space

          // HIDE REMOTE STATES SECTION - Remove confusing remote state snapshots
          layoutShowRemoteState: false,       // DISABLE - completely hide "Remote States" section

          pluginConfig: {
            layout: {
              initial: {
                isExpanded: false,
                showControls: true,
                regionState: {
                  bottom: 'full',
                  left: 'hidden',   // Completely hide left panel instead of collapsed
                  right: 'hidden',  // Completely hide right panel
                  top: 'full'
                }
              }
            },
            canvas3d: {
              camera: { manualReset: true, mode: 'perspective' },
              renderer: { 
                antialias: true, 
                pixelScale: 1,
                backgroundColor: 'black'
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
            },
            // Disable external network requests
            volumeStreaming: {
              defaultServer: undefined,
              enabled: false
            },
            behavior: {
              disableNetworkRequests: true
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

        // Force hide right panel immediately after viewer creation
        try {
          const rightPanel = viewerDiv.querySelector('.msp-layout-region.msp-layout-region-right');
          if (rightPanel) {
            rightPanel.style.display = 'none';
            rightPanel.style.width = '0px';
          }
          
          // Also try through plugin API
          if (viewer.plugin.layout) {
            viewer.plugin.layout.setProps({ 
              regionState: { 
                ...viewer.plugin.layout.state.regionState,
                right: 'hidden' 
              } 
            });
          }
        } catch (hideError) {
        }

        // Try to load trajectory if both files are present
        if (pdbFile?.url && xtcFile?.url) {
          try {
            await viewer.loadTrajectory({
              model: { kind: 'model-url', url: pdbFile.url, format: 'pdb' },
              coordinates: { kind: 'coordinates-url', url: xtcFile.url, format: 'xtc', isBinary: true },
              preset: 'default'
            });
            
            setTrajectoryReady(true);
            // Ensure right panel is completely hidden after loading - with delay for DOM rendering
            setTimeout(() => {
              try {
                // Try multiple approaches to hide the right panel
                const rightPanel = viewerDiv.querySelector('.msp-layout-region.msp-layout-region-right');
                if (rightPanel) {
                  rightPanel.style.display = 'none !important';
                  rightPanel.style.visibility = 'hidden';
                  rightPanel.style.width = '0px';
                  rightPanel.style.opacity = '0';
                }
                
                // Also try through plugin API
                if (viewer.plugin.layout) {
                  viewer.plugin.layout.setProps({ 
                    regionState: { 
                      ...viewer.plugin.layout.state.regionState,
                      right: 'hidden' 
                    } 
                  });
                }
              } catch (layoutError) {
              }
            }, 1000); // Wait 1 second for full rendering
            
            setLoading(false);
            return;
          } catch (trajError) {
            console.error('❌ viewer.loadTrajectory failed:', trajError);
            setError('Failed to load trajectory: ' + trajError.message);
            // Fallback to PDB-only below
          }
        }

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

    // Load Molstar resources
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
  }, [pdbFile, xtcFile]); // React to file changes

  // Effect to handle targetFrame changes from parent (PCA plot clicks)
  useEffect(() => {
    if (targetFrame !== undefined && targetFrame !== currentFrame && trajectoryReady && viewerInstanceRef.current) {
      // Use ref to access the jumpToFrame method
      if (ref && ref.current && ref.current.jumpToFrame) {
        ref.current.jumpToFrame(targetFrame).then((success) => {
          if (success) {
          } else {
          }
        }).catch((error) => {
          console.error(`❌ Error syncing to frame ${targetFrame}:`, error);
        });
      }
    }
  }, [targetFrame, currentFrame, trajectoryReady, ref]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-black rounded overflow-hidden"
      style={{ minHeight: '300px' }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 z-10 rounded">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-t-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-white font-medium">Loading 3D Structure...</p>
            <p className="mt-2 text-gray-400 text-sm">Setting up frame synchronization...</p>
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

      {/* Frame info for development */}
      {process.env.NODE_ENV === 'development' && trajectoryReady && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs p-2 rounded">
          <div>Frame: {currentFrame}</div>
          <div>Target: {targetFrame}</div>
          <div>Ready: {trajectoryReady ? '✅' : '❌'}</div>
        </div>
      )}
    </div>
  );
});

MolstarViewerTrajectoryControl.displayName = 'MolstarViewerTrajectoryControl';

export default MolstarViewerTrajectoryControl;
