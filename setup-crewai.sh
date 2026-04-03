#!/bin/bash
# Setup script for CrewAI integration

set -e

echo "🚀 Setting up CrewAI integration for First Principles..."

# Check Python version
echo "Checking Python version..."
python3 --version

if ! command -v uv &> /dev/null; then
    echo "Installing uv (Python package manager)..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# Install CrewAI CLI
echo "Installing CrewAI CLI..."
uv tool install crewai

# Create virtual environment
echo "Creating Python virtual environment..."
cd crewai_service
uv venv

# Activate virtual environment
source .venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
uv pip install -e .

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "Please edit .env file with your API keys"
    else
        echo "Error: .env.example not found"
        exit 1
    fi
fi

# Create necessary directories
echo "Creating output directories..."
mkdir -p output/sessions
mkdir -p output/mindmaps
mkdir -p logs

# Test the installation
echo "Testing CrewAI installation..."
if python3 -c "import crewai; print('CrewAI version:', crewai.__version__)"; then
    echo "✅ CrewAI installed successfully"
else
    echo "❌ CrewAI installation failed"
    exit 1
fi

# Test the service
echo "Testing First Principles CrewAI service..."
if python3 -m src.first_principles_crew.main --help; then
    echo "✅ First Principles CrewAI service is working"
else
    echo "❌ First Principles CrewAI service test failed"
    exit 1
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit crewai_service/.env file with your API keys"
echo "2. Start the Express server: npm run dev"
echo "3. Test CrewAI integration: http://localhost:4322/crewai-test.html"
echo ""
echo "Required API keys:"
echo "- OPENAI_API_KEY or DEEPSEEK_API_KEY"
echo "- Optional: SERPER_API_KEY for web search"
echo "- Optional: TAVILY_API_KEY for enhanced search"
echo ""
echo "To run a test:"
echo "  cd crewai_service"
echo "  python3 -m src.first_principles_crew.main --input 'How can I improve my productivity?'"