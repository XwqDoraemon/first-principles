# CrewAI Integration for First Principles

## Overview

This integration replaces the simple DeepSeek API calls with a sophisticated multi-agent CrewAI system for first principles thinking. The system uses 5 specialized agents working together to guide users through structured problem-solving.

## Architecture

### Multi-Agent System
1. **Anchor Agent** - Defines the core problem
2. **Assumption Challenger** - Identifies and questions assumptions  
3. **Root Cause Analyst** - Finds fundamental causes using 5 Whys
4. **Solution Architect** - Designs solutions from first principles
5. **Mind Map Creator** - Visualizes the thinking process

### Technology Stack
- **Backend**: Express.js + CrewAI (Python)
- **Communication**: HTTP API + Subprocess spawning
- **Data Models**: Pydantic for structured outputs
- **Persistence**: JSON files + SQLite (optional)

## File Structure

```
first-principles/
├── server/
│   ├── index.cjs              # Main Express server (updated)
│   ├── crewai-bridge.cjs      # Node.js ↔ Python bridge
│   └── crewai-runner.py       # Python runner script
├── crewai_service/            # Python CrewAI service
│   ├── src/first_principles_crew/
│   │   ├── main.py           # Service entry point
│   │   ├── crew.py           # Crew orchestration
│   │   ├── models.py         # Pydantic data models
│   │   ├── bridge.py         # Express bridge (Python)
│   │   └── config/
│   │       ├── agents.yaml   # Agent definitions
│   │       └── tasks.yaml    # Task definitions
│   ├── pyproject.toml        # Python dependencies
│   └── .env                  # API keys
├── server/public-placeholder/
│   └── crewai-test.html      # Test interface
└── CREWAI_INTEGRATION.md     # This file
```

## API Endpoints

### CrewAI Endpoints
- `POST /api/crewai/chat` - Start thinking session
- `GET /api/crewai/status/:session_id` - Check session status  
- `GET /api/crewai/sessions` - List recent sessions
- `GET /api/crewai/health` - Health check
- `POST /api/chat/hybrid` - Hybrid chat (CrewAI + DeepSeek)

### Data Flow
```
User → Express → CrewAI Bridge → Python CrewAI → Agents → Results → User
```

## Setup Instructions

### 1. Install Dependencies
```bash
# Run setup script
./setup-crewai.sh

# Or manually:
cd crewai_service
uv venv
source .venv/bin/activate
uv pip install -e .
```

### 2. Configure API Keys
Edit `crewai_service/.env`:
```env
OPENAI_API_KEY=sk-...  # or DEEPSEEK_API_KEY
SERPER_API_KEY=...     # optional, for web search
```

### 3. Start the Server
```bash
npm run dev
```

### 4. Test Integration
Open: `http://localhost:4322/crewai-test.html`

## How It Works

### Thinking Process
1. **User submits problem** → Express server receives request
2. **Bridge spawns Python** → Runs CrewAI thinking session
3. **Agents collaborate** → Sequential thinking through 5 phases
4. **Results stored** → JSON files + database
5. **Updates streamed** → Real-time progress to user

### Agent Responsibilities
- **Anchor**: "What's the real problem here?"
- **Assumptions**: "What are we taking for granted?"
- **Root Cause**: "Why does this problem exist?"
- **Solution**: "What would work based on first principles?"
- **Mind Map**: "How does everything connect?"

## Benefits Over Simple API

### 1. Structured Thinking
- Systematic approach vs. single prompt
- Multiple perspectives from specialized agents
- Progressive refinement through phases

### 2. Better Results
- Deeper analysis with assumption challenging
- Root cause identification
- Solutions based on first principles

### 3. Transparency
- Visible thinking process
- Progress tracking
- Audit trail of reasoning

### 4. Extensibility
- Easy to add new agents/tools
- Customizable thinking workflows
- Integration with external tools

## Performance Considerations

### Speed vs. Depth
- **Simple API**: ~2-5 seconds response
- **CrewAI**: ~30-60 seconds for full analysis
- **Trade-off**: Depth of thinking vs. response time

### Optimization Options
1. **Caching**: Store completed sessions
2. **Parallel processing**: Run phases concurrently
3. **Model selection**: Use faster LLMs for simpler tasks
4. **Early exit**: Return partial results if user interrupts

## Monitoring & Debugging

### Logs
- Node.js: Console logs in Express server
- Python: Structured logging in `crewai_service/logs/`
- Session files: `crewai_service/output/sessions/`

### Health Checks
```bash
curl http://localhost:4322/api/crewai/health
```

### Session Management
```bash
# List sessions
curl http://localhost:4322/api/crewai/sessions?limit=5

# Check status
curl http://localhost:4322/api/crewai/status/session_id
```

## Future Enhancements

### Planned Features
1. **WebSocket streaming** - Real-time agent updates
2. **Knowledge base integration** - Learn from past sessions
3. **Custom tools** - Domain-specific problem solving
4. **User feedback loop** - Improve thinking based on outcomes

### Scalability
- **Horizontal scaling**: Multiple CrewAI workers
- **Queue system**: Redis for session management
- **Database**: Migrate from files to PostgreSQL

## Troubleshooting

### Common Issues

1. **Python import errors**
   ```bash
   cd crewai_service
   uv pip install -e .
   ```

2. **Missing API keys**
   - Check `.env` file exists
   - Verify keys are valid

3. **Process spawning fails**
   - Check Python path: `which python3`
   - Verify file permissions

4. **Slow performance**
   - Use smaller/faster LLM models
   - Enable caching
   - Reduce agent iterations

### Debug Mode
```bash
# Set verbose logging
export LOG_LEVEL=DEBUG
npm run dev
```

## Conclusion

The CrewAI integration transforms First Principles from a simple chat interface into a sophisticated thinking coach. While more complex than direct API calls, it provides significantly better guidance for first principles thinking.

The modular architecture allows for continuous improvement - adding new agents, tools, and capabilities as the system evolves.