# 🎙️ SpeakWise AI

> An AI-powered English learning assistant that helps learners improve their English through personalized conversation, memory, RAG-based learning, mistake tracking, and real-time voice interaction.

## 🌟 Overview

**SpeakWise AI** is an intelligent English-learning platform designed to provide a more personalized and interactive way to practice English.

Instead of simply answering questions, SpeakWise remembers the learner's progress, identifies recurring mistakes, retrieves relevant learning information, and provides conversational practice.

The project combines **Generative AI, RAG, learner memory, SQLite-based mistake tracking, and real-time voice AI** into one learning assistant.

---

## ✨ Features

### 💬 AI Chat

- Natural English conversations with an AI tutor
- Personalized responses based on learner context
- Supports grammar, vocabulary, and general English practice
- Powered by Gemini

### 🧠 Learner Memory

SpeakWise maintains information about the learner's learning journey.

It can use previous interactions to provide more personalized responses instead of treating every conversation as completely new.

### 📚 RAG (Retrieval-Augmented Generation)

SpeakWise can retrieve relevant learning information and use it as context for generating better responses.

This helps the AI provide more grounded and useful explanations.

### ❌ Mistake Tracking

The system records English mistakes made during interactions.

The stored mistakes can be used to identify recurring problems and support personalized learning.

speakwise-ai/
│
├── backend/
│   ├── main.py
│   ├── agent.py
│   ├── config.py
│   ├── retell.py
│   └── ...
│
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   │
│   ├── services/
│   │   └── retell-voice.js
│   │
│   └── components/
│       └── voice-orb.js
│
├── database/
│   └── teacher.db
│
├── requirements.txt
├── .gitignore
└── README.md

<h2>Installation<h2/>
1. Clone the repository
git clone https://github.com/ACHU-ACHUTHA/speakwise-ai.git
cd speakwise-ai
2. Create a virtual environment
Windows
python -m venv .venv

Activate it:

.venv\Scripts\activate
3. Install dependencies
pip install -r requirements.txt

Run the Application

Start the backend:

uvicorn backend.main:app --reload
