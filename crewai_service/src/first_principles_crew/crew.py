from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai_tools import SerperDevTool, FileReadTool, DirectorySearchTool
from typing import List, Optional, Dict, Any
import os
from datetime import datetime
import json

from .models import (
    ProblemStatement,
    AssumptionAnalysis,
    RootCauseAnalysis,
    SolutionDesign,
    ThinkingPhase,
    ThinkingSession,
    CrewAIResponse
)


@CrewBase
class FirstPrinciplesCrew:
    """First Principles Thinking Coach Crew"""
    
    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'
    
    def __init__(self):
        self.session_id = None
        self.user_input = None
        self.results = {}
        self.start_time = None
        
    @agent
    def anchor_agent(self) -> Agent:
        """Agent that helps define the core problem"""
        return Agent(
            config=self.agents_config['anchor_agent'],
            verbose=True,
            tools=[
                FileReadTool(),
                DirectorySearchTool()
            ]
        )
    
    @agent
    def assumption_challenger(self) -> Agent:
        """Agent that challenges assumptions"""
        return Agent(
            config=self.agents_config['assumption_challenger'],
            verbose=True,
            tools=[
                SerperDevTool(),
                FileReadTool()
            ]
        )
    
    @agent
    def root_cause_analyst(self) -> Agent:
        """Agent that finds root causes"""
        return Agent(
            config=self.agents_config['root_cause_analyst'],
            verbose=True,
            tools=[
                SerperDevTool(),
                DirectorySearchTool()
            ]
        )
    
    @agent
    def solution_architect(self) -> Agent:
        """Agent that designs solutions from first principles"""
        return Agent(
            config=self.agents_config['solution_architect'],
            verbose=True,
            tools=[
                FileReadTool(),
                DirectorySearchTool()
            ]
        )
    
    @agent
    def mindmap_creator(self) -> Agent:
        """Agent that creates visual mind maps"""
        return Agent(
            config=self.agents_config['mindmap_creator'],
            verbose=True,
            tools=[
                FileReadTool()
            ]
        )
    
    @task
    def anchor_task(self) -> Task:
        """Task to define the core problem"""
        return Task(
            config=self.tasks_config['anchor_task'],
            agent=self.anchor_agent(),
            output_json=True,
            output_pydantic=ProblemStatement,
            context=[],
            callback=lambda result: self._store_result('problem_statement', result)
        )
    
    @task
    def assumption_challenge_task(self) -> Task:
        """Task to challenge assumptions"""
        return Task(
            config=self.tasks_config['assumption_challenge_task'],
            agent=self.assumption_challenger(),
            output_json=True,
            output_pydantic=AssumptionAnalysis,
            context=[self.anchor_task],
            callback=lambda result: self._store_result('assumption_analysis', result)
        )
    
    @task
    def root_cause_analysis_task(self) -> Task:
        """Task to find root causes"""
        return Task(
            config=self.tasks_config['root_cause_analysis_task'],
            agent=self.root_cause_analyst(),
            output_json=True,
            output_pydantic=RootCauseAnalysis,
            context=[self.anchor_task, self.assumption_challenge_task],
            callback=lambda result: self._store_result('root_cause_analysis', result)
        )
    
    @task
    def solution_design_task(self) -> Task:
        """Task to design solutions"""
        return Task(
            config=self.tasks_config['solution_design_task'],
            agent=self.solution_architect(),
            output_json=True,
            output_pydantic=SolutionDesign,
            context=[
                self.anchor_task,
                self.assumption_challenge_task,
                self.root_cause_analysis_task
            ],
            callback=lambda result: self._store_result('solution_design', result)
        )
    
    @task
    def mindmap_creation_task(self) -> Task:
        """Task to create mind map"""
        return Task(
            config=self.tasks_config['mindmap_creation_task'],
            agent=self.mindmap_creator(),
            output_file='output/mindmap.md',
            context=[
                self.anchor_task,
                self.assumption_challenge_task,
                self.root_cause_analysis_task,
                self.solution_design_task
            ],
            callback=lambda result: self._store_result('mind_map', result)
        )
    
    @crew
    def crew(self) -> Crew:
        """Create the complete crew"""
        return Crew(
            agents=[
                self.anchor_agent(),
                self.assumption_challenger(),
                self.root_cause_analyst(),
                self.solution_architect(),
                self.mindmap_creator()
            ],
            tasks=[
                self.anchor_task(),
                self.assumption_challenge_task(),
                self.root_cause_analysis_task(),
                self.solution_design_task(),
                self.mindmap_creation_task()
            ],
            process=Process.sequential,
            verbose=True,
            memory=True,
            full_output=True
        )
    
    def _store_result(self, key: str, result: Any):
        """Store result from a task"""
        self.results[key] = result
        print(f"Stored result for {key}: {type(result).__name__}")
    
    def create_thinking_session(self, user_input: str) -> ThinkingSession:
        """Create a complete thinking session from results"""
        if not all(key in self.results for key in [
            'problem_statement', 'assumption_analysis',
            'root_cause_analysis', 'solution_design', 'mind_map'
        ]):
            raise ValueError("Not all thinking phases are complete")
        
        duration = (datetime.now() - self.start_time).total_seconds()
        
        return ThinkingSession(
            session_id=self.session_id,
            user_input=user_input,
            problem_statement=self.results['problem_statement'],
            assumption_analysis=self.results['assumption_analysis'],
            root_cause_analysis=self.results['root_cause_analysis'],
            solution_design=self.results['solution_design'],
            mind_map=self.results['mind_map'],
            timestamp=datetime.now().isoformat(),
            duration_seconds=duration
        )
    
    def run_complete_thinking(self, user_input: str, session_id: Optional[str] = None) -> ThinkingSession:
        """Run complete first principles thinking process"""
        self.start_time = datetime.now()
        self.user_input = user_input
        self.session_id = session_id or f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        print(f"Starting thinking session: {self.session_id}")
        print(f"User input: {user_input}")
        
        # Run the crew
        inputs = {'topic': user_input}
        result = self.crew().kickoff(inputs=inputs)
        
        print(f"Thinking completed in {(datetime.now() - self.start_time).total_seconds():.1f} seconds")
        
        # Create thinking session
        session = self.create_thinking_session(user_input)
        
        # Save session to file
        self._save_session(session)
        
        return session
    
    def run_phase(self, phase: ThinkingPhase, context: Dict[str, Any]) -> Any:
        """Run a specific thinking phase"""
        if phase == ThinkingPhase.ANCHOR:
            task = self.anchor_task()
        elif phase == ThinkingPhase.ASSUMPTIONS:
            task = self.assumption_challenge_task()
        elif phase == ThinkingPhase.ROOT_CAUSE:
            task = self.root_cause_analysis_task()
        elif phase == ThinkingPhase.SOLUTION:
            task = self.solution_design_task()
        elif phase == ThinkingPhase.MINDMAP:
            task = self.mindmap_creation_task()
        else:
            raise ValueError(f"Unknown phase: {phase}")
        
        # Execute the task
        result = task.execute(context)
        self._store_result(phase.value, result)
        
        return result
    
    def _save_session(self, session: ThinkingSession):
        """Save thinking session to file"""
        os.makedirs('output/sessions', exist_ok=True)
        filename = f"output/sessions/{session.session_id}.json"
        
        with open(filename, 'w') as f:
            json.dump(session.model_dump(), f, indent=2, ensure_ascii=False)
        
        print(f"Session saved to {filename}")
    
    def load_session(self, session_id: str) -> Optional[ThinkingSession]:
        """Load a thinking session from file"""
        filename = f"output/sessions/{session_id}.json"
        
        if not os.path.exists(filename):
            return None
        
        with open(filename, 'r') as f:
            data = json.load(f)
        
        return ThinkingSession(**data)