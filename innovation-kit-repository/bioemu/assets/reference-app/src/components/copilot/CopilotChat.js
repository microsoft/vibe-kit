/**
 * BioEmu copilot experience Chat - Interactive chat interface for scientific Q&A
 * Handles user questions and displays AI responses about protein analysis
 */

import React, { useState, useRef, useEffect } from 'react';
import { useCopilotContext } from './CopilotContext';

const CopilotChat = ({ context = {}, isDarkMode = false }) => {
  const { getCopilotResponse, isLoading: copilotLoading, messages, addMessage, clearHistory } = useCopilotContext();
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Smart typing hints based on current input
  const getTypingHints = () => {
    const input = inputMessage.toLowerCase();
    const hints = [];
    
    if (input.includes('why') && input.length > 3) {
      hints.push('🤔 Great question! I can explain the science behind what you see.');
    } else if (input.includes('how') && input.length > 3) {
      hints.push('🔧 I can walk you through the process step by step.');
    } else if (input.includes('what') && input.length > 4) {
      hints.push('📚 I can explain concepts and definitions clearly.');
    } else if (input.includes('compare') || input.includes('difference')) {
      hints.push('⚖️ I can compare different methods and approaches.');
    } else if (input.includes('rmsd') || input.includes('pca') || input.includes('flexibility')) {
      hints.push('🔬 I can explain the technical details and interpretation.');
    }
    
    return hints.slice(0, 1); // Show only one hint
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Enhanced message formatting for scientific content and basic markdown
  const formatMessage = (content) => {
    // Basic markdown parsing
    return content
      // Bold text **text** or __text__
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      // Italic text *text* or _text_
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      // Code `code`
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">$1</code>')
      // Line breaks
      .replace(/\n/g, '<br>')
      // Scientific terms and data
      .replace(/\b(RMSD|PCA|PC1|PC2|AlphaFold)\b/g, '<strong>$1</strong>')
      .replace(/(\d+\.?\d*)\s?(Å|angstrom)/gi, '<strong>$1 Å</strong>')
      .replace(/(\d+)\s?(amino acids?|residues?)/gi, '<strong>$1 $2</strong>')
      .replace(/(\d+\.?\d*)\s?%/g, '<strong>$1%</strong>');
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || copilotLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    addMessage(userMessage);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Get AI response based on current context
      const result = await getCopilotResponse(inputMessage.trim(), context);
      
      const assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: result.success ? result.response : (result.error || 'Sorry, I encountered an error.'),
        timestamp: new Date(),
        isError: !result.success
      };

      addMessage(assistantMessage);
    } catch (error) {
      console.error('Copilot response error:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: 'I apologize, but I\'m having trouble responding right now. Please try asking again in a moment.',
        timestamp: new Date(),
        isError: true
      };

      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Map backend tab IDs to frontend display names
  const getTabDisplayName = (tabId) => {
    const tabNames = {
      'input': 'Generate',
      'visualization': 'Structure', 
      'alphafold': 'Compare',
      'landscape': 'Analysis',
      'conformational': 'Analysis', // Alternative name
      'data': 'Export'
    };
    return tabNames[tabId] || tabId;
  };

  // Context-aware quick suggestions - enhanced for persistent display
  const getQuickSuggestions = () => {
    const suggestions = [];
    
    // Tab-specific suggestions based on what's currently visible
    if (context.activeTab === 'input') {
      // Generate tab suggestions
      if (context.userLevel === 'beginner') {
        suggestions.push('What is BioEmu?', 'How do I get started?');
        if (context.currentSequence) {
          suggestions.push('What will happen to my protein?');
        } else {
          suggestions.push('Can I use my own protein sequence?');
        }
      } else if (context.userLevel === 'expert') {
        suggestions.push('How do I input my protein sequence?', 'What input formats are supported?');
        if (context.currentSequence) {
          suggestions.push(`Analysis workflow for this ${context.sequenceLength}-residue sequence`);
        } else {
          suggestions.push('Compare input formats and validation');
        }
      } else {
        // Auto level - balanced suggestions
        suggestions.push('How do I generate a protein ensemble?', 'What protein should I analyze?');
        if (context.currentSequence) {
          suggestions.push(`Analyze this ${context.sequenceLength}-residue sequence`);
        } else {
          suggestions.push('Can I paste my own protein sequence?');
        }
      }
    } else if (context.activeTab === 'visualization' && context.hasAnalysisData) {
      // Structure tab suggestions - Updated for improved RMSD visualization
      if (context.userLevel === 'beginner') {
        suggestions.push('What am I looking at?', 'Why does the protein move?');
        if (context.hasRMSDData) {
          suggestions.push('What do the four statistics boxes mean?');
        }
      } else if (context.userLevel === 'expert') {
        suggestions.push('How to interpret ensemble structure variations', 'Understanding the 2x2 RMSD statistics grid');
        if (context.ensembleStats?.n_frames) {
          suggestions.push(`Analyzing ${context.ensembleStats.n_frames} conformational samples`);
        }
      } else {
        // Auto level
        suggestions.push('Explain these flexibility patterns', 'What are the Avg, Min, Max RMSD values?');
        if (context.ensembleStats?.n_frames) {
          suggestions.push(`Why ${context.ensembleStats.n_frames} BioEmu samples?`);
        }
        if (context.hasRMSDData) {
          suggestions.push('What does RMSD variation mean?', 'How to read the statistics grid?');
        }
      }
    } else if (context.activeTab === 'landscape' || context.activeTab === 'conformational') {
      // Analysis tab suggestions
      if (context.userLevel === 'beginner') {
        suggestions.push('What is this plot showing?', 'Why are there dots scattered around?');
        if (context.hasTrajectoryData) {
          suggestions.push('What do the colors mean?');
        }
      } else if (context.userLevel === 'expert') {
        suggestions.push('How to interpret PCA eigenvalue contributions', 'Best practices for trajectory analysis');
        if (context.pcaStats?.cumulativeVarianceExplained) {
          const variance = Math.round(context.pcaStats.cumulativeVarianceExplained);
          suggestions.push(`Interpreting ${variance}% cumulative variance`);
        }
      } else {
        // Auto level
        suggestions.push('How do I interpret this PCA plot?', 'What are conformational states?');
        if (context.hasTrajectoryData) {
          suggestions.push('Why do proteins cluster in PCA space?');
        }
        if (context.pcaStats?.cumulativeVarianceExplained) {
          const variance = Math.round(context.pcaStats.cumulativeVarianceExplained);
          suggestions.push(`Why only ${variance}% variance explained?`);
        }
      }
    } else if (context.activeTab === 'alphafold') {
      // Compare tab suggestions - Updated for choice-based comparison system
      if (context.userLevel === 'beginner') {
        suggestions.push('What is the pink protein structure?', 'How do I choose a reference structure?');
        if (context.hasAlphaFoldStructure) {
          suggestions.push('AlphaFold vs Custom PDB comparison');
        }
      } else if (context.userLevel === 'expert') {
        suggestions.push('Choice-based reference selection strategies', 'Interpreting RMSD statistics grid');
        if (context.hasAlphaFoldStructure) {
          suggestions.push('Comparing ensemble dynamics vs static predictions');
        }
      } else {
        // Auto level
        suggestions.push('How do I toggle between reference structures?', 'What do the color schemes mean?');
        if (context.hasAlphaFoldStructure) {
          suggestions.push('Why does the visualization change colors?');
        }
      }
    } else if (context.activeTab === 'data') {
      // Export tab suggestions - Updated for new comparison and contact map exports
      if (context.userLevel === 'beginner') {
        suggestions.push('What files can I download?', 'How do I export comparison data?');
        if (context.hasAnalysisData) {
          suggestions.push('What is RMSD comparison data?');
        }
      } else if (context.userLevel === 'expert') {
        suggestions.push('Export RMSD comparison statistics', 'Contact map data format specifications');
        if (context.hasAnalysisData) {
          suggestions.push('Ensemble-averaged contact matrix export options');
        }
      } else {
        // Auto level
        suggestions.push('How do I download contact map data?', 'Export AlphaFold vs BioEmu comparison');
        if (context.hasAnalysisData) {
          suggestions.push('What file formats are available?');
        }
      }
    }
    
    // Current frame/state specific suggestions (contextual to user level)
    if (context.selectedFrame !== undefined && context.activeTab === 'landscape') {
      if (context.userLevel === 'beginner') {
        suggestions.push(`Why is this point highlighted?`);
      } else if (context.userLevel === 'expert') {
        suggestions.push(`How to analyze frame ${context.selectedFrame} conformation properties`);
      } else {
        suggestions.push(`Why is frame ${context.selectedFrame} here in PCA space?`);
      }
    }
    
    // Sequence-specific intelligent suggestions (level-appropriate)
    if (context.currentSequence) {
      const seq = context.currentSequence.toUpperCase();
      if (seq.length === 76 && seq.startsWith('MQIF')) {
        if (context.userLevel === 'beginner') {
          suggestions.push('Tell me about this protein');
        } else {
          suggestions.push('Is this ubiquitin? Tell me about it');
        }
      } else if (seq.length < 50) {
        if (context.userLevel === 'beginner') {
          suggestions.push('Is this a small protein?');
        } else {
          suggestions.push('Is this a peptide or small protein?');
        }
      } else if (seq.length > 300) {
        if (context.userLevel === 'beginner') {
          suggestions.push('How do big proteins work?');
        } else {
          suggestions.push('How do large proteins fold?');
        }
      }
      
      // Detect interesting sequence features (level-appropriate questions)
      if (seq.includes('CXXC') || (seq.match(/C/g) || []).length >= 4) {
        if (context.userLevel === 'beginner') {
          suggestions.push('Why are there many cysteines?');
        } else {
          suggestions.push('Does this protein have disulfide bonds?');
        }
      }
      if ((seq.match(/P/g) || []).length / seq.length > 0.05) {
        if (context.userLevel === 'beginner') {
          suggestions.push('Why so many prolines?');
        } else {
          suggestions.push('Why so many prolines? Flexibility effects?');
        }
      }
    }
    
    // Analysis state suggestions
    if (context.isAnalyzing) {
      if (context.userLevel === 'beginner') {
        suggestions.push('What is happening now?', 'How long will this take?');
      } else if (context.userLevel === 'expert') {
        suggestions.push('What computational methods are running?', 'Explain convergence criteria');
      } else {
        suggestions.push('What computations are running?', 'How long does analysis take?');
      }
    }
    
    // Smart contextual suggestions based on current data (level-appropriate)
    if (context.hasRMSDData && context.rmsdRange) {
      const range = context.rmsdRange.max - context.rmsdRange.min;
      if (range > 5) {
        if (context.userLevel === 'beginner') {
          suggestions.push('Why does the protein change so much?');
        } else {
          suggestions.push('Why such large structural changes?');
        }
      } else if (range < 1) {
        if (context.userLevel === 'beginner') {
          suggestions.push('Why doesn\'t the protein move much?');
        } else {
          suggestions.push('Why is this protein so rigid?');
        }
      }
    }
    
    // Fallback suggestions when no specific context (level-appropriate)
    if (suggestions.length === 0) {
      if (context.userLevel === 'beginner') {
        suggestions.push('What is BioEmu?', 'How do proteins work?', 'Show me an example');
      } else if (context.userLevel === 'expert') {
        suggestions.push('Technical platform overview', 'Methodological comparisons', 'Advanced analysis options');
      } else {
        suggestions.push('What can BioEmu tell me?', 'How do proteins move?', 'Start with an example');
      }
    }
    
    return suggestions.slice(0, 4); // Show max 4 suggestions for better UX
  };

  const quickSuggestions = getQuickSuggestions();

  return (
    <div className="flex flex-col h-full">
      {/* Enhanced Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-4 py-3 ${
              message.type === 'user'
                ? 'bg-blue-500 text-white'
                : message.isError
                ? isDarkMode ? 'bg-red-900/20 text-red-300 border border-red-800' : 'bg-red-50 text-red-700 border border-red-200'
                : isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'
            }`}>
              {/* Message icon for assistant */}
              {message.type === 'assistant' && !message.isError && (
                <div className={`flex items-center gap-2 mb-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span>🧬</span>
                  <span>BioEmu copilot experience</span>
                </div>
              )}
              
              <div 
                className="text-sm leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ 
                  __html: message.type === 'assistant' ? formatMessage(message.content) : message.content 
                }}
              />
              
              <div className={`text-xs mt-2 opacity-70 flex justify-between items-center ${
                message.type === 'user' ? 'text-blue-100' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <span>{formatTimestamp(message.timestamp)}</span>
                {message.type === 'assistant' && !message.isError && (
                  <span className="text-xs">
                    💡 Ask a follow-up question
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className={`rounded-lg px-3 py-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Thinking...
                </span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Persistent Quick Suggestions - Always visible */}
      {quickSuggestions.length > 0 && (
        <div className="px-4 pb-2">
          <div className={`text-xs font-medium mb-2 flex items-center gap-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <span>💡</span>
            <span>Try asking:</span>
            {context.activeTab && (
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                {getTabDisplayName(context.activeTab)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {quickSuggestions.map((suggestion, index) => (
              <button
                key={`${context.activeTab}-${index}-${suggestion.slice(0, 10)}`} // Include tab in key for re-rendering
                onClick={() => {
                  setInputMessage(suggestion);
                  inputRef.current?.focus();
                }}
                className={`px-3 py-1.5 rounded-full text-xs transition-all hover:scale-105 ${
                  isDarkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 border border-gray-300'
                }`}
                title="Click to use this question"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Input Area with Smart Features */}
      <div className={`p-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        {/* Smart typing hints */}
        {inputMessage.length > 4 && getTypingHints().length > 0 && (
          <div className={`mb-2 text-xs ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
            {getTypingHints()[0]}
          </div>
        )}
        
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                context.activeTab === 'landscape' 
                  ? "Ask about Analysis PCA plots, conformations, or frame analysis..."
                  : context.activeTab === 'visualization'
                  ? "Ask about Structure flexibility, RMSD, or analysis..."
                  : context.activeTab === 'input'
                  ? "Ask about Generate sequences, proteins, or getting started..."
                  : context.activeTab === 'data'
                  ? "Ask about Export downloads, files, or trajectory data..."
                  : context.activeTab === 'alphafold'
                  ? "Ask about Compare BioEmu vs AlphaFold structures..."
                  : "Ask the BioEmu copilot about proteins, platform features, or analysis..."
              }
              disabled={isLoading}
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            
            {/* Character counter for longer questions */}
            {inputMessage.length > 50 && (
              <div className={`absolute -top-5 right-0 text-xs ${
                inputMessage.length > 200 
                  ? 'text-orange-500' 
                  : isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {inputMessage.length}/300
              </div>
            )}
          </div>
          
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className={`px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 ${
              !inputMessage.trim() || isLoading
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
            title={!inputMessage.trim() ? 'Type a question first' : 'Send message (Enter)'}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        
        {/* Quick action buttons */}
        <div className="flex justify-between items-center mt-2">
          <div className="flex gap-2">
            <button
              onClick={() => setInputMessage('')}
              disabled={!inputMessage}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                inputMessage 
                  ? isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
              title="Clear input"
            >
              Clear
            </button>
            <button
              onClick={clearHistory}
              disabled={messages.length <= 1}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                messages.length > 1
                  ? isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
              title="Clear chat history"
            >
              Reset
            </button>
          </div>
          
          <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Press Enter to send • Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
};

export default CopilotChat;
