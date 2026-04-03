# First Principles Thinking Coach - CrewAI Service

A multi-agent AI system for guiding users through first principles thinking using CrewAI framework.

## Architecture

### Agents
1. **Anchor Agent** - Helps users define the core problem
2. **Assumption Challenger** - Identifies and questions assumptions
3. **Root Cause Analyst** - Digs deep to find fundamental causes
4. **Solution Architect** - Rebuilds solutions from first principles
5. **Mind Map Creator** - Visualizes the thinking process

### Process Flow
```
User Input → Anchor → Assumption Challenger → Root Cause Analyst → Solution Architect → Mind Map Creator → Final Output
```

## Setup

### 1. Install Dependencies
```bash
cd crewai_service
uv sync
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Run the Service
```bash
# Start the CrewAI service
python -m src.first_principles_crew.main
```

## Integration with Express Server

The CrewAI service is integrated with the existing Express server through:
- REST API endpoints
- WebSocket/SSE for real-time updates
- Database persistence for conversation history

## API Endpoints

### POST /api/crewai/chat
```json
{
  "message": "User's problem or question",
  "conversation_id": "optional_conversation_id",
  "phase": "optional_phase_override"
}
```

### GET /api/crewai/status/:task_id
Get status of a running crew task

### POST /api/crewai/cancel/:task_id
Cancel a running crew task

## Development

### Project Structure
```
crewai_service/
├── src/
│   └── first_principles_crew/
│       ├── __init__.py
│       ├── main.py          # Entry point
│       ├── crew.py          # Crew orchestration
│       ├── config/
│       │   ├── agents.yaml  # Agent definitions
│       │   └── tasks.yaml   # Task definitions
│       └── tools/
│           └── custom_tools.py
├── knowledge/              # Knowledge base files
├── pyproject.toml
├── .env.example
└── README.md
```

### Adding New Tools
1. Create tool in `src/first_principles_crew/tools/`
2. Import in `crew.py`
3. Add to agent's tools list

### Testing
```bash
uv run pytest tests/
```

## Deployment

### Docker
```bash
docker build -t first-principles-crew .
docker run -p 8000:8000 first-principles-crew
```

### Kubernetes
See `k8s/` directory for deployment manifests.

## Monitoring

- Prometheus metrics at `/metrics`
- Health check at `/health`
- Logs in structured JSON format