import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, Loader2, Volume2, Search, Brain, AlertCircle, Settings as SettingsIcon, X, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { api } from '../services/api';
import SettingsPanel from './SettingsPanel';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: any[];
  metadata?: {
    llm?: any;
    tavily?: any;
    tts?: any;
  };
}

export default function ResearchAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing' | 'researching' | 'thinking' | 'speaking'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Config State
  const [llmConfig, setLlmConfig] = useState({
    model: 'llama-3.3-70b-versatile',
    temperature: 1,
    max_completion_tokens: 1024,
    top_p: 1
  });
  const [tavilyConfig, setTavilyConfig] = useState({
    type: 'search', // search, extract, crawl
    options: { search_depth: 'advanced' }
  });
  const [ttsConfig, setTtsConfig] = useState({
    voice: 'alba'
  });
  const [voices, setVoices] = useState<string[]>(['alba']);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch voices on mount
    api.getVoices().then(data => {
      if (data.voices) setVoices(data.voices);
    });
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, status]);

  const handleMicClick = async () => {
    if (isRecording) {
      setStatus('transcribing');
      const audioBlob = await stopRecording();
      try {
        const text = await api.transcribeAudio(audioBlob);
        setInputText(text);
        setStatus('idle');
      } catch (err) {
        console.error(err);
        setError('Failed to transcribe audio.');
        setStatus('idle');
      }
    } else {
      setError(null);
      await startRecording();
      setStatus('recording');
    }
  };

  const handleUploadVoice = async (file: File) => {
    try {
      await api.uploadVoice(file);
      // Refresh voices
      const data = await api.getVoices();
      if (data.voices) setVoices(data.voices);
      alert('Voice uploaded successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to upload voice.');
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = { role: 'user', content: inputText };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setError(null);

    try {
      let context = '';
      let researchData: any = null;

      // 1. Research (if applicable)
      // For extract/crawl, we expect the input to be a URL or list of URLs
      setStatus('researching');
      
      let tavilyPayload: any = { ...tavilyConfig.options };
      if (tavilyConfig.type === 'extract') {
        // Assume input is comma separated URLs
        tavilyPayload.urls = inputText.split(',').map(u => u.trim());
      } else if (tavilyConfig.type === 'crawl') {
        tavilyPayload.url = inputText.trim();
      }

      researchData = await api.searchTavily(inputText, tavilyConfig.type as any, tavilyPayload);
      
      if (tavilyConfig.type === 'search') {
        context = researchData.results?.map((r: any) => `[${r.title}](${r.url}): ${r.content}`).join('\n\n') || '';
      } else if (tavilyConfig.type === 'extract') {
         context = JSON.stringify(researchData.results, null, 2);
      } else if (tavilyConfig.type === 'crawl') {
         context = JSON.stringify(researchData, null, 2);
      }

      // 2. Chat with Context
      setStatus('thinking');
      const systemPrompt = `You are a helpful research assistant. 
      Research Method Used: ${tavilyConfig.type.toUpperCase()}
      
      Context:
      ${context.substring(0, 20000)} // Limit context size
      
      Use the context above to answer the user's request.`;

      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage.content }
      ];

      const llmResponse = await api.chatGroq(chatMessages, llmConfig);
      
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: llmResponse.content,
        sources: researchData?.results || [],
        metadata: {
          llm: { ...llmConfig, usage: llmResponse.usage, model: llmResponse.model },
          tavily: { type: tavilyConfig.type, ...researchData },
          tts: { voice: ttsConfig.voice }
        }
      };
      setMessages(prev => [...prev, assistantMessage]);

      // 3. TTS
      setStatus('speaking');
      try {
        const audioBlob = await api.generateSpeech(llmResponse.content, ttsConfig.voice);
        const audioUrl = URL.createObjectURL(audioBlob);
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
          audioRef.current.onended = () => setStatus('idle');
        }
      } catch (ttsErr) {
        console.warn("TTS Failed", ttsErr);
        setError("TTS server unreachable (127.0.0.1:8000). Displaying text only.");
        setStatus('idle');
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred.');
      setStatus('idle');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-semibold tracking-tight">Research Assistant</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs font-mono text-slate-400 hidden sm:block">
              {llmConfig.model} • {tavilyConfig.type} • {ttsConfig.voice}
            </div>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-600'}`}
            >
              {showSettings ? <X className="w-5 h-5" /> : <SettingsIcon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
              <Search className="w-12 h-12 opacity-20" />
              <p>Ask me anything to start researching...</p>
              <div className="text-xs bg-slate-100 p-2 rounded text-slate-500">
                Tip: Use "Extract" or "Crawl" modes for specific URLs
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-white border border-slate-200 rounded-bl-none'
              }`}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                
                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Sources</p>
                    <div className="space-y-1">
                      {msg.sources.slice(0, 3).map((source: any, i: number) => (
                        <a 
                          key={i} 
                          href={source.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block text-xs text-indigo-500 hover:underline truncate"
                        >
                          {i + 1}. {source.title || source.url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata / Debug Info */}
              {msg.metadata && (
                <div className="mt-2 max-w-[85%] w-full">
                  <details className="group">
                    <summary className="flex items-center gap-2 text-[10px] text-slate-400 cursor-pointer hover:text-slate-600 select-none">
                      <div className="h-px bg-slate-200 flex-1"></div>
                      <span>Debug Info</span>
                      <ChevronDown className="w-3 h-3 group-open:hidden" />
                      <ChevronUp className="w-3 h-3 hidden group-open:block" />
                      <div className="h-px bg-slate-200 flex-1"></div>
                    </summary>
                    <div className="mt-2 p-3 bg-slate-100 rounded-lg text-[10px] font-mono text-slate-600 overflow-x-auto">
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <span className="font-bold text-indigo-600">LLM:</span> {msg.metadata.llm.model} | {msg.metadata.llm.usage?.total_tokens} tokens
                        </div>
                        <div>
                          <span className="font-bold text-green-600">Tavily:</span> {msg.metadata.tavily.type}
                        </div>
                        <div>
                          <span className="font-bold text-orange-600">TTS:</span> {msg.metadata.tts.voice}
                        </div>
                        <div className="opacity-50">
                          {JSON.stringify(msg.metadata, null, 2)}
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </motion.div>
          ))}

          {/* Status Indicator */}
          <AnimatePresence>
            {status !== 'idle' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-slate-500 text-sm justify-center py-2"
              >
                {status === 'recording' && <span className="animate-pulse text-red-500 font-medium">● Recording...</span>}
                {status === 'transcribing' && <><Loader2 className="w-4 h-4 animate-spin" /> Transcribing audio...</>}
                {status === 'researching' && <><Search className="w-4 h-4 animate-bounce" /> Researching ({tavilyConfig.type})...</>}
                {status === 'thinking' && <><Brain className="w-4 h-4 animate-pulse" /> Analyzing results...</>}
                {status === 'speaking' && <><Volume2 className="w-4 h-4 animate-pulse text-indigo-500" /> Speaking...</>}
              </motion.div>
            )}
          </AnimatePresence>
          
          {error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm justify-center"
            >
              <AlertCircle className="w-4 h-4" />
              {error}
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </main>

        {/* Input Area */}
        <footer className="bg-white border-t border-slate-200 p-4">
          <div className="max-w-4xl mx-auto flex gap-2 items-end">
            <button
              onClick={handleMicClick}
              className={`p-3 rounded-full transition-all duration-200 ${
                isRecording 
                  ? 'bg-red-100 text-red-600 hover:bg-red-200 ring-2 ring-red-500 ring-offset-2' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title={isRecording ? "Stop Recording" : "Start Recording"}
            >
              {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
            </button>

            <div className="flex-1 relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  tavilyConfig.type === 'search' ? "Ask a research question..." :
                  tavilyConfig.type === 'extract' ? "Enter URLs separated by commas..." :
                  "Enter a URL to crawl..."
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none max-h-32 min-h-[50px]"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || status !== 'idle'}
                className="absolute right-2 bottom-2 p-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </footer>

        {/* Hidden Audio Element */}
        <audio ref={audioRef} className="hidden" />
      </div>

      {/* Settings Panel Sidebar */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute right-0 top-0 bottom-0 h-full z-20"
          >
            <SettingsPanel 
              llmConfig={llmConfig}
              setLlmConfig={setLlmConfig}
              tavilyConfig={tavilyConfig}
              setTavilyConfig={setTavilyConfig}
              ttsConfig={ttsConfig}
              setTtsConfig={setTtsConfig}
              voices={voices}
              onUploadVoice={handleUploadVoice}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
