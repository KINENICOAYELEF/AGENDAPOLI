
const fs = require('fs');
const content = fs.readFileSync('/Users/nicoayelefparraguez/Downloads/Polideportivo/premium/src/components/evaluacion-steps/Screen1_Entrevista.tsx', 'utf8');

const lines = content.split('\n');
let depth = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/<div(?!.*\/>)/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    depth += opens - closes;
    if (line.includes('P1_AI_STRUCTURED') || line.includes('Hypothesis') || line.includes('Mapa Contextual') || line.includes('Recomendaciones')) {
        // Just log some interesting points
    }
}
console.log('Final depth:', depth);
