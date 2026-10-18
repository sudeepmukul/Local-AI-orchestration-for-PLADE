# PLADE Backend AI

**AI-Powered Code Evaluation and Gamified Programming Learning Backend**

PLADE is an AI-assisted backend for a gamified programming learning platform built around evaluating code submissions, providing contextual hints, tracking player progress, and generating performance analytics.

The backend connects the game/application layer to an AI inference pipeline, a knowledge retrieval system, and a database for storing evaluation attempts and player statistics.

## Overview

PLADE Backend AI provides the following capabilities:

- **Code Evaluation:** Evaluates programming submissions using backend validation logic.
- **AI-Powered Hints:** Uses Retrieval-Augmented Generation (RAG) to retrieve relevant programming knowledge and generate contextual hints.
- **Knowledge Retrieval:** Retrieves relevant chunks from a local knowledge base using embeddings and cosine similarity.
- **Player Management:** Creates and tracks player records.
- **Progress Tracking:** Stores submission attempts and evaluation results.
- **Leaderboards:** Retrieves ranked player results for individual maps.
- **Analytics:** Aggregates player, attempt, result, and map-level statistics.



## Technology Stack

| Component | Technology |
|---|---|
| Runtime | Node.js |
| Backend Framework | Express.js |
| Database ORM | Prisma |
| Database | SQLite |
| Local Model Runtime | Ollama |
| Embedding Model | `nomic-embed-text` |
| Hint Generation Model | `tinyllama` |
| Retrieval Method | Embedding similarity with cosine ranking |
| Knowledge Source | `knowledge.txt` |
| API Testing | Browser / Postman / cURL |

## Project Structure

```text
ai-server/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── plade.db
├── server.js
├── rag.js
├── loadKnowledge.js
├── knowledge.txt
├── package.json
├── package-lock.json
├── prisma.config.ts
├── .env
├── .gitignore
└── README.md
```

**Core files**

- `server.js`: Express server, API routes, evaluation logic, database operations, and analytics endpoints.
- `rag.js`: Retrieval-Augmented Generation pipeline for contextual hints.
- `loadKnowledge.js`: Loads and prepares knowledge-base content for retrieval.
- `knowledge.txt`: Programming concepts and reference material used by the retrieval pipeline.
- `prisma/schema.prisma`: Database models and relationships.
- `prisma/migrations/`: Database schema migration history.
- `prisma/plade.db`: Local SQLite database. This file is intended for local development and should not be committed if it contains local or generated data.

## AI and RAG Pipeline

PLADE uses a local RAG pipeline to provide programming hints grounded in relevant knowledge-base content.

### How it works

1. The client sends a hint request to the backend.
2. The backend processes the submitted query.
3. The retrieval pipeline searches the knowledge base for relevant text chunks.
4. The `nomic-embed-text` model generates embeddings used to represent text semantically.
5. Cosine similarity ranks the retrieved chunks by relevance.
6. The top two relevant chunks are selected as context.
7. The retrieved context and query are passed to the TinyLlama model through Ollama.
8. The generated hint is returned to the client.

### Pipeline

```text
User Query
    |
    v
Text Embedding
    |
    v
Knowledge Chunk Retrieval
    |
    v
Cosine Similarity Ranking
    |
    v
Top-2 Relevant Chunks
    |
    v
Context + Query
    |
    v
TinyLlama via Ollama
    |
    v
Contextual Programming Hint
```

The retrieval component helps the model use relevant programming material instead of relying exclusively on its pretrained knowledge.

**Note:** This architecture uses embedding-based retrieval. It should not be described as a persistent vector database or a fully implemented vector-search infrastructure unless those components are added separately.


**Request and response schemas:** Refer to `server.js` for the exact request body fields, response formats, validation rules, and error-handling behavior.

### Test the server

```bash
curl http://localhost:3000/test
```

### Example hint request

The following is a template. Replace the placeholder field with the exact field expected by your implementation.

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -d '{"query":"Explain how loops work in programming"}'
```

### Check analytics

```bash
curl http://localhost:3000/analytics
```

### Check a map leaderboard

```bash
curl http://localhost:3000/leaderboard/MAP_NAME
```

## Database and Persistence

PLADE uses Prisma ORM with SQLite for local persistence.

The database stores application data used by the player system, evaluation workflow, progress tracking, and analytics.

Prisma provides a structured interface for database operations and schema management.

### Database commands

Generate the Prisma Client:

```bash
npx prisma generate
```

Apply existing migrations:

```bash
npx prisma migrate deploy
```

Inspect the local database:

```bash
npx prisma studio
```

Use the project's existing migrations when initializing the database. If the project has no migration history yet, create an initial migration before relying on `migrate deploy`.

## Installation and Setup

### Prerequisites

Install the following:

- Node.js and npm
- Ollama
- Git

### 1. Clone the repository

```bash
git clone YOUR_REPOSITORY_URL
cd ai-server
```

Replace `YOUR_REPOSITORY_URL` with your actual repository URL.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file if required by your current configuration.

Example:

```env
DATABASE_URL="file:./plade.db"
```

**Important:** Prisma resolves SQLite paths according to its schema and configuration. Confirm the correct relative path for your `schema.prisma` and `prisma.config.ts` before using this example.

Never commit API keys, passwords, tokens, or other secrets.

### 4. Initialize Prisma

```bash
npx prisma generate
npx prisma migrate deploy
```

Ensure the SQLite database is initialized successfully before starting the server.

### 5. Install the AI models

Start Ollama, then pull the models used by the current pipeline:

```bash
ollama pull nomic-embed-text
ollama pull tinyllama
```

Verify that the models are available:

```bash
ollama list
```

The model names used by `rag.js` must match the installed Ollama model names.

### 6. Start the backend

```bash
node server.js
```

If configured to use port `3000`, the backend will be accessible at:

```text
http://localhost:3000
```

Keep Ollama running while testing AI-powered hint generation.

## Evaluation and Analytics

The evaluation endpoint validates incoming submissions using the rules implemented in the backend and records relevant outcomes through Prisma.

The analytics endpoint aggregates available database records to provide a high-level view of system usage and player performance.

The leaderboard endpoint supports map-specific rankings based on the project's stored evaluation data.

The exact scoring rules, difficulty calculation, ranking criteria, and supported programming languages depend on the current implementation in `server.js` and `schema.prisma`.

## Git Configuration

The local SQLite database and environment configuration should generally remain outside version control.

Example `.gitignore`:

```gitignore
node_modules/
.env

# Local database
prisma/plade.db

# Generated Prisma artifacts, if applicable
/generated/prisma
```

Keep the following under version control:

- Source code
- `package.json` and `package-lock.json`
- `schema.prisma`
- Prisma migration files
- Non-sensitive knowledge-base files
- Documentation

If Git already tracks the database, remove it from tracking without deleting the local copy:

```bash
git rm --cached prisma/plade.db
git add .gitignore
git commit -m "Ignore local Prisma database"
```

If the database was committed previously, adding it to `.gitignore` will not remove earlier copies from Git history.

## Current Design Principles

- **Local AI Inference:** Uses Ollama to run the configured models locally.
- **Contextual Generation:** Retrieves relevant programming knowledge before generating hints.
- **Persistent Progress:** Uses Prisma and SQLite to record application data.
- **Modular Backend:** Separates HTTP endpoints, retrieval logic, knowledge loading, and database access.
- **Data-Driven Insights:** Exposes analytics and leaderboard endpoints for the client application.

## Future Improvements

Potential extensions include:

- More comprehensive automated code testing and sandboxed execution.
- Difficulty estimation based on player performance and submission history.
- More robust retrieval with persistent vector storage and hybrid search.
- Improved hint quality through model and prompt evaluation.
- Authentication and authorization for player accounts.
- Expanded analytics for accuracy, completion rate, and learning progression.
- Automated testing and continuous integration.
- Production database support and deployment configuration.

These are potential improvements, not claims about existing functionality.

## License

Copyright © 2026 PLADE. All rights reserved.
This software and its associated source code are proprietary and confidential. No permission is granted to use, copy, modify, distribute, sublicense, or commercially exploit this software without prior written permission from the copyright owner.

Unauthorized reproduction or distribution of this software, in whole or in part, is prohibited.

For licensing or commercial inquiries, please contact the project owner.
---

**PLADE Backend AI**  
*The backend intelligence layer for a gamified programming learning experience.*
