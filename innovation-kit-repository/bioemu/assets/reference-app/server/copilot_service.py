"""
BioEmu copilot experience Service - AI-powered scientific explanations
"""

import os
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from openai import AzureOpenAI, OpenAI

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Directory containing prompt files
PROMPTS_DIR = Path(__file__).parent / "prompts"


def _load_prompt(filename: str) -> str:
    """Load a prompt file from the prompts directory."""
    filepath = PROMPTS_DIR / filename
    try:
        return filepath.read_text(encoding="utf-8")
    except FileNotFoundError:
        logger.warning(f"Prompt file not found: {filepath}")
        return ""


class BioEmuCopilot:
    """AI copilot for scientific explanations using Azure OpenAI or GitHub Models"""

    def __init__(self):
        self.client = None
        self.client_type = None  # 'azure' or 'github'
        # Azure deployment name (configurable via environment)
        self.model = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini")
        self.initialize_client()

    def initialize_client(self):
        """Initialize Azure OpenAI or GitHub Models client"""
        # Try GitHub Models first if token is available
        github_token = os.getenv("GITHUB_TOKEN")
        if github_token:
            try:
                self.client = OpenAI(
                    base_url="https://models.inference.ai.azure.com",
                    api_key=github_token,
                )
                self.client_type = "github"
                # Use GitHub Models model name
                self.model = os.getenv("GITHUB_MODEL", "gpt-4o-mini")
                logger.info("GitHub Models client initialized successfully")
                return
            except Exception as e:
                logger.error(f"Failed to initialize GitHub Models client: {e}")

        # Fall back to Azure OpenAI
        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")

        if api_key and endpoint:
            try:
                self.client = AzureOpenAI(
                    api_key=api_key, azure_endpoint=endpoint, api_version=api_version
                )
                self.client_type = "azure"
                logger.info("Azure OpenAI client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Azure OpenAI client: {e}")
                self.client = None
        else:
            logger.warning(
                "Missing credentials. Set either GITHUB_TOKEN for GitHub Models "
                "or AZURE_OPENAI_API_KEY/AZURE_OPENAI_ENDPOINT for Azure OpenAI"
            )

    def is_available(self) -> bool:
        """Check if copilot service is available"""
        return self.client is not None

    def get_system_prompt(
        self, question_type: str = "general", user_level: str = "beginner"
    ) -> str:
        """
        Build system prompt by composing base + level + focus prompts from files.

        This approach eliminates duplication by:
        1. Loading shared context from copilot-base.md
        2. Appending level-specific style from copilot-{level}.md
        3. Appending question-type focus from copilot-focus.md
        """
        # Load base prompt (shared across all levels)
        base_prompt = _load_prompt("copilot-base.md")

        # Load level-specific additions
        level_prompt = _load_prompt(f"copilot-{user_level}.md")

        # Load focus instructions and extract the relevant section
        focus_prompt = self._get_focus_section(question_type, user_level)

        # Compose final prompt
        parts = [base_prompt]
        if level_prompt:
            parts.append(level_prompt)
        if focus_prompt:
            parts.append(f"\n## Current Focus\n\n{focus_prompt}")

        return "\n\n".join(parts)

    def _get_focus_section(self, question_type: str, user_level: str) -> str:
        """Extract the appropriate focus section based on question type and level."""
        focus_content = _load_prompt("copilot-focus.md")
        if not focus_content:
            return ""

        # Map question types to section headers in the focus file
        section_map = {
            ("interface", "beginner"): "## Interface Questions",
            ("interface", "intermediate"): "## Interface Questions",
            ("interface", "expert"): "## Interface Questions",
            ("science", "beginner"): "## Science Questions (General)",
            ("science", "intermediate"): "## Science Questions (General)",
            ("science", "expert"): "## Science Questions (Expert)",
            ("analysis", "beginner"): "## Analysis Questions (General)",
            ("analysis", "intermediate"): "## Analysis Questions (General)",
            ("analysis", "expert"): "## Analysis Questions (Expert)",
            ("general", "beginner"): "## General Questions",
            ("general", "intermediate"): "## General Questions",
            ("general", "expert"): "## General Questions (Expert)",
        }

        target_section = section_map.get(
            (question_type, user_level), "## General Questions"
        )

        # Extract section content
        lines = focus_content.split("\n")
        in_section = False
        section_lines = []

        for line in lines:
            if line.startswith("## "):
                if in_section:
                    break  # End of our section
                if line.strip() == target_section.strip():
                    in_section = True
                    continue  # Skip the header itself
            elif in_section:
                section_lines.append(line)

        return "\n".join(section_lines).strip()

    def categorize_question(self, message: str) -> str:
        """Categorize user question to apply appropriate prompting"""
        message_lower = message.lower()

        # Interface/navigation questions
        interface_keywords = [
            "how to",
            "where is",
            "how do i",
            "click",
            "button",
            "tab",
            "menu",
            "navigate",
            "find",
            "use",
        ]
        if any(keyword in message_lower for keyword in interface_keywords):
            return "interface"

        # Advanced science questions (expert-level indicators)
        expert_science_keywords = [
            "rmsd",
            "radius of gyration",
            "conformational entropy",
            "ensemble statistics",
            "boltzmann",
            "sampling",
            "convergence",
            "statistical",
            "methodology",
            "algorithm",
            "force field",
            "molecular dynamics",
            "free energy",
            "thermodynamics",
            "kinetics",
        ]

        # Science/concept questions
        science_keywords = [
            "what is",
            "explain",
            "why does",
            "protein",
            "fold",
            "structure",
            "amino acid",
            "molecular",
            "secondary structure",
            "tertiary",
            "quaternary",
            "alphafold",
            "prediction",
            "bioemu",
        ]

        if any(keyword in message_lower for keyword in expert_science_keywords):
            return "science"  # Will get expert-level treatment based on user level
        elif any(keyword in message_lower for keyword in science_keywords):
            return "science"

        # Analysis/data interpretation questions
        analysis_keywords = [
            "result",
            "chart",
            "graph",
            "pca",
            "rmsd",
            "energy",
            "analysis",
            "data",
            "interpret",
            "what does",
            "meaning",
            "significance",
            "visualization",
            "compare",
            "difference",
            "correlation",
        ]
        if any(keyword in message_lower for keyword in analysis_keywords):
            return "analysis"

        return "general"

    def format_context_info(self, context: Dict[str, Any]) -> str:
        """Format context information for the AI prompt - enhanced but concise"""
        if not context:
            return ""

        info = []

        # Current location and workflow state - use proper tab names
        if context.get("activeTabName"):
            tab_name = context["activeTabName"]
            if context.get("lastAction") == "analyzing":
                info.append(f"User is analyzing on: {tab_name} tab")
            elif context.get("lastAction") == "viewing_results":
                info.append(f"User viewing results on: {tab_name} tab")
            else:
                info.append(f"User is on: {tab_name} tab")
        elif context.get("activeTab"):
            # Fallback to tab ID if name not available
            tab = context["activeTab"]
            info.append(f"User is on: {tab} tab")

        # Protein information with identity when available
        if context.get("currentSequence"):
            seq_len = len(context["currentSequence"])
            protein_name = context.get("proteinName")
            uniprot_id = context.get("uniprotId")

            if protein_name and protein_name != "Custom Sequence":
                info.append(f"Protein: {protein_name} ({seq_len} AA)")
            elif uniprot_id:
                info.append(f"Protein: {uniprot_id} ({seq_len} AA)")
            else:
                info.append(f"Custom sequence ({seq_len} AA)")

        # Available data capabilities - be specific about where things are
        data_types = []
        if context.get("hasTrajectoryData"):
            data_types.append("3D ensemble trajectory")
        if context.get("hasAnalysisData"):
            if context.get("hasFlexibilityData"):
                data_types.append("flexibility analysis")
            if context.get("hasEnergyData"):
                data_types.append("energy landscape data")

        # AlphaFold structure - clarify it's only on dedicated tab
        if context.get("hasAlphaFoldStructure"):
            alphafold_tab = context.get(
                "alphaFoldAvailableOnTab", "BioEmu + AlphaFold tab"
            )
            data_types.append(f"AlphaFold structure (on {alphafold_tab})")

        if data_types:
            info.append(f"Available: {', '.join(data_types)}")

        # User experience level for response adaptation
        user_level = context.get("userLevel", "beginner")
        if user_level == "expert":
            info.append("Mode: expert (detailed analysis)")
            # Add expert-specific context
            if context.get("rmsdRange"):
                rmsd = context["rmsdRange"]
                info.append(
                    f"RMSD range: {rmsd['min']:.2f}-{rmsd['max']:.2f} Å ({rmsd['frameCount']} frames)"
                )
        elif user_level == "intermediate":
            info.append("Mode: intermediate")
        else:
            info.append("Mode: beginner-friendly")

        return " | ".join(info) if info else ""

    def get_fallback_response(self, message: str, context: Dict) -> str:
        """Provide fallback when AI is not available with quick answers"""
        message_lower = message.lower()

        # Quick interface help - use correct tab names
        if "how to" in message_lower or "how do i" in message_lower:
            if "sequence" in message_lower:
                return "To input a sequence: Go to the Generate tab → Choose Manual/UniProt/PDB → Enter your data → Click Generate Ensemble."
            elif "pdb" in message_lower:
                return "To use PDB: Go to the Generate tab → Click PDB ID tab → Enter PDB ID and Chain → Click Fetch."
            elif "uniprot" in message_lower:
                return "To use UniProt: Go to the Generate tab → Click UniProt ID tab → Enter ID → Press Enter or click Fetch."
            elif "structure" in message_lower or "visualization" in message_lower:
                return "To view structures: The Structure tab shows ensemble structures. The BioEmu + AlphaFold tab compares with AlphaFold predictions."
            elif "alphafold" in message_lower:
                return "AlphaFold structures are available in the 'BioEmu + AlphaFold' tab for comparison with BioEmu ensemble predictions."

        # Tab navigation help
        if any(word in message_lower for word in ["tab", "where", "find"]):
            if "alphafold" in message_lower:
                return "AlphaFold predictions are in the 'BioEmu + AlphaFold' tab (separate from BioEmu Structure Explorer)."
            elif "conformational" in message_lower or "explorer" in message_lower:
                return "Interactive exploration is in the 'Conformational Explorer' tab with 2D/3D views."

        # Protein recommendations
        if any(
            word in message_lower
            for word in [
                "recommend",
                "suggest",
                "example",
                "good protein",
                "test",
                "protein",
            ]
        ):
            return "Try our example proteins: Villin Headpiece (HP35) - fast folding, Trp-cage TC5b - smallest protein, Polyubiquitin-B (P0CG47) - includes demo data, or Crambin (P01542) - classic test case. Click the example buttons in the Generate tab!"

        # Clarify BioEmu vs BioEmu Explorer distinction
        if "bioemu" in message_lower and (
            "what is" in message_lower or "explain" in message_lower
        ):
            return "BioEmu Explorer is this web application for protein analysis visualization. BioEmu is Microsoft's underlying protein simulation model. I help with using this application interface."

        # Science concepts
        if any(word in message_lower for word in ["protein", "fold", "structure"]):
            return "Proteins are molecular machines that fold into specific 3D shapes. Their sequence determines their structure, which determines their function. I need Azure OpenAI credentials for detailed explanations."

        # General fallback
        return "I'm the BioEmu copilot experience! I help with navigating this web application and understanding protein analysis results. Configure Azure OpenAI credentials for full AI responses."

    async def get_response(
        self,
        message: str,
        context: Optional[Dict] = None,
        history: Optional[List] = None,
    ) -> Dict[str, Any]:
        """Get AI response to user message with question categorization"""
        context = context or {}
        history = history or []

        if not self.is_available():
            return {
                "response": self.get_fallback_response(message, context),
                "context": context,
                "source": "fallback",
            }

        try:
            # Categorize question for appropriate prompting
            question_type = self.categorize_question(message)
            context_info = self.format_context_info(context)

            # Extract user level from context
            user_level = context.get("userLevel", "beginner")

            # Use categorized system prompt with user level
            system_prompt = self.get_system_prompt(question_type, user_level)
            messages = [{"role": "system", "content": system_prompt}]

            # Add context if available (simplified)
            if context_info:
                messages.append(
                    {"role": "system", "content": f"Context: {context_info}"}
                )

            # Add recent history (reduced to 2 exchanges)
            for entry in history[-2:]:
                if "user" in entry:
                    messages.append({"role": "user", "content": entry["user"]})
                if "assistant" in entry:
                    messages.append(
                        {"role": "assistant", "content": entry["assistant"]}
                    )

            messages.append({"role": "user", "content": message})

            # Increased token and timeout limits to reduce response truncation
            # Dynamic response length based on user level and question type
            if user_level == "expert":
                max_tokens = 1024 if question_type == "science" else 700
            elif question_type == "interface":
                max_tokens = 500  # Interface help usually fits within this
            else:
                max_tokens = 700 if user_level == "intermediate" else 500

            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.7,
                timeout=60,
            )

            ai_response = response.choices[0].message.content.strip()

            return {
                "response": ai_response,
                "context": context,
                "source": "openai",
                "question_type": question_type,
            }

        except Exception as e:
            logger.error(f"Error getting AI response: {e}")
            return {
                "response": self.get_fallback_response(message, context),
                "context": context,
                "source": "fallback_error",
            }


# Global instance
copilot = BioEmuCopilot()

# Simple cache for repeated identical questions (max 32 entries)
_response_cache: Dict[str, Dict[str, Any]] = {}
_CACHE_MAX_SIZE = 32


def get_copilot_response(
    message: str, context: Optional[Dict] = None, history: Optional[List] = None
) -> Dict[str, Any]:
    """Get copilot response (sync wrapper) with simple caching for repeated questions"""
    import asyncio

    # Create cache key from message only (context/history changes invalidate)
    cache_key = message.strip().lower()
    if not context and not history and cache_key in _response_cache:
        cached = _response_cache[cache_key].copy()
        cached["source"] = cached.get("source", "ai") + "_cached"
        return cached

    try:
        response = asyncio.run(copilot.get_response(message, context, history))

        # Cache simple questions without context/history
        if not context and not history and response.get("source") != "fallback":
            # Evict oldest if at capacity
            if len(_response_cache) >= _CACHE_MAX_SIZE:
                oldest_key = next(iter(_response_cache))
                del _response_cache[oldest_key]
            _response_cache[cache_key] = response

        return response
    except RuntimeError:
        # Fallback if asyncio issues
        return {
            "response": copilot.get_fallback_response(message, context or {}),
            "context": context or {},
            "source": "fallback_sync",
        }
