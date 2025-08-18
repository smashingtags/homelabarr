const fs = require('fs');

const content = fs.readFileSync('src/data/templates.ts', 'utf8');

// Look for templates starting with {<space>name: or {<space>id:
const pattern = /^\s*{\s*(?:name|id):\s*['"`]/gm;
let matches = 0;
let match;
const foundTemplates = [];

while ((match = pattern.exec(content)) !== null) {
  matches++;
  const startPos = match.index;
  
  // Extract template name/id
  const nameMatch = content.substr(startPos, 100).match(/(?:name|id):\s*['"`]([^'"`]+)['"`]/);
  if (nameMatch) {
    foundTemplates.push(nameMatch[1]);
  }
  
  if (matches <= 10) {
    console.log(`Match ${matches}: ${match[0]} -> ${nameMatch ? nameMatch[1] : 'unknown'}`);
  }
}

console.log('Total template matches:', matches);
console.log('HomelabARR templates found:', foundTemplates.filter(name => name.includes('homelabarr')));