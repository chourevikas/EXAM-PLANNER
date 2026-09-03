import os
import re

directory = 'apps/frontend/src'

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            # Remove <Sparkles ... /> or <Ico.Sparkles ... />
            new_content = re.sub(r'<Ico\.Sparkles[^>]*\/>', '', new_content)
            new_content = re.sub(r'<Sparkles[^>]*\/>', '', new_content)
            # Remove Sparkles icon object if it's used as an icon ref
            new_content = re.sub(r'\bicon:\s*Sparkles\b', "icon: undefined", new_content)
            # We don't remove imports just in case, or we could. We'll leave the import. But TS will complain if unused?
            # Actually, unused imports are just warnings in most setups. 
            # But let's remove 'Sparkles' from imports.
            new_content = re.sub(r'\bSparkles,\s*', '', new_content)
            new_content = re.sub(r',\s*Sparkles\b', '', new_content)
            new_content = re.sub(r'\bSparkles\s*}', '}', new_content)
            new_content = re.sub(r'{\s*Sparkles\b', '{', new_content)

            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {path}")
