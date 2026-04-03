"""Bridge between CrewAI service and Express server"""

import os
import json
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime
import logging

from .main import get_service
from .models import CrewAIResponse, ThinkingPhase


logger = logging.getLogger(__name__)


class ExpressBridge:
    """Bridge to connect CrewAI with Express server"""
    
    def __init__(self):
        self.service = get_service()
        self.websocket_clients: Dict[str, Any] = {}
        logger.info("Express Bridge initialized")
    
    async def handle_chat_request(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle chat request from Express server"""
        try:
            user_input = data.get('message', '').strip()
            conversation_id = data.get('conversation_id')
            phase_override = data.get('phase')
            
            if not user_input:
                return {
                    'success': False,
                    'error': 'Message cannot be empty'
                }
            
            # Start thinking session
            response = self.service.start_thinking_session(user_input, conversation_id)
            
            result = response.model_dump()
            
            # If we have a session ID, set up WebSocket/SSE updates
            if response.success and response.session_id:
                asyncio.create_task(
                    self._stream_session_updates(response.session_id)
                )
            
            return result
            
        except Exception as e:
            logger.error(f"Error handling chat request: {e}")
            return {
                'success': False,
                'error': f"Internal server error: {str(e)}"
            }
    
    async def _stream_session_updates(self, session_id: str):
        """Stream updates for a session (for WebSocket/SSE)"""
        try:
            # This would connect to WebSocket or SSE
            # For now, just log updates
            while True:
                await asyncio.sleep(2)  # Check every 2 seconds
                
                response = self.service.get_session_status(session_id)
                if not response.success:
                    break
                
                if response.data and response.data.get('status') == 'completed':
                    logger.info(f"Session {session_id} completed")
                    break
                
                # Here you would send update to WebSocket client
                # await self._send_ws_update(session_id, response.model_dump())
                
        except Exception as e:
            logger.error(f"Error streaming updates for {session_id}: {e}")
    
    async def get_session_updates(self, session_id: str) -> Dict[str, Any]:
        """Get latest updates for a session (polling fallback)"""
        response = self.service.get_session_status(session_id)
        return response.model_dump()
    
    async def cancel_session(self, session_id: str) -> Dict[str, Any]:
        """Cancel a running session"""
        # Note: CrewAI doesn't have built-in cancellation yet
        # This would need custom implementation
        return {
            'success': False,
            'error': 'Session cancellation not yet implemented',
            'session_id': session_id
        }
    
    async def list_sessions(self, limit: int = 20) -> Dict[str, Any]:
        """List sessions for the Express API"""
        response = self.service.list_sessions(limit)
        return response.model_dump()
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check endpoint"""
        try:
            # Try to create a simple crew to verify everything works
            test_input = "Test health check"
            response = self.service.start_thinking_session(test_input, "health_check")
            
            return {
                'status': 'healthy' if response.success else 'degraded',
                'timestamp': datetime.now().isoformat(),
                'service': 'first_principles_crewai',
                'version': '0.1.0',
                'details': {
                    'crewai_available': True,
                    'llm_configured': os.getenv('OPENAI_API_KEY') is not None or os.getenv('DEEPSEEK_API_KEY') is not None,
                    'active_sessions': len(self.service.active_sessions)
                }
            }
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                'status': 'unhealthy',
                'timestamp': datetime.now().isoformat(),
                'error': str(e)
            }


# Global bridge instance
_bridge_instance: Optional[ExpressBridge] = None


def get_bridge() -> ExpressBridge:
    """Get or create the bridge instance"""
    global _bridge_instance
    if _bridge_instance is None:
        _bridge_instance = ExpressBridge()
    return _bridge_instance


async def handle_express_request(endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle request from Express server"""
    bridge = get_bridge()
    
    if endpoint == 'chat':
        return await bridge.handle_chat_request(data)
    
    elif endpoint == 'session_status':
        session_id = data.get('session_id')
        if not session_id:
            return {'success': False, 'error': 'session_id required'}
        return await bridge.get_session_updates(session_id)
    
    elif endpoint == 'cancel_session':
        session_id = data.get('session_id')
        if not session_id:
            return {'success': False, 'error': 'session_id required'}
        return await bridge.cancel_session(session_id)
    
    elif endpoint == 'list_sessions':
        limit = data.get('limit', 20)
        return await bridge.list_sessions(limit)
    
    elif endpoint == 'health':
        return await bridge.health_check()
    
    else:
        return {
            'success': False,
            'error': f'Unknown endpoint: {endpoint}',
            'available_endpoints': ['chat', 'session_status', 'cancel_session', 'list_sessions', 'health']
        }


# For testing
if __name__ == '__main__':
    import asyncio
    
    async def test():
        bridge = get_bridge()
        
        # Test health check
        health = await bridge.health_check()
        print("Health check:", json.dumps(health, indent=2))
        
        # Test chat request
        chat_data = {
            'message': 'How can I improve my productivity?',
            'conversation_id': 'test_123'
        }
        
        response = await bridge.handle_chat_request(chat_data)
        print("\nChat response:", json.dumps(response, indent=2))
        
        if response.get('success') and response.get('session_id'):
            session_id = response['session_id']
            
            # Wait a bit and check status
            await asyncio.sleep(3)
            status = await bridge.get_session_updates(session_id)
            print(f"\nStatus for {session_id}:", json.dumps(status, indent=2))
    
    asyncio.run(test())