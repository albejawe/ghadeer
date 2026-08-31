import os

comps = ['AIChatBox', 'ManusDialog', 'Map', 'ComponentShowcase', 'DelegatesV2', 'delegatesData']
for comp in comps:
    found = []
    for root, dirs, files in os.walk('client/src'):
        for f in files:
            if f.endswith('.tsx') or f.endswith('.ts'):
                p = os.path.join(root, f)
                with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                    content = file.read()
                    if comp in content and not p.endswith(comp + '.tsx') and not p.endswith(comp + '.ts'):
                        found.append(p)
    status = f"used in {found}" if found else "[DEAD CODE / ORPHAN COMPONENT]"
    print(f"- {comp}: {status}")
