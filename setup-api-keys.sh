#!/bin/bash

# Tyche Finance - API Key Setup Script
# This script helps you configure AI provider API keys

echo "🔑 Tyche Finance - API Key Setup"
echo "================================"
echo ""

# Check if ~/.zshrc exists
if [ ! -f ~/.zshrc ]; then
    echo "Creating ~/.zshrc file..."
    touch ~/.zshrc
fi

# Function to add or update an API key
add_api_key() {
    local key_name=$1
    local key_value=$2
    
    # Remove existing key if present
    sed -i '' "/export ${key_name}=/d" ~/.zshrc 2>/dev/null
    
    # Add new key
    echo "export ${key_name}=\"${key_value}\"" >> ~/.zshrc
    
    echo "✅ ${key_name} added to ~/.zshrc"
}

echo "This script will add your API keys to ~/.zshrc"
echo "Keys will be available in all future terminal sessions"
echo ""

# OpenAI
read -p "Enter your OpenAI API key (or press Enter to skip): " openai_key
if [ ! -z "$openai_key" ]; then
    add_api_key "OPENAI_API_KEY" "$openai_key"
    export OPENAI_API_KEY="$openai_key"
fi

# Anthropic Claude
read -p "Enter your Anthropic API key (or press Enter to skip): " anthropic_key
if [ ! -z "$anthropic_key" ]; then
    add_api_key "ANTHROPIC_API_KEY" "$anthropic_key"
    export ANTHROPIC_API_KEY="$anthropic_key"
fi

# xAI Grok
read -p "Enter your xAI (Grok) API key (or press Enter to skip): " xai_key
if [ ! -z "$xai_key" ]; then
    add_api_key "XAI_API_KEY" "$xai_key"
    export XAI_API_KEY="$xai_key"
fi

# DeepSeek
read -p "Enter your DeepSeek API key (or press Enter to skip): " deepseek_key
if [ ! -z "$deepseek_key" ]; then
    add_api_key "DEEPSEEK_API_KEY" "$deepseek_key"
    export DEEPSEEK_API_KEY="$deepseek_key"
fi

echo ""
echo "✅ API keys configured!"
echo ""
echo "Current session has been updated."
echo "For new terminals, run: source ~/.zshrc"
echo ""
echo "To verify, run:"
echo "  echo \$OPENAI_API_KEY"
echo "  echo \$ANTHROPIC_API_KEY"
echo ""
