import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Groq } from 'groq-sdk';
import { createClient } from '@deepgram/sdk';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer for audio uploads
const upload = multer({ storage: multer.memoryStorage() });

// API Keys
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

// Initialize Clients
const groq = new Groq({ apiKey: GROQ_API_KEY });
// Deepgram client initialization
let deepgram: any;
if (DEEPGRAM_API_KEY) {
  deepgram = createClient(DEEPGRAM_API_KEY);
}

// --- Routes ---

// 1. Speech to Text (Deepgram)
app.post('/api/stt', upload.single('audio'), async (req, res) => {
  if (!DEEPGRAM_API_KEY) {
    return res.status(500).json({ error: 'DEEPGRAM_API_KEY not configured' });
  }
  const file = (req as any).file;
  if (!file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  try {
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      file.buffer,
      {
        model: 'flux-general-en',
        smart_format: true,
      }
    );

    if (error) throw error;
    res.json({ text: result.results.channels[0].alternatives[0].transcript });
  } catch (error: any) {
    console.error('Deepgram STT Error:', error);
    res.status(500).json({ error: error.message || 'STT failed' });
  }
});

// 2. Research (Tavily)
app.post('/api/research', async (req, res) => {
  if (!TAVILY_API_KEY) {
    return res.status(500).json({ error: 'TAVILY_API_KEY not configured' });
  }
  const { query, type = 'search', options = {} } = req.body;

  try {
    let response;
    if (type === 'extract') {
      // Extract content from URLs
      // options should contain { urls: string[] }
      response = await axios.post('https://api.tavily.com/extract', {
        api_key: TAVILY_API_KEY,
        urls: options.urls,
      });
    } else if (type === 'crawl') {
      // Crawl a URL
      // options should contain { url: string }
      // Note: This might be an async operation in some APIs, but assuming sync based on user prompt
      response = await axios.post('https://api.tavily.com/crawl', {
        api_key: TAVILY_API_KEY,
        url: options.url,
        extract_depth: options.extract_depth || "advanced",
      });
    } else {
      // Default: Search
      response = await axios.post('https://api.tavily.com/search', {
        api_key: TAVILY_API_KEY,
        query,
        search_depth: options.search_depth || "advanced",
        include_answer: true,
        max_results: 5,
        ...options
      });
    }
    res.json(response.data);
  } catch (error: any) {
    console.error('Tavily Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message || 'Research failed', details: error.response?.data });
  }
});

// 3. Chat (Groq)
app.post('/api/chat', async (req, res) => {
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }
  const { messages, config = {} } = req.body;
  if (!messages) return res.status(400).json({ error: 'Messages required' });

  try {
    const completion = await groq.chat.completions.create({
      messages,
      model: config.model || "llama-3.3-70b-versatile",
      temperature: config.temperature ?? 1,
      max_completion_tokens: config.max_completion_tokens || 1024,
      top_p: config.top_p ?? 1,
      stream: false 
    });

    res.json({ 
      content: completion.choices[0]?.message?.content || "",
      usage: completion.usage,
      model: completion.model
    });
  } catch (error: any) {
    console.error('Groq Chat Error:', error);
    res.status(500).json({ error: error.message || 'Chat failed' });
  }
});

// Vite Middleware (Must be last)
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  // Serve static files in production
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
