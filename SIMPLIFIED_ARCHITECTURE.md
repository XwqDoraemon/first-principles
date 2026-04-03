# Simplified Architecture: Direct LLM API + Skill System

## Overview

This document describes the simplified architecture after removing CrewAI. The system now uses direct LLM API calls with a carefully designed skill system for first principles thinking.

## Architecture Diagram

```
User → Express Server → DeepSeek API → Response → User
        │
        ├─ Skill System (skill.md)
        ├─ Conversation DB (SQLite)
        └─ Mindmap Generator
```

## Core Components

### 1. Express Server (`server/index.cjs`)
- Single Node.js server with minimal dependencies
- Handles all HTTP requests and SSE streaming
- Integrates skill system via system prompts
- Manages conversation persistence

### 2. Skill System (`src/data/skill.md`)
- Comprehensive first principles thinking framework
- 5-phase guided thinking process
- Structured prompts for DeepSeek API
- Maintains thinking methodology without multi-agent complexity

### 3. Database (`server/db.cjs`)
- SQLite for conversation storage
- Simple CRUD operations
- Mindmap persistence

### 4. Mindmap Generator
- Integrated into Express server
- Uses DeepSeek API for mindmap generation
- Mermaid.js compatible output

## API Endpoints

### Core Endpoints
- `POST /api/chat` - Main chat endpoint with SSE streaming
- `POST /api/mindmap` - Generate mindmap from conversation
- `GET /api/conversations` - List conversations
- `GET /api/conversations/:id` - Get specific conversation
- `POST /api/conversations` - Create new conversation
- `GET /api/usage` - Usage statistics

## Skill Integration

### How It Works
1. **Skill Loading**: Server loads `skill.md` at startup
2. **System Prompt**: Skill content injected as system prompt
3. **Guided Thinking**: DeepSeek follows 5-phase framework
4. **Structured Output**: Responses follow skill guidelines

### Skill Benefits
- **Consistency**: Same thinking methodology every time
- **Depth**: Structured first principles analysis
- **Flexibility**: Easy to update and improve
- **Simplicity**: No complex agent orchestration

## Performance Comparison

| Aspect | CrewAI (Previous) | Direct LLM + Skill (Current) |
|--------|-------------------|-----------------------------|
| Response Time | 30-60 seconds | 2-5 seconds |
| Complexity | High (Python + Node) | Low (Node only) |
| Dependencies | Python, CrewAI, Pydantic | Node.js, Express |
| Deployment | Complex (multi-process) | Simple (single process) |
| Reliability | Medium (bridge failures) | High (direct API) |
| Thinking Depth | Structured multi-agent | Structured skill prompts |

## Key Design Decisions

### 1. Why Remove CrewAI?
- **Complexity**: Python/Node bridge added failure points
- **Performance**: 30-60s response time vs 2-5s
- **Maintenance**: Multiple dependencies and processes
- **Reliability**: Bridge failures disrupted service

### 2. Why Keep Skill System?
- **Methodology Preservation**: Maintains first principles thinking
- **Structured Guidance**: Provides consistent thinking framework
- **Flexibility**: Easy to update and improve
- **Simplicity**: Single file, no external dependencies

### 3. Architecture Benefits
- **Single Responsibility**: Express server handles everything
- **Direct API Calls**: No intermediate processing layers
- **Simple Deployment**: `npm start` or `node server/index.cjs`
- **Easy Debugging**: Single codebase, clear error paths

## Setup and Deployment

### Quick Start
```bash
# Install dependencies
npm install

# Set API key
export DEEPSEEK_API_KEY=your_key_here

# Start server
npm run dev
```

### Environment Variables
```bash
DEEPSEEK_API_KEY=sk-...          # Required
DEEPSEEK_MODEL=deepseek-chat     # Optional (default)
PORT=4322                        # Optional (default)
HOST=0.0.0.0                     # Optional (default)
```

### Production Deployment
```bash
# Build frontend (if using Astro)
npm run build

# Start production server
npm start
```

## Future Enhancements

### Planned Improvements
1. **Multi-model Support**: Add OpenAI, Claude, etc.
2. **Skill Versioning**: Track skill changes and improvements
3. **Performance Metrics**: Monitor response times and quality
4. **User Feedback**: Improve skill based on outcomes

### Scalability Options
- **Load Balancing**: Multiple Express instances
- **Caching**: Redis for frequent queries
- **CDN**: Static asset delivery
- **Monitoring**: Prometheus + Grafana

## Troubleshooting

### Common Issues

1. **API Key Issues**
   ```bash
   export DEEPSEEK_API_KEY=your_key_here
   ```

2. **Port Already in Use**
   ```bash
   PORT=4323 npm run dev
   ```

3. **Skill Not Loading**
   - Check `src/data/skill.md` exists
   - Verify file permissions

4. **Database Issues**
   - Check `/tmp/fp-db.sqlite3` permissions
   - Delete and restart to reset

### Debug Mode
```bash
# Enable verbose logging
export DEBUG=first-principles:*
npm run dev
```

## Conclusion

The simplified architecture provides:
- **Better Performance**: 10x faster response times
- **Lower Complexity**: Single codebase, no bridges
- **Higher Reliability**: Direct API calls, no process spawning
- **Easier Maintenance**: Fewer dependencies, simpler deployment

While removing CrewAI reduces multi-agent orchestration, the skill system preserves the core first principles thinking methodology with improved speed and reliability.

The system is now production-ready with minimal operational overhead and maximum thinking quality.
