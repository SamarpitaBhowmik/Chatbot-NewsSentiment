// server.ts

import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import cors from 'cors';
import path from 'path';
import { Groq } from 'groq-sdk';
import fs from 'fs';
import tesseract from 'tesseract.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Configure Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY as string
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Define file interface for type checking
interface FileWithOriginalname extends Express.Multer.File {
  originalname: string;
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    cb(null, 'uploads/');
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // Increased to 25MB for audio files
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp3|wav|ogg|mpeg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image and audio files are allowed!'));
    }
  }
});

// Ensure uploads folder exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// File type checkers
const isImage = (file: FileWithOriginalname): boolean =>
    /jpeg|jpg|png|gif/.test(path.extname(file.originalname).toLowerCase());

const isAudio = (file: FileWithOriginalname): boolean =>
    /mp3|wav|ogg|mpeg/.test(path.extname(file.originalname).toLowerCase());

// Transcribe audio using Groq
async function transcribeAudio(audioPath: string): Promise<string> {
  try {
    const audioFile = fs.createReadStream(audioPath);
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3-turbo"
    });
    return transcription.text;
  } catch (error) {
    console.error("Audio transcription error:", error);
    return "Error transcribing audio";
  }
}

// Extract text from image using OCR (Tesseract.js)
async function extractTextFromImage(imagePath: string): Promise<string> {
  try {
    const result = await tesseract.recognize(imagePath, 'eng', {
      logger: (m) => console.log(m),
    });
    return result.data.text;
  } catch (error) {
    console.error("Image OCR error:", error);
    return "Error extracting text from image";
  }
}

// Define interfaces for analysis results
interface AnalysisResult {
  language?: string;
  summary?: string;
  sentiment?: string;
  mood?: string;
  bias_level?: string;
  bias_direction?: string;
  subjectivity?: string;
  indicators?: string[];
  reasoning?: string;
  error?: string;
  details?: string;
}

// Analyze news/text content using Groq
async function analyzeNewsWithGroq(content: string): Promise<AnalysisResult> {
  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a multilingual media analysis expert. Analyze the provided content and return a JSON object with:
          - language
          - summary
          - sentiment
          - mood
          - bias_level
          - bias_direction
          - subjectivity
          - indicators
          - reasoning`
        },
        {
          role: "user",
          content: content
        }
      ],
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content) as AnalysisResult;
  } catch (error: any) {
    console.error("Groq analysis error:", error);
    return {
      error: "Analysis failed",
      details: error.message
    };
  }
}

// Define interface for response data
interface AnalysisResponse {
  fileType: string;
  extractedText: string;
  analysis: AnalysisResult;
  fileUrl: string;
}

// API endpoint
app.post('/api/analyze', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    let text = '';
    let fileType = 'unknown';

    try {
      if (isImage(req.file as FileWithOriginalname)) {
        // Extract text from image using OCR
        text = await extractTextFromImage(filePath);
        fileType = 'image';
      } else if (isAudio(req.file as FileWithOriginalname)) {
        text = await transcribeAudio(filePath);
        fileType = 'audio';
      }
    } catch (err: any) {
      console.error("Processing error:", err);
      return res.status(500).json({ error: 'Error processing file', details: err.message });
    }

    const analysis = await analyzeNewsWithGroq(text);

    const responseData: AnalysisResponse = {
      fileType,
      extractedText: text,
      analysis,
      fileUrl: `/uploads/${path.basename(filePath)}`
    };

    res.json(responseData);

  } catch (error: any) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});