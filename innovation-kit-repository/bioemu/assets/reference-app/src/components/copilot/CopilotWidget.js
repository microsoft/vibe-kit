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
      {/* Minimized State - Floating Help Button */}
      {!isExpanded && (
        <button
          onClick={toggleExpanded}
          className={`group relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110 ${
            isDarkMode
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
          title="BioEmu copilot experience - AI Guide"
        >
          {/* Chat/Help Copilot Icon */}
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          
          {/* Copilot sparkles */}
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2">
            <div className="w-full h-full bg-gradient-to-br from-purple-400 to-blue-400 rounded-full opacity-75"></div>
          </div>
          <div className="absolute top-0 -left-0.5 w-1 h-1">
            <div className="w-full h-full bg-yellow-400 rounded-full"></div>
          </div>
          
          {/* Static overlay (animations disabled) */}
          <div className="absolute inset-0 rounded-full bg-blue-400 opacity-20"></div>
          
          {/* Tooltip */}
          <div className={`absolute bottom-full mb-2 right-0 px-3 py-2 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ${
            isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-900 text-white'
          }`}>
            BioEmu copilot experience - Ask anything!
            <div className="absolute top-full right-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </button>
      )}

      {/* Expanded State - Chat Panel */}
      {isExpanded && (
        <div 
          className={`relative rounded-xl shadow-xl border transition-all duration-300 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          } ${isResizing ? 'user-select-none' : ''}`}
          style={{ 
            width: `${dimensions.width}px`, 
            height: `${dimensions.height}px`,
            minWidth: '350px',  // Updated to match new minimum
            minHeight: '400px', // Updated to match new minimum
            maxWidth: '800px',
            maxHeight: '700px'  // Updated to match new maximum
          }}
        >
          {/* Resize Handle - Top Left Corner */}
          <div
            className={`absolute -top-1 -left-1 w-4 h-4 cursor-nw-resize opacity-0 hover:opacity-100 transition-opacity ${
              isDarkMode ? 'bg-blue-500' : 'bg-blue-500'
            } rounded-full border-2 border-white shadow-md z-10`}
            onMouseDown={handleResizeStart}
            title="Drag to resize"
          >
            <div className="absolute inset-1 bg-blue-600 rounded-full"></div>
          </div>
          
          {/* Resize Handle - Left Edge */}
          <div
            className={`absolute top-0 -left-1 w-2 h-full cursor-ew-resize opacity-0 hover:opacity-30 transition-opacity ${
              isDarkMode ? 'bg-blue-500' : 'bg-blue-500'
            }`}
            onMouseDown={handleResizeStart}
          ></div>
          
          {/* Resize Handle - Top Edge */}
          <div
            className={`absolute -top-1 left-0 w-full h-2 cursor-ns-resize opacity-0 hover:opacity-30 transition-opacity ${
              isDarkMode ? 'bg-blue-500' : 'bg-blue-500'
            }`}
            onMouseDown={handleResizeStart}
          ></div>
          {/* Header */}
          <div className={`flex items-center justify-between p-4 border-b ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center relative ${
                isDarkMode ? 'bg-blue-600' : 'bg-blue-500'
              }`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {/* Copilot sparkles (static) */}
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-gradient-to-br from-purple-300 to-blue-300 rounded-full"></div>
                <div className="absolute top-0 -left-0.5 w-1 h-1 bg-yellow-300 rounded-full"></div>
              </div>
              <div>
                <h3 className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  BioEmu copilot experience
                </h3>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  AI-powered protein science guide
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Expertise Level Selector */}
              <select
                value={expertiseLevel}
                onChange={(e) => handleExpertiseLevelChange(e.target.value)}
                className={`text-xs px-2 py-1 rounded border ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-300' 
                    : 'bg-gray-100 border-gray-300 text-gray-700'
                }`}
                title="Set your expertise level for tailored responses"
              >
                <option value="auto">Auto</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
              
              {/* Minimize Button */}
              <button
                onClick={toggleExpanded}
                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
                title="Minimize"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Chat Content */}
          <div className="flex-1 overflow-hidden" style={{ height: `${dimensions.height - 80}px` }}>
            <CopilotChat 
              context={{...context, userLevel: expertiseLevel}}
              isDarkMode={isDarkMode}
              getCopilotResponse={getCopilotResponse}
            />
          </div>

          {/* Resize Handle - Bottom Right Corner */}
          <div 
            onMouseDown={handleResizeStart}
            className={`absolute bottom-0 right-0 w-4 h-4 cursor-se-resize ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
            } rounded-br-xl transition-all duration-300`}
          ></div>
        </div>
      )}
    </div>
  );
};

export default CopilotWidget;
