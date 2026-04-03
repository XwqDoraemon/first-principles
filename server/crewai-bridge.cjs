/**
 * CrewAI Bridge for Express Server
 * 
 * This module bridges the Express server with the Python CrewAI service.
 * It spawns a Python subprocess to run the CrewAI service and communicates
 * via HTTP or WebSocket.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class CrewAIBridge {
  constructor() {
    this.pythonProcess = null;
    this.isRunning = false;
    this.sessions = new Map();
    this.port = process.env.CREWAI_PORT || 8001;
    
    // Path to CrewAI service
    this.crewaiDir = path.join(__dirname, '..', 'crewai_service');
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    
    console.log(`CrewAI Bridge initialized. CrewAI dir: ${this.crewaiDir}`);
  }
  
  /**
   * Start the CrewAI Python service
   */
  async startService() {
    if (this.isRunning) {
      console.log('CrewAI service already running');
      return true;
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Check if CrewAI directory exists
        if (!fs.existsSync(this.crewaiDir)) {
          console.error(`CrewAI directory not found: ${this.crewaiDir}`);
          reject(new Error('CrewAI directory not found'));
          return;
        }
        
        // Check for .env file
        const envPath = path.join(this.crewaiDir, '.env');
        if (!fs.existsSync(envPath)) {
          console.warn('No .env file found in CrewAI directory. Using example.');
          const exampleEnv = path.join(this.crewaiDir, '.env.example');
          if (fs.existsSync(exampleEnv)) {
            fs.copyFileSync(exampleEnv, envPath);
            console.log('Created .env file from example');
          }
        }
        
        // Start Python service
        const mainPy = path.join(this.crewaiDir, 'src', 'first_principles_crew', 'main.py');
        
        if (!fs.existsSync(mainPy)) {
          console.error(`Main Python file not found: ${mainPy}`);
          reject(new Error('CrewAI main.py not found'));
          return;
        }
        
        // For now, we'll use a simpler approach: spawn Python on demand
        // In production, you'd want a persistent service
        console.log('CrewAI service will be spawned on demand');
        this.isRunning = true;
        resolve(true);
        
      } catch (error) {
        console.error('Failed to start CrewAI service:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Stop the CrewAI service
   */
  async stopService() {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
    this.isRunning = false;
    console.log('CrewAI service stopped');
  }
  
  /**
   * Run a thinking session
   */
  async runThinkingSession(userInput, conversationId = null) {
    const sessionId = conversationId || `crewai_${uuidv4().replace(/-/g, '')}`;
    
    console.log(`Starting CrewAI thinking session: ${sessionId}`);
    console.log(`User input: ${userInput.substring(0, 100)}...`);
    
    // Store session
    this.sessions.set(sessionId, {
      id: sessionId,
      userInput,
      status: 'starting',
      startTime: new Date(),
      results: null,
      error: null
    });
    
    try {
      // Run Python script
      const result = await this._runPythonScript({
        command: 'run_thinking',
        user_input: userInput,
        session_id: sessionId
      });
      
      // Update session
      const session = this.sessions.get(sessionId);
      if (result.success) {
        session.status = 'running';
        session.taskId = result.task_id;
        
        // Start polling for updates
        this._pollSessionUpdates(sessionId);
      } else {
        session.status = 'failed';
        session.error = result.error;
        session.endTime = new Date();
      }
      
      this.sessions.set(sessionId, session);
      
      return {
        success: true,
        session_id: sessionId,
        message: 'Thinking session started. The crew is analyzing your problem.',
        current_phase: 'anchor',
        next_steps: [
          'The anchor agent is defining your core problem',
          'Check back in a few moments for updates'
        ]
      };
      
    } catch (error) {
      console.error('Error starting thinking session:', error);
      
      const session = this.sessions.get(sessionId);
      session.status = 'failed';
      session.error = error.message;
      session.endTime = new Date();
      this.sessions.set(sessionId, session);
      
      return {
        success: false,
        error: `Failed to start thinking session: ${error.message}`,
        session_id: sessionId
      };
    }
  }
  
  /**
   * Get session status
   */
  async getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      // Try to load from file
      try {
        const sessionFile = path.join(this.crewaiDir, 'output', 'sessions', `${sessionId}.json`);
        if (fs.existsSync(sessionFile)) {
          const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
          return {
            success: true,
            session_id: sessionId,
            status: 'completed',
            completed: true,
            data: data,
            message: 'Session completed earlier'
          };
        }
      } catch (error) {
        // Ignore file errors
      }
      
      return {
        success: false,
        error: `Session not found: ${sessionId}`
      };
    }
    
    if (session.status === 'completed' && session.results) {
      return {
        success: true,
        session_id: sessionId,
        status: 'completed',
        completed: true,
        data: session.results,
        message: 'Thinking session completed'
      };
    }
    
    // Calculate progress based on phase
    const phases = ['anchor', 'assumptions', 'root_cause', 'solution', 'mindmap'];
    const currentPhase = session.currentPhase || 'anchor';
    const phaseIndex = phases.indexOf(currentPhase);
    const progress = phaseIndex >= 0 ? ((phaseIndex + 1) / phases.length) * 100 : 0;
    
    return {
      success: true,
      session_id: sessionId,
      status: session.status,
      completed: false,
      current_phase: currentPhase,
      progress: Math.round(progress),
      elapsed_seconds: (new Date() - session.startTime) / 1000,
      message: `Thinking in progress: ${currentPhase.replace('_', ' ')} phase`
    };
  }
  
  /**
   * List recent sessions
   */
  async listSessions(limit = 10) {
    const sessions = [];
    
    // Add active sessions
    for (const [sessionId, session] of this.sessions) {
      sessions.push({
        session_id: sessionId,
        status: session.status,
        user_input_preview: session.userInput ? session.userInput.substring(0, 100) + '...' : '',
        start_time: session.startTime.toISOString(),
        elapsed_seconds: (new Date() - session.startTime) / 1000
      });
    }
    
    // Add completed sessions from files
    try {
      const sessionsDir = path.join(this.crewaiDir, 'output', 'sessions');
      if (fs.existsSync(sessionsDir)) {
        const files = fs.readdirSync(sessionsDir)
          .filter(f => f.endsWith('.json'))
          .sort()
          .reverse()
          .slice(0, limit);
        
        for (const file of files) {
          try {
            const sessionId = file.replace('.json', '');
            const filePath = path.join(sessionsDir, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            sessions.push({
              session_id: sessionId,
              status: 'completed',
              user_input_preview: data.user_input ? data.user_input.substring(0, 100) + '...' : '',
              start_time: data.timestamp || new Date(fs.statSync(filePath).mtime).toISOString(),
              elapsed_seconds: data.duration_seconds || 0
            });
          } catch (error) {
            console.warn(`Error reading session file ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Error reading sessions directory:', error);
    }
    
    // Sort by start time (newest first)
    sessions.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    
    return {
      success: true,
      sessions: sessions.slice(0, limit),
      count: sessions.length
    };
  }
  
  /**
   * Health check
   */
  async healthCheck() {
    try {
      // Check if Python is available
      const pythonCheck = await this._runPythonScript({ command: 'health' });
      
      return {
        status: pythonCheck.success ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        service: 'crewai_bridge',
        details: {
          python_available: pythonCheck.success,
          crewai_dir_exists: fs.existsSync(this.crewaiDir),
          active_sessions: this.sessions.size,
          is_running: this.isRunning
        },
        ...(pythonCheck.success ? {} : { error: pythonCheck.error })
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
  
  /**
   * Run Python script and get result
   */
  async _runPythonScript(data) {
    return new Promise((resolve, reject) => {
      try {
        const scriptPath = path.join(__dirname, 'crewai-runner.py');
        const input = JSON.stringify(data);
        
        const python = spawn(this.pythonPath, [scriptPath], {
          cwd: this.crewaiDir,
          env: {
            ...process.env,
            PYTHONPATH: path.join(this.crewaiDir, 'src')
          }
        });
        
        let stdout = '';
        let stderr = '';
        
        python.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        python.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        python.on('close', (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              resolve(result);
            } catch (error) {
              reject(new Error(`Failed to parse Python output: ${error.message}\nOutput: ${stdout}`));
            }
          } else {
            reject(new Error(`Python script failed with code ${code}\nStderr: ${stderr}`));
          }
        });
        
        python.on('error', (error) => {
          reject(new Error(`Failed to spawn Python process: ${error.message}`));
        });
        
        // Send input
        python.stdin.write(input);
        python.stdin.end();
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Poll for session updates
   */
  async _pollSessionUpdates(sessionId) {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;
    
    const poll = async () => {
      if (attempts >= maxAttempts) {
        const session = this.sessions.get(sessionId);
        session.status = 'timeout';
        session.endTime = new Date();
        this.sessions.set(sessionId, session);
        return;
      }
      
      attempts++;
      
      try {
        const result = await this._runPythonScript({
          command: 'check_status',
          session_id: sessionId
        });
        
        const session = this.sessions.get(sessionId);
        
        if (result.success) {
          if (result.completed) {
            session.status = 'completed';
            session.results = result.data;
            session.endTime = new Date();
            this.sessions.set(sessionId, session);
            return; // Stop polling
          } else {
            session.status = 'running';
            session.currentPhase = result.current_phase;
            session.progress = result.progress;
            this.sessions.set(sessionId, session);
            
            // Continue polling after delay
            setTimeout(poll, 2000); // Poll every 2 seconds
          }
        } else {
          session.status = 'failed';
          session.error = result.error;
          session.endTime = new Date();
          this.sessions.set(sessionId, session);
        }
        
      } catch (error) {
        console.error(`Error polling session ${sessionId}:`, error);
        
        const session = this.sessions.get(sessionId);
        session.status = 'error';
        session.error = error.message;
        session.endTime = new Date();
        this.sessions.set(sessionId, session);
      }
    };
    
    // Start polling
    setTimeout(poll, 1000);
  }
}

// Create singleton instance
const crewaiBridge = new CrewAIBridge();

module.exports = crewaiBridge;