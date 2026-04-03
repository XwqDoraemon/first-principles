#!/usr/bin/env python
"""
Python runner for CrewAI service
Called from Node.js Express server
"""

import sys
import json
import os
import asyncio
from datetime import datetime

# Add the crewai_service to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'crewai_service', 'src'))

try:
    from first_principles_crew.main import get_service
    from first_principles_crew.models import ThinkingPhase
    CREWAI_AVAILABLE = True
except ImportError as e:
    print(f"Import error: {e}", file=sys.stderr)
    CREWAI_AVAILABLE = False


def handle_health_check():
    """Handle health check request"""
    if not CREWAI_AVAILABLE:
        return {
            'success': False,
            'error': 'CrewAI not available. Check Python imports.'
        }
    
    try:
        service = get_service()
        
        # Simple test to verify service works
        return {
            'success': True,
            'status': 'healthy',
            'crewai_version': '0.1.0',
            'python_version': sys.version,
            'timestamp': datetime.now().isoformat()
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'Service error: {str(e)}'
        }


def handle_run_thinking(user_input, session_id):
    """Handle run thinking request"""
    if not CREWAI_AVAILABLE:
        return {
            'success': False,
            'error': 'CrewAI not available'
        }
    
    try:
        service = get_service()
        
        # Start thinking session
        response = service.start_thinking_session(user_input, session_id)
        
        # Convert to dict
        result = response.model_dump()
        
        # Add task ID for tracking
        if response.success and response.session_id:
            result['task_id'] = response.session_id
        
        return result
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to start thinking: {str(e)}'
        }


def handle_check_status(session_id):
    """Handle check status request"""
    if not CREWAI_AVAILABLE:
        return {
            'success': False,
            'error': 'CrewAI not available'
        }
    
    try:
        service = get_service()
        
        # Get session status
        response = service.get_session_status(session_id)
        result = response.model_dump()
        
        # Add completion flag
        if response.success:
            if response.data and isinstance(response.data, dict):
                result['completed'] = response.data.get('status') == 'completed'
            else:
                result['completed'] = False
        
        return result
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to check status: {str(e)}'
        }


def handle_list_sessions(limit=10):
    """Handle list sessions request"""
    if not CREWAI_AVAILABLE:
        return {
            'success': False,
            'error': 'CrewAI not available'
        }
    
    try:
        service = get_service()
        response = service.list_sessions(limit)
        return response.model_dump()
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to list sessions: {str(e)}'
        }


def main():
    """Main entry point"""
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({
                'success': False,
                'error': 'No input provided'
            }))
            return
        
        data = json.loads(input_data)
        command = data.get('command')
        
        if command == 'health':
            result = handle_health_check()
        
        elif command == 'run_thinking':
            user_input = data.get('user_input', '')
            session_id = data.get('session_id')
            result = handle_run_thinking(user_input, session_id)
        
        elif command == 'check_status':
            session_id = data.get('session_id')
            if not session_id:
                result = {
                    'success': False,
                    'error': 'session_id required'
                }
            else:
                result = handle_check_status(session_id)
        
        elif command == 'list_sessions':
            limit = data.get('limit', 10)
            result = handle_list_sessions(limit)
        
        else:
            result = {
                'success': False,
                'error': f'Unknown command: {command}',
                'available_commands': ['health', 'run_thinking', 'check_status', 'list_sessions']
            }
        
        # Output result as JSON
        print(json.dumps(result, ensure_ascii=False))
        
    except json.JSONDecodeError as e:
        print(json.dumps({
            'success': False,
            'error': f'Invalid JSON input: {str(e)}'
        }), file=sys.stderr)
        sys.exit(1)
    
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Unexpected error: {str(e)}'
        }), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()