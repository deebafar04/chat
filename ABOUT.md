# CodeChat

A multimodal AI chat application with advanced agent orchestration, supporting multiple AI providers and rich interactive features including code execution, diagram generation, and GitHub integration.

*Our enhancements to original Vercel Chat Starter*
[Earthscape frontend](https://earthscape.vercel.app) - See [earthscape/chat/app](https://github.com/Earthscape/chat/tree/main/app) and [Vercel original](https://github.com/vercel/chatbot/tree/main/app)
[Model.earth Ingestion](ingestion/) - to train RAG with Github submodules
[About Vercel Chat Starter](https://vercel.com/templates/next.js/chatbot)

## Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI Library**: React 19
- **Styling**: Tailwind CSS
- **State Management**: React Context & Hooks
- **Real-time Updates**: Server-Sent Events (SSE)

### Backend
- **Runtime**: Node.js
- **API**: Next.js API Routes
- **Database**: PostgreSQL (Supabase)
- **ORM**: Drizzle ORM
- **Authentication**: Custom implementation with localStorage API keys

### AI Providers
- **Google AI**: Gemini 2.0 Flash, Gemini 2.0 Flash Thinking, Gemini 1.5 Pro/Flash
- **OpenAI**: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus/Haiku

### Key Features
- Multi-agent orchestration system
- GitHub MCP (Model Context Protocol) integration
- Document versioning and artifact system
- Python code execution sandbox
- Mermaid diagram rendering
- Admin panel for configuration
- Comprehensive logging and monitoring

## Architecture

### High-Level System Architecture

```mermaid
graph TB
    Client[Client Browser]

    subgraph "Frontend Layer"
        UI[Next.js UI Components]
        Store[Client State Management]
        API_Client[API Client]
    end

    subgraph "Backend Layer"
        API[Next.js API Routes]
        Router[Agent Router]

        subgraph "Agent System"
            ChatAgent[Chat Agent]
            DocAgent[Document Agent]
            PyAgent[Python Agent]
            MermaidAgent[Mermaid Agent]
            GitHubAgent[GitHub MCP Agent]
            ProviderAgent[Provider Tools Agent]
        end

        subgraph "AI Providers"
            Google[Google Gemini]
            OpenAI[OpenAI GPT]
            Anthropic[Anthropic Claude]
        end
    end

    subgraph "Data Layer"
        DB[(PostgreSQL/Supabase)]
    end

    Client --> UI
    UI --> Store
    Store --> API_Client
    API_Client --> API
    API --> Router
    Router --> ChatAgent
    Router --> DocAgent
    Router --> PyAgent
    Router --> MermaidAgent
    Router --> GitHubAgent
    Router --> ProviderAgent

    ChatAgent --> Google
    ChatAgent --> OpenAI
    ChatAgent --> Anthropic

    DocAgent --> DB
    PyAgent --> Google
    MermaidAgent --> Google
    GitHubAgent --> Google

    API --> DB
```

### Agent Orchestration Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant Router
    participant Agent
    participant AI Provider
    participant DB

    User->>UI: Send message with context
    UI->>API: POST /api/chat
    API->>Router: Route to appropriate agent
    Router->>Agent: Initialize with tools

    loop Streaming Response
        Agent->>AI Provider: Stream request
        AI Provider-->>Agent: Partial response
        Agent->>API: Stream chunk
        API-->>UI: SSE event
        UI-->>User: Display update
    end

    Agent->>DB: Save message & artifacts
    DB-->>Agent: Confirmation
    Agent->>API: Complete
    API-->>UI: Done event
```

### Data Flow Architecture

```mermaid
flowchart LR
    subgraph Input
        Text[Text Input]
        Files[File Uploads]
        GitHub[GitHub Context]
        Images[Images/PDFs]
    end

    subgraph Processing
        Validation[Input Validation]
        AgentSelection[Agent Selection]
        Context[Context Building]
        AIProcess[AI Processing]
    end

    subgraph Output
        Response[Streamed Response]
        Artifacts[Artifacts<br/>Documents/Code/Diagrams]
        Logs[Activity Logs]
    end

    subgraph Storage
        Messages[(Messages)]
        Documents[(Documents)]
        Chats[(Chats)]
        UsageLogs[(Usage Logs)]
    end

    Text --> Validation
    Files --> Validation
    GitHub --> Validation
    Images --> Validation

    Validation --> AgentSelection
    AgentSelection --> Context
    Context --> AIProcess

    AIProcess --> Response
    AIProcess --> Artifacts
    AIProcess --> Logs

    Response --> Messages
    Artifacts --> Documents
    Logs --> UsageLogs
    Messages --> Chats
```

## Quick Start

For detailed setup instructions, architecture deep-dive, and comprehensive documentation, please refer to:

**[📖 Complete Overview & Documentation](./docs/OVERVIEW.md)**

The overview document includes:
- Detailed project overview and quick start guide
- Complete tech stack breakdown
- Contribution guidelines
- Full documentation index with table of contents for all guides

## Key Documentation

- **[Admin Panel](./docs/admin-panel.md)** - Configuration and management
- **[Agent Architecture](./docs/agent-architecture.md)** - Multi-agent system design
- **[Database Design](./docs/database-design.md)** - Schema and data model
- **[Multimodal Features](./docs/multimodal-chat-features.md)** - Chat capabilities
- **[Testing Strategy](./docs/testing.md)** - Comprehensive testing guide

## License

MIT License - see LICENSE file for details
