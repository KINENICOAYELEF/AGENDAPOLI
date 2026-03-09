import re

with open('src/components/evaluacion-steps/Screen1_Entrevista.tsx', 'r') as f:
    text = f.read()

# Only analyze the content inside the main return
start_idx = text.find('return (', 700)
content = text[start_idx:]

lines = content.split('\n')
stack = []
for i, line in enumerate(lines):
    # Strip simple inline comments (not perfect, but good enough for this file)
    if line.strip().startswith('//') or line.strip().startswith('{/*'):
        continue
    
    # We only care about <div> and </div>
    matches = re.finditer(r'<(/)?(div)([^>]*)>', line, re.IGNORECASE)
    for m in matches:
        is_closing = m.group(1) == '/'
        if not is_closing and not line.strip().endswith('/>') and not '/>' in m.group(0):
            stack.append(i+1)
        elif is_closing:
            if len(stack) > 0:
                stack.pop()
            else:
                pass # Extra close

print("Unclosed div tags opened at lines (relative to return):")
for item in stack:
    print(item)

