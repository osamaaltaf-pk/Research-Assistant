import axios from 'axios';

const API_BASE = '/api';
const TTS_API = 'http://localhost:8000/api';
const TTS_WS = 'ws://localhost:8000/ws/stream';

export const api = {
  async transcribeAudio(audioBlob: Blob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    const response = await axios.post(`${API_BASE}/stt`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.text;
  },

  async searchTavily(query: string, type: 'search' | 'extract' | 'crawl' = 'search', options: any = {}) {
    const response = await axios.post(`${API_BASE}/research`, { query, type, options });
    return response.data;
  },

  async chatGroq(messages: { role: string; content: string }[], config: any = {}) {
    const response = await axios.post(`${API_BASE}/chat`, { messages, config });
    return response.data;
  },

  async getVoices() {
    try {
      const response = await axios.get(`${TTS_API}/voices`);
      return response.data;
    } catch (error) {
      console.warn("Failed to fetch voices:", error);
      return { voices: ['alba', 'marius', 'javert', 'jean', 'fantine', 'cosette', 'eponine', 'azelma'] }; // Fallback
    }
  },

  async uploadVoice(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${TTS_API}/upload-voice`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  async generateSpeech(text: string, voice: string = 'alba') {
    try {
      const response = await axios.post(
        `${TTS_API}/generate`,
        new URLSearchParams({ text, voice }), 
        { responseType: 'blob' }
      );
      return response.data;
    } catch (error) {
      console.error("TTS Error (Is local server running?):", error);
      throw error;
    }
  },

  // WebSocket Streaming helper
  streamSpeech(text: string, voice: string, onAudioChunk: (blob: Blob) => void, onComplete?: () => void, onError?: (err: any) => void) {
    const ws = new WebSocket(TTS_WS);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      ws.send(JSON.stringify({ text, voice }));
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const blob = new Blob([event.data], { type: 'audio/wav' });
        onAudioChunk(blob);
      }
    };

    ws.onclose = () => {
      if (onComplete) onComplete();
    };

    ws.onerror = (error) => {
      console.error("TTS WebSocket Error:", error);
      if (onError) onError(error);
    };

    return ws;
  }
};
