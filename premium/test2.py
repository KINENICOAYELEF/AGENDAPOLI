import re

with open('src/components/evaluacion-steps/Screen1_Entrevista.tsx', 'r') as f:
    text = f.read()

opens = text.count('<details') + text.count('< details')
closes = text.count('</details')

print(f"Details opens: {opens}")
print(f"Details closes: {closes}")

opens_div = text.count('<div ') + text.count('<div>') + text.count('< div ')
closes_div = text.count('</div')

print(f"Div opens: {opens_div}")
print(f"Div closes: {closes_div}")
