#!/usr/bin/env python
"""Main entry point for First Principles CrewAI Service"""

import os
import sys
import json
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
from dotenv import load_dotenv

from .crew import FirstPrinciplesCrew
from .models import ThinkingSession, CrewAIResponse, ThinkingPhase


# Load environment variables
load_dotenv()

# Configure logging
import logging
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FirstPrinciplesService:
    """Service wrapper for First Principles CrewAI"""
    
    def __init__(self):
        self.crew = FirstPrinciplesCrew()
        self.active_sessions: Dict[str, Dict[str, Any]] = {}
        logger.info("First Principles Service initialized")
    
    def start_thinking_session(self, user_input: str, session_id: Optional[str] = None) -> CrewAIResponse:
        """Start a complete thinking session"""
        try:
            if not user_input or not user_input.strip():
                return CrewAIResponse(
                    success=False,
                    error="User input cannot be empty"
                )
            
            session_id = session_id or f"session_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
            
            # Store session in active sessions
            self.active_sessions[session_id] = {
                'user_input': user_input,
                'start_time': datetime.now(),
                'status': 'running',
                'current_phase': ThinkingPhase.ANCHOR,
                'results': {}
            }
            
            logger.info(f"Starting thinking session: {session_id}")
            
            # Run thinking in background
            asyncio.create_task(self._run_thinking_async(session_id, user_input))
            
            return CrewAIResponse(
                success=True,
                session_id=session_id,
                current_phase=ThinkingPhase.ANCHOR,
                message="Thinking session started. The crew is now analyzing your problem.",
                next_steps=[
                    "The anchor agent is defining your core problem",
                    "Check back in a few moments for updates"
                ]
            )
            
        except Exception as e:
            logger.error(f"Error starting thinking session: {e}")
            return CrewAIResponse(
                success=False,
                error=f"Failed to start thinking session: {str(e)}"
            )
    
    async def _run_thinking_async(self, session_id: str, user_input: str):
        """Run thinking process asynchronously"""
        try:
            session = self.crew.run_complete_thinking(user_input, session_id)
            
            # Update session status
            self.active_sessions[session_id].update({
                'status': 'completed',
                'end_time': datetime.now(),
                'session': session.model_dump()
            })
            
            logger.info(f"Thinking session completed: {session_id}")
            
        except Exception as e:
            logger.error(f"Error in thinking session {session_id}: {e}")
            self.active_sessions[session_id].update({
                'status': 'failed',
                'error': str(e),
                'end_time': datetime.now()
            })
    
    def get_session_status(self, session_id: str) -> CrewAIResponse:
        """Get status of a thinking session"""
        if session_id not in self.active_sessions:
            # Try to load from file
            session = self.crew.load_session(session_id)
            if session:
                return CrewAIResponse(
                    success=True,
                    session_id=session_id,
                    current_phase=ThinkingPhase.MINDMAP,
                    message="Session found (completed earlier)",
                    data=session.model_dump()
                )
            else:
                return CrewAIResponse(
                    success=False,
                    error=f"Session not found: {session_id}"
                )
        
        session_data = self.active_sessions[session_id]
        
        if session_data['status'] == 'completed':
            session = session_data.get('session')
            if session:
                return CrewAIResponse(
                    success=True,
                    session_id=session_id,
                    current_phase=ThinkingPhase.MINDMAP,
                    message="Thinking session completed",
                    data=session
                )
        
        # Calculate progress
        phases = list(ThinkingPhase)
        current_idx = phases.index(session_data['current_phase'])
        progress = (current_idx + 1) / len(phases) * 100
        
        return CrewAIResponse(
            success=True,
            session_id=session_id,
            current_phase=session_data['current_phase'],
            message=f"Thinking in progress: {session_data['current_phase'].value.replace('_', ' ').title()}",
            data={
                'status': session_data['status'],
                'progress': progress,
                'elapsed_seconds': (datetime.now() - session_data['start_time']).total_seconds(),
                'current_phase': session_data['current_phase'].value
            }
        )
    
    def run_single_phase(self, phase: ThinkingPhase, context: Dict[str, Any]) -> CrewAIResponse:
        """Run a single thinking phase"""
        try:
            result = self.crew.run_phase(phase, context)
            
            return CrewAIResponse(
                success=True,
                current_phase=phase,
                message=f"{phase.value.replace('_', ' ').title()} phase completed",
                data=result.model_dump() if hasattr(result, 'model_dump') else result
            )
            
        except Exception as e:
            logger.error(f"Error running phase {phase}: {e}")
            return CrewAIResponse(
                success=False,
                error=f"Failed to run {phase.value} phase: {str(e)}"
            )
    
    def list_sessions(self, limit: int = 10) -> CrewAIResponse:
        """List recent thinking sessions"""
        try:
            sessions_dir = 'output/sessions'
            if not os.path.exists(sessions_dir):
                return CrewAIResponse(
                    success=True,
                    message="No sessions found",
                    data={'sessions': []}
                )
            
            session_files = sorted(
                [f for f in os.listdir(sessions_dir) if f.endswith('.json')],
                reverse=True
            )[:limit]
            
            sessions = []
            for filename in session_files:
                session_id = filename.replace('.json', '')
                try:
                    session = self.crew.load_session(session_id)
                    if session:
                        sessions.append({
                            'session_id': session_id,
                            'timestamp': session.timestamp,
                            'user_input_preview': session.user_input[:100] + ('...' if len(session.user_input) > 100 else ''),
                            'duration_seconds': session.duration_seconds
                        })
                except Exception as e:
                    logger.warning(f"Error loading session {session_id}: {e}")
            
            return CrewAIResponse(
                success=True,
                message=f"Found {len(sessions)} sessions",
                data={'sessions': sessions}
            )
            
        except Exception as e:
            logger.error(f"Error listing sessions: {e}")
            return CrewAIResponse(
                success=False,
                error=f"Failed to list sessions: {str(e)}"
            )


# Global service instance
_service_instance: Optional[FirstPrinciplesService] = None


def get_service() -> FirstPrinciplesService:
    """Get or create the service instance"""
    global _service_instance
    if _service_instance is None:
        _service_instance = FirstPrinciplesService()
    return _service_instance


def run_cli():
    """Run the service from command line"""
    import argparse
    
    parser = argparse.ArgumentParser(description='First Principles Thinking Coach')
    parser.add_argument('--input', '-i', type=str, help='User input/problem to analyze')
    parser.add_argument('--session', '-s', type=str, help='Session ID to check status')
    parser.add_argument('--list', '-l', action='store_true', help='List recent sessions')
    parser.add_argument('--phase', '-p', type=str, choices=[p.value for p in ThinkingPhase],
                       help='Run a specific thinking phase')
    
    args = parser.parse_args()
    service = get_service()
    
    if args.list:
        result = service.list_sessions()
        print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))
    
    elif args.session:
        result = service.get_session_status(args.session)
        print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))
    
    elif args.input:
        result = service.start_thinking_session(args.input)
        print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))
        
        if result.success and result.session_id:
            print(f"\nSession started: {result.session_id}")
            print("Use --session to check status")
    
    elif args.phase:
        # For phase-specific execution, need context
        print(f"Running {args.phase} phase requires context. Please use the API.")
    
    else:
        parser.print_help()


if __name__ == '__main__':
    run_cli()