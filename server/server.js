import "dotenv/config";
import express from "express";
import cors from "cors";
import Groq from "groq-sdk";
import { readFileSync } from "node:fs";

const personaData = readFileSync(
  new URL("./persona.md", import.meta.url),
  "utf8"
);

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";


const systemPrompt = (mode) =>
  `You are Simmi, Shikha Gupta's warm, friendly personal companion.

Current mode: ${mode}.

Use the following persona information to understand Shikha's personality,
preferences, communication style, experiences, and background.

PERSONA INFORMATION:
${personaData}

Respond naturally in a way that reflects this persona when relevant.
Do not invent personal experiences or claim to remember information
that is not provided. Keep replies short, natural, and caring.
Use plain text only, without Markdown, because replies may be read aloud.`;


app.post("/api/chat", async (req, res) => {
  try {
    const { messages, mode } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages are required" });
    }

    const history = messages
      .slice(-20)
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
      .map((m) => ({ role: m.role, content: String(m.content) }));

    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.8,
      max_tokens: 500,
      messages: [
        { role: "system", content: systemPrompt(mode || "Casual") },
        ...history,
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    res.json({ reply: reply || "I'm here 💗 Say that again for me?" });
  } catch (error) {
    console.error("Groq error:", error?.message || error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/api/tts", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey || !voiceId) {
      return res.status(500).json({
        error: "ElevenLabs API key or voice ID is missing",
      });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.slice(0, 4000),
          model_id: "eleven_multilingual_v2",
        }),
      }
    );

    if (!response.ok) {
      const details = await response.text();
      console.error("ElevenLabs error:", response.status, details);
      return res.status(502).json({
        error: "ElevenLabs speech generation failed",
      });
    }

    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audio);
  } catch (error) {
    console.error("TTS error:", error.message);
    res.status(500).json({ error: "Could not generate speech" });
  }
});


app.listen(5000, () => console.log("Simmi server on http://localhost:5000"));