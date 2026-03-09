import re

with open('src/components/evaluacion-steps/Screen1_Entrevista.tsx', 'r') as f:
    lines = f.readlines()

opens = 0
closes = 0
stack = []

for i in range(2284, 2528):
    line = lines[i]
    # super basic tags matching
    matches = re.findall(r'</?(div|details)[^>]*>', line)
    raw_tags = re.findall(r'<.*?>', line)
    for tag in raw_tags:
        if '<div' in tag:
            if not tag.endswith('/>'):
                stack.append('div')
        elif '</div' in tag:
            if len(stack) > 0:
                top = stack.pop()
                if top != 'div':
                    print(f"Line {i+1}: expected </{top}> but found </div>")
        elif '<details' in tag:
            if not tag.endswith('/>'):
                stack.append('details')
        elif '</details' in tag:
            if len(stack) > 0:
                top = stack.pop()
                if top != 'details':
                    print(f"Line {i+1}: expected </{top}> but found </details>")

print("Stack remaining:")
print(stack)

