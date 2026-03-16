import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Terminal, Lightbulb, Table as TableIcon, BarChart3, Maximize2, Minimize2, Sparkles, CornerDownRight, ChevronUp, ChevronDown } from 'lucide-react';
import VegaChart from './VegaChart';

const TypingIndicator = () => {
  const [dots, setDots] = useState('.');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '.') return '..';
        if (prev === '..') return '...';
        return '.';
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="message bot has-content animate-fade-in mb-4">
      <div className="message-content">
        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-[14px] font-medium tracking-tight">Thinking {dots}</span>
        </div>
      </div>
    </div>
  );
};

const normalizeGrpcData = (data) => {
  if (!data || !Array.isArray(data)) return data;
  return data.map(item => {
    if (item.fields && Array.isArray(item.fields)) {
      const flat = {};
      item.fields.forEach(f => {
        if (f.key && f.value) {
          flat[f.key] = f.value.string_value ?? f.value.number_value ?? f.value.bool_value ?? f.value.null_value ?? '';
        }
      });
      return flat;
    }
    return item;
  });
};

const formatValue = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // Check if it's a numeric string (including scientific notation or long decimals)
  if (/^-?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (!isNaN(num)) {
      // Truncate decimals and format with commas
      return Math.floor(num).toLocaleString('en-US');
    }
  }
  return str;
};

const PremiumTable = ({ header, rows }) => {
  return (
    <div className="premium-table-container my-6 animate-fade-in group">
      <table className="premium-table">
        <thead>
          <tr>
            <th className="index-col">#</th>
            {header.map((col, i) => (
              <th key={i} className={i === header.length - 1 ? 'text-right' : ''}>
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td className="index-col">{i + 1}</td>
              {row.map((cell, j) => (
                <td key={j} className={j === row.length - 1 ? 'text-right font-medium' : ''}>
                  {formatValue(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const SuggestionButton = ({ suggestion, onClick, sidx }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={() => onClick(suggestion)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="message bot group flex items-center gap-3 !p-3 transition-all text-left animate-fade-in cursor-pointer shadow-sm"
      style={{
        animationDelay: `${sidx * 0.1}s`,
        width: 'fit-content',
        backgroundColor: isHovered ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.12)',
        borderColor: isHovered ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.08)',
        transform: isHovered ? 'translateY(-1px)' : 'none',
        boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)'
      }}
    >
      <CornerDownRight size={16} className={`${isHovered ? 'text-red-500' : 'text-gray-500'} transition-colors shrink-0`} />
      <span className={`text-[13.5px] ${isHovered ? 'text-white underline' : 'text-gray-300'} transition-colors`} style={{ paddingLeft: '4px' }}>
        {suggestion}
      </span>
    </button>
  );
};

const FormattedMessage = ({ text }) => {
  if (!text) return null;

  const parseBlocks = (content) => {
    if (!content) return [];
    const blocks = [];

    // Improved table detection: 
    // 1. Matches standard markdown pipe tables (row | row)
    // 2. Matches text-based tables with at least 2 columns separated by 3+ spaces or tabs, requiring 2+ rows
    const tableRegex = /((?:(?:^|\n)(?:\|.*\|)+(?:\r?\n|$)){2,}|(?:(?:^|\n)(?:[^\n]*?(?:\t|\s{3,})[^\n]*?(?=\n|$)){2,}))/g;

    let lastIndex = 0;
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
      // Add preceding text block
      if (match.index > lastIndex) {
        blocks.push({
          type: 'text',
          content: content.substring(lastIndex, match.index)
        });
      }

      const tableText = match[1].trim();
      const rows = tableText.split(/\n/).map(line => {
        const cleanLine = line.replace(/^>\s*/, '').trim();
        // Handle pipe-delimited tables
        if (cleanLine.includes('|')) {
          return cleanLine.split('|')
            .map(cell => cell.trim())
            .filter((cell, i, arr) => cell !== '' || (i > 0 && i < arr.length - 1));
        }
        // Handle space/tab delimited tables
        return cleanLine.split(/\s{3,}|\t/);
      }).filter(row => row.length > 0 && row.some(cell => cell !== ''));

      if (rows.length >= 2) {
        // Skip separator rows (|---|---|) if present
        const filteredRows = rows.filter(row => !row.every(cell => /^[ -:|]+$/.test(cell)));
        if (filteredRows.length >= 2) {
          blocks.push({
            type: 'table',
            header: filteredRows[0],
            rows: filteredRows.slice(1)
          });
        } else {
          blocks.push({ type: 'text', content: match[1] });
        }
      } else {
        // Not enough rows to be a table, treat as text
        blocks.push({ type: 'text', content: match[1] });
      }

      lastIndex = tableRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      blocks.push({
        type: 'text',
        content: content.substring(lastIndex)
      });
    }

    return blocks.length > 0 ? blocks : [{ type: 'text', content }];
  };

  const blocks = parseBlocks(Array.isArray(text) ? text.join('\n') : text);

  return (
    <div className="formatted-message-wrapper">
      {blocks.map((block, idx) => {
        if (block.type === 'table') {
          return <PremiumTable key={idx} header={block.header} rows={block.rows} />;
        }

        let html = '';
        if (window.marked && window.DOMPurify) {
          html = window.DOMPurify.sanitize(window.marked.parse(block.content, { breaks: true, gfm: true }));
        }

        return (
          <div
            key={idx}
            className="markdown-content text-[13.5px] leading-relaxed text-gray-200"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
};

const ChatPopup = ({ onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSql, setShowSql] = useState({});
  const [conversationName, setConversationName] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [normalSize, setNormalSize] = useState({ width: '900px', height: '975px' });
  const containerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const toggleMaximize = (e) => {
    if (e) e.stopPropagation();
    if (!isMaximized) {
      setIsMaximized(true);
    } else {
      setIsMaximized(false);
    }
  };

  const startResizing = (direction) => (e) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = parseInt(normalSize.width);
    const startHeight = parseInt(normalSize.height);

    const onMouseMove = (moveEvent) => {
      let newWidth = startWidth;
      let newHeight = startHeight;

      if (direction.includes('left')) {
        newWidth = startWidth + (startX - moveEvent.clientX);
      }
      if (direction.includes('top')) {
        newHeight = startHeight + (startY - moveEvent.clientY);
      }

      setNormalSize({
        width: `${Math.max(300, newWidth)}px`,
        height: `${Math.max(400, newHeight)}px`
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const conversationNameRef = useRef(null);

  // Sync conversation name to ref for cleanup closure
  useEffect(() => {
    conversationNameRef.current = conversationName;
  }, [conversationName]);

  useEffect(() => {
    // Create/Get conversation on mount
    const initChat = async () => {
      try {
        const staticId = "lg-sales-revenue";
        const response = await fetch(`http://localhost:8000/api/chat/conversation/create?conversation_id=${staticId}`, {
          method: 'POST'
        });
        const data = await response.json();
        if (data.conversation_name) {
          setConversationName(data.conversation_name);
        }
      } catch (err) {
        console.error("Failed to initialize conversation:", err);
      }
    };
    initChat();
  }, []);

  const handleClose = () => {
    if (onClose) onClose();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const toggleSql = (id) => {
    setShowSql(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSend = async (overrideValue) => {
    const messageText = overrideValue || input;
    if (!messageText.trim() || isLoading) return;

    // Check if messageText is a suggestion (for logging/debugging if needed)
    const activeInput = messageText.trim();

    const userMsg = { userMessage: { text: activeInput } };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          conversation: conversationName
        }),
      });

      if (!response.ok) throw new Error('Failed to connect to assistant');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let lastFullResponse = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            try {
              const data = JSON.parse(line.trim().slice(6));
              if (data.error) {
                setMessages(prev => [...prev, { systemMessage: { text: `Error: ${data.error}` } }]);
                continue;
              }

              setMessages(prev => {
                const current = [...prev];
                const lastIdx = current.length - 1;

                // Helper to extract text from the API's complex structure
                const getNormalizedText = (chunk) => {
                  if (chunk.systemMessage?.text?.parts) {
                    return chunk.systemMessage.text.parts.join('\n');
                  }
                  return '';
                };

                const textType = data.systemMessage?.text?.textType;
                const partsText = getNormalizedText(data);

                // If the last message is from the user, initialize the first bot response message
                if (current[lastIdx]?.userMessage) {
                  const initialMsg = {
                    systemMessage: {
                      text: textType === 'FINAL_RESPONSE' ? partsText : '',
                      steps: [],
                      insight: data.systemMessage?.insight,
                      chart: data.systemMessage?.chart
                    },
                    thinking: textType === 'THOUGHT' ? partsText : '',
                    suggestions: !textType ? data.systemMessage?.text?.parts : []
                  };

                  // Handle data in the first chunk if present
                  if (data.systemMessage?.data) {
                    initialMsg.systemMessage.steps.push({
                      sql: data.systemMessage.data.generatedSql,
                      result: data.systemMessage.data.result
                    });
                  }

                  return [...current, initialMsg];
                }

                // Otherwise, merge the new data into the existing bot message
                const updatedMsg = { ...current[lastIdx] };
                if (data.systemMessage) {
                  if (!updatedMsg.systemMessage) {
                    updatedMsg.systemMessage = { text: '', steps: [] };
                  }

                  // 1. Text/Thought/Suggestion handling
                  if (textType === 'FINAL_RESPONSE') {
                    if (!updatedMsg.systemMessage.text.includes(partsText)) {
                      updatedMsg.systemMessage.text = (updatedMsg.systemMessage.text ? updatedMsg.systemMessage.text + '\n' : '') + partsText;
                    }
                    updatedMsg.suggestions = []; // Clear suggestions if final response starts coming
                  } else if (textType === 'THOUGHT') {
                    updatedMsg.thinking = partsText;
                  } else if (!textType && data.systemMessage.text?.parts) {
                    // Collect unique suggestions
                    const newSuggestions = data.systemMessage.text.parts;
                    updatedMsg.suggestions = Array.from(new Set([...(updatedMsg.suggestions || []), ...newSuggestions]));
                  }

                  // 2. Data handling (SQL, Results)
                  if (data.systemMessage.data) {
                    if (!updatedMsg.systemMessage.steps) updatedMsg.systemMessage.steps = [];
                    let step = updatedMsg.systemMessage.steps[0] || {};

                    if (data.systemMessage.data.generatedSql) step.sql = data.systemMessage.data.generatedSql;
                    if (data.systemMessage.data.result) step.result = data.systemMessage.data.result;

                    if (updatedMsg.systemMessage.steps.length === 0) {
                      updatedMsg.systemMessage.steps.push(step);
                    } else {
                      updatedMsg.systemMessage.steps[0] = step;
                    }
                  }

                  // 3. Insight & Chart
                  if (data.systemMessage.insight) updatedMsg.systemMessage.insight = data.systemMessage.insight;
                  if (data.systemMessage.chart) updatedMsg.systemMessage.chart = data.systemMessage.chart;
                }

                current[lastIdx] = updatedMsg;
                return current;
              });
            } catch (e) {
              console.error("Error parsing stream chunk", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { systemMessage: { text: `Error: ${error.message}` } }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderDataResult = (result) => {
    // Handling both list of dicts and the specific result format from geminidataanalytics
    let rows = result.rows || result.data || [];

    // Normalize gRPC-to-JSON if needed
    if (rows.length > 0 && rows[0].fields) {
      rows = normalizeGrpcData(rows);
    }

    if (!rows || rows.length === 0) return null;

    const columns = Object.keys(rows[0]);
    const rowData = rows.map(row => columns.map(col => String(row[col] ?? '')));

    return (
      <PremiumTable
        header={columns}
        rows={rowData}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      className={`chat-popup flex flex-col overflow-hidden shadow-2xl transition-all duration-300 ease-in-out border border-white/10 ${isMaximized ? 'rounded-lg' : 'rounded-[24px]'}`}
      style={{
        position: 'fixed',
        zIndex: 1000,
        backgroundColor: '#0f1115',

        // Maximize logic
        ...(isMaximized ? {
          top: '20px',
          left: '20px',
          right: '20px',
          bottom: '20px',
          width: 'calc(100% - 40px)',
          height: 'calc(100% - 40px)',
        } : {
          bottom: '100px',
          right: '24px',
          width: normalSize.width,
          height: normalSize.height,
          minWidth: '400px',
          minHeight: '500px',
        })
      }}
    >
      <style>{`
        .markdown-content h1, .markdown-content h2, .markdown-content h3 {
          color: white;
          font-weight: 700;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          line-height: 1.2;
        }
        .markdown-content h1 { font-size: 1.2rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.3rem; }
        .markdown-content h2 { font-size: 1.1rem; }
        .markdown-content h3 { font-size: 1rem; }
        .markdown-content p { margin-bottom: 0.6rem; }
        .markdown-content ul, .markdown-content ol {
          margin-left: 1.2rem;
          margin-bottom: 0.6rem;
          list-style-type: disc;
        }
        .markdown-content li { margin-bottom: 0.2rem; }
        .markdown-content code {
          background: rgba(255, 255, 255, 0.1);
          padding: 0.1rem 0.3rem;
          border-radius: 0.25rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 0.85em;
          color: #fca5a5;
        }
        .markdown-content pre {
          background: rgba(0, 0, 0, 0.2);
          padding: 0.6rem;
          border-radius: 0.4rem;
          overflow-x: auto;
          margin-bottom: 0.6rem;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .markdown-content pre code {
          background: transparent;
          padding: 0;
          color: #d1d5db;
          font-size: 0.8rem;
        }
        .markdown-content blockquote {
          border-left: 3px solid rgba(255,255,255,0.2);
          padding-left: 0.8rem;
          color: rgba(255,255,255,0.6);
          font-style: italic;
          margin-bottom: 0.6rem;
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }

        @keyframes typing-pulse {
          0%, 100% { transform: scale(0.7); opacity: 0.3; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }

        .animate-typing-pulse {
          animation: typing-pulse 1s infinite ease-in-out;
        }
      `}</style>
      <div
        className="chat-header cursor-pointer select-none active:bg-white/5 flex items-center justify-between"
        onDoubleClick={toggleMaximize}
        title="Double click to maximize/restore"
      >
        <div className="flex items-center gap-4">
          <MessageSquare size={20} className="text-red-500" />
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight" style={{ paddingLeft: '6px' }}>  Data Analytics Agent</span>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: '6px' }}>
          <button
            onClick={toggleMaximize}
            className="p-1.5 hover:bg-[#ffffff10] rounded-full transition-colors text-gray-400 hover:text-white"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button onClick={handleClose} className="p-1.5 hover:bg-[#ffffff10] rounded-full transition-colors text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-5 opacity-40">
            <div className="p-5 bg-[#ffffff05] rounded-3xl border border-[#ffffff05]">
              <MessageSquare size={36} className="text-gray-400" />
            </div>
            <div>
              <p className="text-[11px] mt-1 text-gray-400">Ask about revenue, growth, customers or projects.</p>
            </div>
          </div>
        )}
        {messages.map((msg, idx) => {
          const hasBotContent = msg.systemMessage && (
            msg.systemMessage.text ||
            (msg.systemMessage.steps && msg.systemMessage.steps.length > 0) ||
            msg.systemMessage.insight ||
            msg.systemMessage.chart
          );

          if (!msg.userMessage && !hasBotContent) return null;

          return (
            <React.Fragment key={idx}>
              <div className={`message ${msg.userMessage ? 'user' : 'bot'} ${!msg.userMessage && msg.systemMessage?.text ? 'has-content' : ''}`}>
                <div className="message-content">
                  {msg.userMessage && <div className="text-[14px]">{msg.userMessage.text}</div>}
                  {msg.systemMessage && (
                    <>
                      {msg.systemMessage.text && <FormattedMessage text={msg.systemMessage.text} />}

                      {/* SQL Steps */}
                      {(msg.systemMessage.steps || []).map((step, sIdx) => (
                        <div key={sIdx} className="space-y-2">
                          {step.sql && (
                            <div className="sql-section">
                              <div className="sql-toggle" onClick={() => toggleSql(`${idx}-${sIdx}`)}>
                                <Terminal size={12} />
                                <span>{showSql[`${idx}-${sIdx}`] ? 'Hide SQL' : 'Show SQL Query'}</span>
                              </div>
                              {showSql[`${idx}-${sIdx}`] && (
                                <div className="sql-block">
                                  {step.sql}
                                </div>
                              )}
                            </div>
                          )}

                          {/* SQL Execution Result */}
                          {step.result && renderDataResult(step.result)}
                        </div>
                      ))}

                      {/* Insight Section */}
                      {msg.systemMessage.insight && (
                        <div className="insight-section">
                          <div className="flex items-center gap-1.5 mb-1.5 font-bold text-[#60a5fa]">
                            <Lightbulb size={14} />
                            <span className="uppercase text-[10px] tracking-wider">AI Insight</span>
                          </div>
                          <div className="text-[13px] leading-relaxed text-[#93c5fd]">{msg.systemMessage.insight}</div>
                        </div>
                      )}

                      {/* Chart Section */}
                      {msg.systemMessage.chart?.result?.vega_config && (
                        <VegaChart
                          spec={msg.systemMessage.chart.result.vega_config}
                          title={msg.systemMessage.chart.query || msg.systemMessage.chart.text || "Revenue Analysis"}
                        />
                      )}
                      {msg.systemMessage.chart?.result?.vegaConfig && (
                        <VegaChart
                          spec={msg.systemMessage.chart.result.vegaConfig}
                          title={msg.systemMessage.chart.query || msg.systemMessage.chart.text || "Revenue Analysis"}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Individual Bot-Styled Suggestion Bubbles */}
              {!msg.userMessage && msg.suggestions && msg.suggestions.length > 0 && (
                <div className="flex flex-col mb-4 self-start max-w-[95%]" style={{ gap: '8px' }}>
                  {msg.suggestions.map((suggestion, sidx) => (
                    <SuggestionButton
                      key={sidx}
                      suggestion={suggestion}
                      onClick={handleSend}
                      sidx={sidx}
                    />
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
        {isLoading && (
          !messages.length ||
          messages[messages.length - 1].userMessage ||
          (!messages[messages.length - 1].systemMessage?.text &&
            (!messages[messages.length - 1].systemMessage?.steps?.length ||
              !messages[messages.length - 1].systemMessage?.steps.some(s => s.result)) &&
            !messages[messages.length - 1].systemMessage?.insight)
        ) && (
            <TypingIndicator />
          )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          className="chat-input"
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              handleSend();
            }
          }}
          autoFocus
        />
        <button
          className="send-button"
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
        >
          <Send size={18} />
        </button>
      </div>

      {/* Border Resize Zones */}
      {!isMaximized && (
        <>
          {/* Top Border */}
          <div
            className="absolute top-0 left-4 right-4 h-1.5 cursor-ns-resize hover:bg-white/10 z-[1001] transition-colors"
            onMouseDown={startResizing('top')}
          />
          {/* Left Border */}
          <div
            className="absolute left-0 top-4 bottom-4 w-1.5 cursor-ew-resize hover:bg-white/10 z-[1001] transition-colors"
            onMouseDown={startResizing('left')}
          />
          {/* Top-Left Corner */}
          <div
            className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize flex items-center justify-center group z-[1002] hover:bg-white/20 rounded-br-lg transition-colors"
            onMouseDown={startResizing('top-left')}
          >
            <div className="w-1.5 h-1.5 border-t border-l border-white/30 group-hover:border-white/60 transition-colors" />
          </div>
        </>
      )}
    </div>
  );
};

export default ChatPopup;
