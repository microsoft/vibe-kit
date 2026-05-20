/**
 * BioEmu copilot experience Widget - Main container for AI-powered scientific explanations
 * Provides contextual help and educational content for protei                           <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Navigate the BioEmu Research Platform
                </p><div>
                <h3 className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  BioEmu copilot experience
                </h3>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  title="Navigate the BioEmu Research Platform"
                </p>
              </div>is
 */

import React, { useState, useCallback } from 'react';
import CopilotChat from './CopilotChat';
import { useCopilotContext } from './CopilotContext';

// User expertise level management
const getUserExpertiseLevel = () => {
  return localStorage.getItem('bioemu-user-expertise') || 'auto';
};

const setUserExpertiseLevel = (level) => {
  localStorage.setItem('bioemu-user-expertise', level);
};

const CopilotWidget = ({ 
  mode = 'minimized', 
  position = 'bottom-right',
  context = {},
  isDarkMode = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 480, height: 520 }); // Increased from 384x384 to 480x520
  const [isResizing, setIsResizing] = useState(false);
  const [expertiseLevel, setExpertiseLevelState] = useState(getUserExpertiseLevel());
  const { getCopilotResponse } = useCopilotContext();

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleExpertiseLevelChange = useCallback((level) => {
    setUserExpertiseLevel(level);
    setExpertiseLevelState(level);
    // No need to reload - context will update automatically
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dimensions.width;
    const startHeight = dimensions.height;
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = startX - moveEvent.clientX; // Subtract because we're growing left/up
      const deltaY = startY - moveEvent.clientY;
      
      const newWidth = Math.max(350, Math.min(800, startWidth + deltaX)); // Min 350px (increased from 300px), max 800px
      const newHeight = Math.max(400, Math.min(700, startHeight + deltaY)); // Min 400px (increased from 250px), max 700px
      
      setDimensions({ width: newWidth, height: newHeight });
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [dimensions]);



  // Position classes with more padding
  const positionClasses = {
    'bottom-right': 'fixed bottom-8 right-8 z-50',
    'bottom-left': 'fixed bottom-8 left-8 z-50',
    'top-right': 'fixed top-8 right-8 z-50',
  };

  return (
    <div className={positionClasses[position]}>
      {/* Minimized State — Floating button */}
      {!isExpanded && (
        <button
          onClick={toggleExpanded}
          style={{
            width: 44, height: 44, borderRadius: 'var(--radius-lg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-layer-2)', border: '1px solid var(--stroke-default)',
            color: 'var(--fg-secondary)', cursor: 'pointer',
            boxShadow: 'var(--shadow-8)', transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-primary)'; e.currentTarget.style.color = 'var(--brand-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--stroke-default)'; e.currentTarget.style.color = 'var(--fg-secondary)'; }}
          title="BioEmu Copilot"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {/* Expanded State — Chat Panel */}
      {isExpanded && (
        <div 
          className="card card--raised"
          style={{ 
            width: dimensions.width, height: dimensions.height,
            minWidth: 350, minHeight: 400, maxWidth: 800, maxHeight: 700,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            userSelect: isResizing ? 'none' : undefined
          }}
        >
          {/* Resize handles */}
          <div style={{ position: 'absolute', top: -1, left: -1, width: 14, height: 14, cursor: 'nw-resize', zIndex: 10, borderRadius: 'var(--radius-sm)' }}
               onMouseDown={handleResizeStart} />
          <div style={{ position: 'absolute', top: 0, left: -1, width: 3, height: '100%', cursor: 'ew-resize' }}
               onMouseDown={handleResizeStart} />
          <div style={{ position: 'absolute', top: -1, left: 0, width: '100%', height: 3, cursor: 'ns-resize' }}
               onMouseDown={handleResizeStart} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--stroke-default)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--brand-bg)', color: 'var(--brand-primary)'
              }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <div className="text-heading" style={{ fontSize: 13 }}>BioEmu Copilot</div>
                <div className="text-caption">Protein science guide</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                value={expertiseLevel}
                onChange={(e) => handleExpertiseLevelChange(e.target.value)}
                className="input-field"
                style={{ fontSize: 11, padding: '2px 6px' }}
                title="Set your expertise level"
              >
                <option value="auto">Auto</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
              
              <button
                onClick={toggleExpanded}
                className="btn-outline"
                style={{ padding: '2px 6px', border: 'none' }}
                title="Minimize"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Chat Content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <CopilotChat 
              context={{...context, userLevel: expertiseLevel}}
              isDarkMode={isDarkMode}
              getCopilotResponse={getCopilotResponse}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CopilotWidget;
