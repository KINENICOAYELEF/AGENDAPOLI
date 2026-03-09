import re

with open('src/components/evaluacion-steps/Screen1_Entrevista.tsx', 'r') as f:
    lines = f.readlines()

opens = 0
closes = 0

for i, line in enumerate(lines):
    # Only simple counts
    # ignoring comments is hard but let's try
    if line.strip().startswith('//') or line.strip().startswith('{/*'):
        continue
    o = len(re.findall(r'<div(\s|>|/>)', line)) + len(re.findall(r'< div(\s|>|/>)', line))
    c = len(re.findall(r'</div', line))
    opens += o
    closes += c
    if opens < closes:
        print(f"Negative balance at line {i+1}: opens={opens}, closes={closes}")
        # Reset to continue finding all
        opens = closes

print(f"Total Div opens: {opens}")
print(f"Total Div closes: {closes}")
