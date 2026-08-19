import re
import glob

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Backgrounds
    content = content.replace("backgroundColor: '#0f1e3c'", "backgroundColor: 'var(--bg-card)'")
    content = content.replace("background: '#0f1e3c'", "background: 'var(--bg-card)'")
    
    # Text colors
    content = content.replace("color: '#ffffff'", "color: 'var(--text-primary)'")
    content = content.replace("color: '#fff'", "color: 'var(--text-primary)'")
    
    # Borders
    content = content.replace("rgba(255, 255, 255, 0.08)", "var(--border-default)")
    content = content.replace("rgba(255, 255, 255, 0.12)", "var(--border-default)")
    content = content.replace("rgba(255, 255, 255, 0.1)", "var(--border-default)")
    
    # Secondary text / icons
    content = content.replace("rgba(255, 255, 255, 0.7)", "var(--text-secondary)")
    content = content.replace("rgba(255, 255, 255, 0.65)", "var(--text-secondary)")
    content = content.replace("rgba(255, 255, 255, 0.6)", "var(--text-secondary)")
    content = content.replace("rgba(255, 255, 255, 0.55)", "var(--text-muted)")
    content = content.replace("rgba(255, 255, 255, 0.5)", "var(--text-muted)")
    content = content.replace("rgba(255, 255, 255, 0.45)", "var(--text-muted)")
    content = content.replace("rgba(255, 255, 255, 0.4)", "var(--text-muted)")
    content = content.replace("rgba(255, 255, 255, 0.3)", "var(--text-disabled)")
    
    # Subtle backgrounds (hover states, input bgs)
    content = content.replace("rgba(255, 255, 255, 0.06)", "var(--bg-hover)")
    content = content.replace("rgba(255, 255, 255, 0.04)", "var(--bg-hover)")
    content = content.replace("rgba(255,255,255,0.03)", "var(--bg-hover)")
    
    # Special cases with no spaces
    content = content.replace("rgba(255,255,255,0.6)", "var(--text-secondary)")
    content = content.replace("rgba(255,255,255,0.5)", "var(--text-muted)")
    content = content.replace("rgba(255,255,255,0.4)", "var(--text-muted)")
    
    # Modal overlays
    content = content.replace("rgba(15, 23, 42, 0.65)", "var(--shadow-color-base)")
    
    with open(filepath, 'w') as f:
        f.write(content)

fix_file("apps/frontend/src/components/student/StudentSidebar.tsx")
fix_file("apps/frontend/src/components/student/StudentTopHeader.tsx")

