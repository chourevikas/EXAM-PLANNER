import re
import os

files = [
    "/home/neerajpandey/Documents/examplanner_code/apps/frontend/src/pages/GuestExamPage.tsx",
    "/home/neerajpandey/Documents/examplanner_code/apps/frontend/src/pages/MockSelectionPage.tsx",
    "/home/neerajpandey/Documents/examplanner_code/apps/frontend/src/pages/StudentPracticeExamPage.tsx"
]

effect_code = """
  // Close active dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown-container]')) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
"""

for file in files:
    with open(file, 'r') as f:
        content = f.read()

    # 1. Add data-dropdown-container to position: relative divs that wrap dropdowns
    content = re.sub(r"(<div style={{ position: 'relative'[^>]*)(>)", r"\1 data-dropdown-container\2", content)

    # 2. Add or update the useEffect
    if 'handleClickOutside' in content:
        # MockSelectionPage has it
        content = re.sub(
            r"useEffect\(\(\) => \{\s+function handleClickOutside.*?\}, \[\]\);", 
            effect_code.strip(), 
            content, 
            flags=re.DOTALL
        )
    else:
        # Inject before return (
        # Let's find the main component's return statement.
        # But wait, GuestExamPage has multiple returns. 
        # A safer place is right after setActiveDropdown definition.
        content = re.sub(
            r"(const \[activeDropdown, setActiveDropdown\] = useState<string \| null>\(null\);)",
            r"\1\n" + effect_code,
            content
        )

    with open(file, 'w') as f:
        f.write(content)

print("Dropdowns fixed.")
