import re

with open('apps/frontend/src/components/landing/HeroSection.tsx', 'r') as f:
    content = f.read()

content = content.replace('searchResults.topics', 'searchResults?.topics')
content = content.replace('searchResults.pyqs', 'searchResults?.pyqs')
content = content.replace('searchResults.mocks', 'searchResults?.mocks')

with open('apps/frontend/src/components/landing/HeroSection.tsx', 'w') as f:
    f.write(content)
