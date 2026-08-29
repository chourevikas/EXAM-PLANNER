import os
import re

search_dir = "./apps/backend"
pattern = re.compile(r'build_cache_key\(\s*(["\'])(.*?)\1')
keys = set()

for root, _, files in os.walk(search_dir):
    for file in files:
        if file.endswith('.py'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                matches = pattern.findall(content)
                for match in matches:
                    keys.add(match[1])

with open("cache_keys.txt", "w") as f:
    for key in sorted(keys):
        f.write(key + "\n")

print(f"Found {len(keys)} cache keys and saved to cache_keys.txt")
