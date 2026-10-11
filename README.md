# 💗 Simmi — Your Personal AI Clone

> *“Not just another AI chatbot. A little piece of me, powered by AI.”*

**Simmi** is a personal AI companion designed to reflect my personality, communication style, and way of interacting with people. Built with JavaScript and powered by Groq, Simmi aims to make conversations feel more natural, personal, and human-like.

From casual conversations to thoughtful advice, Simmi is being developed to feel less like talking to a machine and more like talking to a familiar version of me.

## ✨ Features

- 🧠 **Personal AI Persona** — Customize Simmi's personality, communication style, preferences, and background using a dedicated persona file.
- 💬 **AI-Powered Conversations** — Generate natural responses using Groq's language models.
- 🎙️ **Voice Interaction** — Support voice input and spoken AI responses.
- 🪞 **Personal Voice Cloning** — Exploring voice cloning to make Simmi speak in my own voice.
- 💖 **Personality-Based Responses** — A warm, thoughtful, playful, and slightly sarcastic conversational style.
- 🗂️ **Conversation History** — Maintain conversation context for more coherent interactions.
- 🎭 **Multiple Conversation Modes** — Switch between personal, professional, and other conversational styles.
- 📱 **Responsive Interface** — Designed to work across desktop and mobile screens.
- 🎨 **Minimal UI** — A clean, light-themed interface with soft pink accents.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React | Frontend UI |
| JavaScript | Application logic |
| Node.js | Backend runtime |
| Express.js | API and server |
| Groq API | AI-generated responses |
| Markdown | Persona configuration |
| Web Speech API | Browser-based voice input, if enabled |
| Fish Audio / Chatterbox | Voice cloning exploration |
| Vite | Frontend development and build tooling |
| Git & GitHub | Version control |

*Voice cloning providers and speech-input implementations may vary as development progresses.*

## 🏗️ How It Works

```text
              User
               |
               v
       React Frontend
               |
               v
       Express Backend
               |
        +------+------+
        |             |
        v             v
    Persona.md      Groq API
        |             |
        +------+------+
               |
               v
        AI-Generated Reply
               |
               v
        Voice Generation
               |
               v
          Audio Output
```

1. The user sends a message through Simmi's interface.
2. The backend combines the conversation context with the configured persona.
3. Groq generates a response based on the available context.
4. The response is displayed in the chat.
5. When voice output is enabled, a text-to-speech service can convert the reply into audio.

## 📁 Project Structure

```text
simmi/
├── src/
│   ├── App.jsx
│   └── ...
├── server/
│   ├── server.js
│   ├── persona.md
│   └── ...
├── public/
├── package.json
├── vite.config.js
├── .gitignore
└── README.md
```

*The structure above is illustrative. Update it to match your actual repository.*

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- A Groq API key
- Git

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd simmi
```

### 2. Install dependencies

Install the frontend dependencies:

```bash
npm install
```

If your backend has a separate `package.json`, install its dependencies too:

```bash
cd server
npm install
cd ..
```

### 3. Configure environment variables

Create a `.env` file in the appropriate backend directory and add your Groq API key:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=your_supported_groq_model
PORT=5000
```

Use a model currently available to your Groq account. Keep API keys on the backend and never commit them to GitHub.

### 4. Start the backend

From the project root, use the command matching your backend setup. For example:

```bash
node server/server.js
```

### 5. Start the frontend

In a separate terminal:

```bash
npm run dev
```

Open the local URL printed by Vite to interact with Simmi.

*Adjust the commands and environment variables to match your actual scripts and configuration.*

## 🧩 Personalizing Simmi

Simmi's personality can be configured through `server/persona.md`.

This file can contain:

- Personality traits and communication preferences
- Background information intentionally provided for the AI
- Preferred language and conversational tone
- Examples of natural responses
- Rules for personal and professional conversation modes

The backend uses this information as conversational context. It guides the model's responses; it does not, by itself, retrain the underlying language model.

## 🎙️ The Voice Behind Simmi

One of the main goals of this project is to make Simmi speak in my own voice.

I'm exploring voice-cloning technologies such as Fish Audio and Chatterbox to create a more personal voice experience.

The intended flow is:

**My voice sample → Voice cloning model → AI-generated text → My cloned voice**

The goal is to combine a personalized AI personality with a familiar voice, making the experience feel more natural and personal.

## 🔐 Security

- Store API keys in environment variables.
- Never upload `.env` files or private voice recordings to a public repository.
- Add secrets and sensitive files to `.gitignore`.
- Use appropriate authentication and access controls before exposing private endpoints publicly.

## 🗺️ Future Improvements

- [ ] Complete personal voice cloning integration
- [ ] Improve real-time voice conversations
- [ ] Add persistent, user-controlled long-term memory
- [ ] Improve multilingual Hindi-English conversations
- [ ] Add more customizable personality modes
- [ ] Improve response latency and audio playback
- [ ] Deploy the complete application

## 💸 The Budget

**Groq free credits. Free-tier tools. Lots of JavaScript.**

Building a personal AI clone on a student budget because apparently, hiring me is still optional. 🙂

## 👩‍💻 Built By

**Shikha Gupta**

CSE student | Developer | AI enthusiast

Building projects, experimenting with AI, and turning ideas into working applications—one free tier at a time.

- GitHub: [Your GitHub Profile](YOUR_GITHUB_PROFILE_URL)
- LinkedIn: [Connect with me](YOUR_LINKEDIN_PROFILE_URL)

## 📄 License

Choose a license before publishing this project publicly. If you want others to reuse and modify your code, consider the MIT License, provided the project's dependencies and assets permit it.

---

*Simmi is a work in progress. The goal isn't to build another chatbot—it's to build an AI that feels a little more personal.* 💗