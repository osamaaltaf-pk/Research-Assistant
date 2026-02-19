import React from 'react';
import { Settings, Sliders, Globe, Mic2, Upload } from 'lucide-react';
import { motion } from 'motion/react';

interface SettingsPanelProps {
  llmConfig: any;
  setLlmConfig: (config: any) => void;
  tavilyConfig: any;
  setTavilyConfig: (config: any) => void;
  ttsConfig: any;
  setTtsConfig: (config: any) => void;
  voices: string[];
  onUploadVoice: (file: File) => void;
}

export default function SettingsPanel({
  llmConfig,
  setLlmConfig,
  tavilyConfig,
  setTavilyConfig,
  ttsConfig,
  setTtsConfig,
  voices,
  onUploadVoice
}: SettingsPanelProps) {
  return (
    <div className="w-80 bg-white border-l border-slate-200 p-4 overflow-y-auto h-full shadow-xl z-20">
      <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <Settings className="w-5 h-5" /> Configuration
      </h2>

      {/* LLM Settings */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Sliders className="w-4 h-4" /> LLM Parameters
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Model</label>
            <select 
              value={llmConfig.model}
              onChange={(e) => setLlmConfig({ ...llmConfig, model: e.target.value })}
              className="w-full text-sm border-slate-200 rounded-md p-2 bg-slate-50"
            >
              <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
              <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
              <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Temperature ({llmConfig.temperature})</label>
            <input 
              type="range" min="0" max="2" step="0.1"
              value={llmConfig.temperature}
              onChange={(e) => setLlmConfig({ ...llmConfig, temperature: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Max Tokens</label>
            <input 
              type="number"
              value={llmConfig.max_completion_tokens}
              onChange={(e) => setLlmConfig({ ...llmConfig, max_completion_tokens: parseInt(e.target.value) })}
              className="w-full text-sm border-slate-200 rounded-md p-2 bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Top P ({llmConfig.top_p})</label>
            <input 
              type="range" min="0" max="1" step="0.05"
              value={llmConfig.top_p}
              onChange={(e) => setLlmConfig({ ...llmConfig, top_p: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>
        </div>
      </section>

      {/* Tavily Settings */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4" /> Research Method
        </h3>
        <div className="space-y-4">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
            {['search', 'extract', 'crawl'].map((type) => (
              <button
                key={type}
                onClick={() => setTavilyConfig({ ...tavilyConfig, type })}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
                  tavilyConfig.type === type 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          
          {tavilyConfig.type === 'search' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Search Depth</label>
              <select 
                value={tavilyConfig.options.search_depth}
                onChange={(e) => setTavilyConfig({ ...tavilyConfig, options: { ...tavilyConfig.options, search_depth: e.target.value } })}
                className="w-full text-sm border-slate-200 rounded-md p-2 bg-slate-50"
              >
                <option value="basic">Basic</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          )}
        </div>
      </section>

      {/* TTS Settings */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Mic2 className="w-4 h-4" /> Voice Settings
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Voice</label>
            <select 
              value={ttsConfig.voice}
              onChange={(e) => setTtsConfig({ ...ttsConfig, voice: e.target.value })}
              className="w-full text-sm border-slate-200 rounded-md p-2 bg-slate-50"
            >
              {voices.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Upload Custom Voice</label>
            <div className="flex items-center gap-2">
              <label className="flex-1 cursor-pointer bg-slate-50 border border-dashed border-slate-300 rounded-lg p-3 text-center hover:bg-slate-100 transition-colors">
                <input 
                  type="file" 
                  accept=".wav,.mp3" 
                  className="hidden" 
                  onChange={(e) => e.target.files?.[0] && onUploadVoice(e.target.files[0])}
                />
                <div className="flex flex-col items-center gap-1">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500">Choose file...</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
