#!/bin/bash
# TokenWise Proxy Demo
#
# Terminal 1: Start the proxy
#   OPENAI_API_KEY=sk-... npx tokenwise proxy --port 8787 --verbose
#
# Terminal 2: Test with curl
echo "Testing TokenWise Proxy..."
echo ""

# Simple chat completion through the proxy
curl -s http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "What is 2+2? Answer in one word."}
    ]
  }' | python3 -m json.tool

echo ""
echo "--- Savings Report ---"
curl -s http://localhost:8787/v1/tokenwise/report \
  -H "Authorization: Bearer $OPENAI_API_KEY"
