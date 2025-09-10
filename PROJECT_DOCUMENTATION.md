# Project Documentation: AI Tech Co-Founder

## 1. Project Overview

This project is a web application that allows users to have a real-time, AI-powered conversation with a "Tech Co-Founder." The application is built with a modern tech stack, including a React frontend, a Node.js backend, and a Supabase database. The core AI conversation functionality is powered by the Tavus API.

### Key Features:

*   **Real-time AI Conversation:** Users can have a natural, voice-based conversation with an AI assistant.
*   **Automated Transcription:** All conversations are automatically transcribed.
*   **AI-Powered Summarization:** Completed conversations are automatically summarized using the Google Gemini API.
*   **Scalable Backend:** The backend is built with Node.js and Express, and it's designed to be scalable and easy to maintain.
*   **Supabase Integration:** The application uses Supabase for its database and for serverless functions (Edge Functions).

### Tech Stack:

*   **Frontend:** React, Vite, styled-components
*   **Backend:** Node.js, Express
*   **Database:** Supabase (PostgreSQL)
*   **AI Conversation:** Tavus API
*   **Summarization:** Google Gemini API

## 2. Frontend

The frontend is a single-page application (SPA) built with React and Vite. It's responsible for the user interface and for communicating with the backend to create and manage AI conversations.

### Key Components:

*   **`App.jsx`:** The main component that orchestrates the entire application.
*   **`Header.jsx`:** The main navigation header, which includes the "Get Started" button.
*   **`TavusModal.jsx`:** A modal component that houses the AI conversation. It handles the logic for creating a new conversation and displaying the AI interface.
*   **`Modal.jsx`:** A reusable modal component that's used by `TavusModal.jsx`.

## 3. Backend

The backend is a Node.js application built with Express. It serves as a secure intermediary between the frontend and the various APIs (Tavus, Supabase, and Google Gemini).

### Key Endpoints:

*   **`/api/tavus/create-conversation`:** Creates a new AI conversation with the Tavus API.
*   **`/api/tavus/webhook`:** Receives webhook events from the Tavus API, including the `conversation_ended` and `application.transcription_ready` events.
*   **`/api/summarize`:** Triggers the summarization of a conversation.

## 4. Database

The application uses a Supabase (PostgreSQL) database to store conversation data.

### Key Tables:

*   **`conversations`:** Stores a high-level record of each conversation, including the ID, URL, name, status, and the final summary.
*   **`conversation_events`:** Stores a detailed log of events for each conversation, including the full transcript.

## 5. Automated Summarization

The automated summarization feature is a key part of the application. Here's how it works:

1.  **Conversation Ends:** When a user finishes a conversation, the Tavus API sends a `conversation_ended` event to the backend webhook.
2.  **Transcription is Received:** Shortly after, the Tavus API sends an `application.transcription_ready` event, which contains the full transcript of the conversation.
3.  **Summarization is Triggered:** The backend receives the `conversation_ended` event and immediately calls a Supabase Edge Function (`summarize-conversation`).
4.  **Summary is Generated:** The Edge Function fetches the transcript from the `conversation_events` table, sends it to the Google Gemini API for summarization, and receives the summary.
5.  **Summary is Stored:** The Edge Function then saves the summary to the `summary` column in the `conversations` table.

This entire process is automated and happens in the background, providing a seamless experience for the user.
