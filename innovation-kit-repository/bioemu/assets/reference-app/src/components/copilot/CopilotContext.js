/**
 * BioEmu copilot experience Context - Manages AI copilot state and API interactions
 * Provides scientific explanations and educational content for protein analysis
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

const CopilotContext = createContext();

export const useCopilotContext = () => {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error('useCopilotContext must be used within a CopilotProvider');
  }
  return context;
};

export const CopilotProvider = ({ children }) => {
  const [isEnabled, setIsEnabled] = useState(() => {
    // Load copilot preference from localStorage, default to true (enabled by default)
    const saved = localStorage.getItem('bioemu-copilot-enabled');
    return saved ? saved === 'true' : true;
  });
  
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Messages for the chat interface (persistent across minimize/maximize)
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'assistant',
      content: 'Hi! I\'m the BioEmu copilot 🧬 - I can help explain what BioEmu is, how to use the platform, and answer protein science questions. What would you like to know?',
      timestamp: new Date()
    }
  ]);

  // Toggle copilot feature
  const toggleCopilot = useCallback((enabled) => {
    setIsEnabled(enabled);
    localStorage.setItem('bioemu-copilot-enabled', enabled.toString());
  }, []);

  // Clear conversation history
  const clearHistory = useCallback(() => {
    setConversationHistory([]);
    // Reset messages to initial welcome message
    setMessages([
      {
        id: 1,
        type: 'assistant',
        content: 'Hi! I\'m the BioEmu copilot 🧬 - I can help explain what BioEmu is, how to use the platform, and answer protein science questions. What would you like to know?',
        timestamp: new Date()
      }
    ]);
  }, []);

  // Add message to chat
  const addMessage = useCallback((message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  // Get copilot response from backend
  const getCopilotResponse = useCallback(async (message, context = {}) => {
    if (!isEnabled) {
      return {
        success: false,
        error: 'Copilot is not enabled'
      };
    }

    setIsLoading(true);
    
    try {
      // Detect environment (same logic as BioEmuService)
      const isDevelopment = window.location.hostname === 'localhost' && window.location.port !== '80' && window.location.port !== '443';
      const baseUrl = isDevelopment ? 'http://localhost:5000' : '';
      
      const response = await fetch(`${baseUrl}/api/copilot/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          context,
          history: conversationHistory.slice(-10) // Keep last 10 messages for context
        })
      });

      if (!response.ok) {
        throw new Error(`Copilot API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Update conversation history
      const newEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        user: message,
        assistant: data.response,
        context: context
      };
      
      setConversationHistory(prev => [...prev, newEntry]);
      
      return {
        success: true,
        response: data.response,
        context: data.context
      };
      
    } catch (error) {
      console.error('Copilot error:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, conversationHistory]);

  // Get educational content for a specific protein
  const getProteinExplanation = useCallback(async (proteinData) => {
    const context = {
      type: 'protein_explanation',
      sequence: proteinData.sequence,
      name: proteinData.name,
      description: proteinData.description,
      uniprotId: proteinData.uniprotId,
      hasAlphaFold: !!proteinData.alphafoldStructure
    };

    const message = `Explain this protein in simple terms for someone learning about proteins: ${proteinData.name}`;
    return await getCopilotResponse(message, context);
  }, [getCopilotResponse]);

  // Get explanation for analysis results
  const getAnalysisExplanation = useCallback(async (analysisData, chartType) => {
    const context = {
      type: 'analysis_explanation',
      chartType,
      analysisData: {
        rmsd: analysisData.rmsd,
        energyLandscape: analysisData.energyLandscape,
        secondaryStructure: analysisData.secondaryStructure
      }
    };

    const message = `Explain what this ${chartType} analysis shows and what it means for protein behavior`;
    return await getCopilotResponse(message, context);
  }, [getCopilotResponse]);

  const value = {
    isEnabled,
    isLoading,
    conversationHistory,
    messages,
    toggleCopilot,
    clearHistory,
    addMessage,
    getCopilotResponse,
    getProteinExplanation,
    getAnalysisExplanation
  };

  return (
    <CopilotContext.Provider value={value}>
      {children}
    </CopilotContext.Provider>
  );
};

export default CopilotContext;
