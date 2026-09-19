import re

file_path = "/home/neerajpandey/Documents/examplanner_code/apps/frontend/src/components/admin/views/QuestionReviewView.tsx"

with open(file_path, 'r') as f:
    content = f.read()

# 1. Add state
content = re.sub(
    r"(const \[questionSearchQuery, setQuestionSearchQuery\] = useState<string>\(''\);)",
    r"\1\n  const [isNavigatorCollapsed, setIsNavigatorCollapsed] = useState<boolean>(false);",
    content
)

# 2. Update Grid Layout
content = re.sub(
    r"<div style=\{\{ display: 'grid', gridTemplateColumns: isMobile \? '1fr' : '330px 1fr', gap: 20 \}\}>",
    r"<div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (isNavigatorCollapsed ? '48px 1fr' : '330px 1fr'), gap: 20, transition: 'grid-template-columns 0.3s ease' }}>",
    content
)

# 3. Handle collapsed state in Left Column
# Replace the contents of the left column when collapsed
# We find:
#         {/* LEFT COLUMN: Question Navigator */}
#         <div
#           style={{
#             backgroundColor: '#FFFFFF',

# We will wrap the inside of the left column, or just change the render.
# Let's replace the whole Left Column header up to Navigator Rows.

left_column_start = """        {/* LEFT COLUMN: Question Navigator */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 0,
            border: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 270px)',
            minHeight: 550,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
"""

new_left_column_start = left_column_start + """          {isNavigatorCollapsed ? (
            <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
              <button
                onClick={() => setIsNavigatorCollapsed(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#64748B' }}
                title="Expand Navigator"
              >
                <Menu size={20} />
              </button>
              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', marginTop: 20, fontSize: 12, fontWeight: 600, color: '#64748B', letterSpacing: 1 }}>
                QUESTION NAVIGATOR
              </div>
            </div>
          ) : (
            <>
"""

# Replace start of left column
content = content.replace(left_column_start, new_left_column_start)

# Add closing tag for isNavigatorCollapsed
# We need to find the end of the left column div.
# The left column ends before ` {/* RIGHT COLUMN: Question Content Workspace */}`
right_column = """        {/* RIGHT COLUMN: Question Content Workspace */}"""
content = content.replace(right_column, "            </>\n          )}\n        </div>\n" + right_column)

# We also have an extra `</div>` that closed the left column before the right column in the original file.
# Let's remove one `</div>` before the right column to balance it.
content = re.sub(r"        </div>\s+/\* RIGHT COLUMN", "        /* RIGHT COLUMN", content)

# Wait, add a toggle button to collapse in the expanded view as well.
header_start = """          {/* Navigator Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#FAFAFA' }}>"""

new_header_start = """          {/* Navigator Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#FAFAFA' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Question Navigator</h3>
              <button
                onClick={() => setIsNavigatorCollapsed(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Collapse Navigator"
              >
                <X size={16} />
              </button>
            </div>"""

content = content.replace(header_start, new_header_start)


with open(file_path, 'w') as f:
    f.write(content)

print("Navigator fixed.")
