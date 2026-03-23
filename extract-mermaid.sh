#!/bin/bash

# Script to extract mermaid diagrams from README
# Usage: ./extract-mermaid.sh

echo "Extracting mermaid diagrams from README.md..."

# Extract first diagram
sed -n '/```mermaid/,/```/p' README.md | head -20 > diagram1.mmd

echo "✅ Diagrams extracted!"
echo "Now you can:"
echo "1. Go to https://mermaid.live/ and paste the code"
echo "2. Or install mermaid-cli: npm install -g @mermaid-js/mermaid-cli"
echo "3. Then run: mmdc -i diagram1.mmd -o diagram1.png"




