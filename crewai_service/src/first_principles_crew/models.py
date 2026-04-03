from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class ThinkingPhase(str, Enum):
    ANCHOR = "anchor"
    ASSUMPTIONS = "assumptions"
    ROOT_CAUSE = "root_cause"
    SOLUTION = "solution"
    MINDMAP = "mindmap"


class ProblemStatement(BaseModel):
    """Clear problem statement from anchor phase"""
    core_problem: str = Field(description="The fundamental problem to solve")
    key_questions: List[str] = Field(description="2-3 key questions to guide thinking")
    context: Optional[str] = Field(default=None, description="Additional context")
    reframed_problem: Optional[str] = Field(default=None, description="Reframed version of the problem")


class AssumptionCategory(str, Enum):
    FACTUAL = "factual"
    VALUE = "value"
    HIDDEN = "hidden"
    CULTURAL = "cultural"
    TECHNICAL = "technical"


class Assumption(BaseModel):
    """An identified assumption"""
    assumption: str = Field(description="The assumption being made")
    category: AssumptionCategory = Field(description="Category of assumption")
    why_questionable: str = Field(description="Why this assumption might be wrong")
    alternatives: List[str] = Field(description="Alternative possibilities if assumption is false")
    impact_if_wrong: Optional[str] = Field(default=None, description="Impact if this assumption is wrong")


class AssumptionAnalysis(BaseModel):
    """Analysis of assumptions from assumption challenge phase"""
    assumptions: List[Assumption] = Field(description="List of identified assumptions")
    most_critical: List[str] = Field(description="Most critical assumptions to question")
    insights: List[str] = Field(description="Key insights from challenging assumptions")


class RootCauseAnalysis(BaseModel):
    """Root cause analysis from digging deep"""
    why_chain: List[str] = Field(description="Chain of 'why' questions and answers")
    root_causes: List[str] = Field(description="Identified root causes")
    first_principles: List[str] = Field(description="First principles discovered")
    systems_insights: List[str] = Field(description="Systems-level insights")
    symptoms_vs_causes: Dict[str, str] = Field(description="Mapping of symptoms to their causes")


class SolutionApproach(BaseModel):
    """A possible solution approach"""
    name: str = Field(description="Name of the approach")
    description: str = Field(description="Description of the approach")
    based_on_principles: List[str] = Field(description="First principles this approach is based on")
    pros: List[str] = Field(description="Advantages of this approach")
    cons: List[str] = Field(description="Disadvantages of this approach")
    feasibility: float = Field(ge=0, le=1, description="Feasibility score 0-1")


class SolutionDesign(BaseModel):
    """Solution design from first principles"""
    core_requirements: List[str] = Field(description="Requirements derived from first principles")
    approaches: List[SolutionApproach] = Field(description="Multiple solution approaches")
    recommended_approach: SolutionApproach = Field(description="Recommended solution approach")
    justification: str = Field(description="Justification for the recommendation")
    implementation_steps: List[str] = Field(description="High-level implementation steps")


class MindMapNode(BaseModel):
    """A node in the mind map"""
    id: str = Field(description="Unique identifier for the node")
    label: str = Field(description="Label/text for the node")
    level: int = Field(description="Hierarchy level (0 = root)")
    parent_id: Optional[str] = Field(default=None, description="Parent node ID")
    color: Optional[str] = Field(default=None, description="Color for visualization")


class MindMap(BaseModel):
    """Complete mind map visualization"""
    title: str = Field(description="Title of the mind map")
    nodes: List[MindMapNode] = Field(description="All nodes in the mind map")
    connections: List[Dict[str, str]] = Field(description="Connections between nodes")
    mermaid_syntax: str = Field(description="Mermaid.js syntax for rendering")


class ThinkingSession(BaseModel):
    """Complete thinking session"""
    session_id: str = Field(description="Unique session identifier")
    user_input: str = Field(description="Original user input")
    problem_statement: ProblemStatement
    assumption_analysis: AssumptionAnalysis
    root_cause_analysis: RootCauseAnalysis
    solution_design: SolutionDesign
    mind_map: MindMap
    timestamp: str = Field(description="When the session was created")
    duration_seconds: float = Field(description="How long the thinking took")


class ChatMessage(BaseModel):
    """A message in the chat conversation"""
    role: str = Field(description="Role: user, assistant, or system")
    content: str = Field(description="Content of the message")
    timestamp: str = Field(description="When the message was sent")
    phase: Optional[ThinkingPhase] = Field(default=None, description="Thinking phase when sent")


class CrewAIResponse(BaseModel):
    """Response from CrewAI service"""
    success: bool = Field(description="Whether the request was successful")
    session_id: Optional[str] = Field(default=None, description="Session ID if successful")
    error: Optional[str] = Field(default=None, description="Error message if failed")
    current_phase: Optional[ThinkingPhase] = Field(default=None, description="Current thinking phase")
    message: Optional[str] = Field(default=None, description="Response message")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Response data")
    next_steps: Optional[List[str]] = Field(default=None, description="Suggested next steps")