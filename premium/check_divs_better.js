
const fs = require('fs');
const content = fs.readFileSync('/Users/nicoayelefparraguez/Downloads/Polideportivo/premium/src/components/evaluacion-steps/Screen1_Entrevista.tsx', 'utf8');

const lines = content.split('\n');
const stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Simple regex for tags on current line
    const matches = line.match(/<(div|span|p|h4|section|label|button|textarea|select|input|strong|ul|li|svg|path|mark|details|summary)|<\/(div|span|p|h4|section|label|button|textarea|select|input|strong|ul|li|svg|path|mark|details|summary)>/g) || [];
    
    matches.forEach(token => {
        if (token.startsWith('</')) {
            const tagName = token.match(/<\/(\w+)/)[1];
            if (stack.length > 0 && stack[stack.length - 1].name === tagName) {
                stack.pop();
            } else {
                console.log(`Error: found </${tagName}> at line ${i+1} but expected </${stack[stack.length-1]?.name}> from line ${stack[stack.length-1]?.line}`);
            }
        } else {
             // Check for self-closing
             if (!line.includes(token + ' ') && !line.includes(token + '>') && !line.includes(token + '/>')) {
                 // Might be incomplete or multi-line
             }
             const tagName = token.match(/<(\w+)/)[1];
             // Filter common self-closers or attributes that look like tags
             if (line.match(new RegExp(`<${tagName}[^>]*?/>`))) {
                 // self closing, skip
             } else {
                 stack.push({ name: tagName, line: i + 1 });
             }
        }
    });
}

console.log('Final stack size:', stack.length);
stack.forEach(s => console.log(`Unclosed <${s.name}> from line ${s.line}`));
