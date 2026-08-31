import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("==================================================================")
print("🔍 AUDIT ENGINE: SCANNING COMPLETE CODEBASE")
print("==================================================================")

files_scanned = []
for root, dirs, files in os.walk('.'):
    if any(x in root for x in ['node_modules', '.git', 'dist', '.system_generated', '.gemini']):
        continue
    for f in files:
        if f.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.mjs', '.sql')):
            path = os.path.join(root, f)
            files_scanned.append(path)

print(f"Total source files to analyze: {len(files_scanned)}")

# 1. Scan Routes & Pages
print("\n--- [1] FRONTEND ROUTES & PAGES ---")
with open('client/src/App.tsx', 'r', encoding='utf-8', errors='ignore') as f:
    app_content = f.read()
    routes = re.findall(r'<Route\s+path=\{?["\']([^"\']+)["\']\}?\s+component=\{?([A-Za-z0-9_]+)\}?', app_content)
    for r in routes:
        print(f"Route: {r[0]} -> Component: {r[1]}")

# 2. Scan Express & API Endpoints
print("\n--- [2] BACKEND API ENDPOINTS ---")
server_files = [f for f in files_scanned if f.startswith('.\\server') or f.startswith('./server') or 'server' in f]
endpoints = []
for sf in server_files:
    with open(sf, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        matches = re.findall(r'(router|app)\.(get|post|put|patch|delete)\s*\(\s*["\']([^"\']+)["\']', content)
        for m in matches:
            endpoints.append((sf, m[1].upper(), m[2]))
            print(f"[{m[1].upper()}] {m[2]}  (in {sf})")

# 3. Check for TODO, FIXME, mock data, placeholder
print("\n--- [3] PLACEHOLDERS, TODOS, MOCK DATA, AND UNFINISHED FEATURES ---")
for fpath in files_scanned:
    if 'test' in fpath or 'scripts' in fpath or 'audit' in fpath:
        continue
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            if any(k in line.lower() for k in ['todo', 'fixme', 'placeholder', 'mockdata', 'mock_data', 'dummy', 'not implemented']):
                print(f"{fpath}:{i+1} -> {line.strip()[:100]}")

# 4. Check for Hardcoded Secrets, Keys, Insecure Patterns
print("\n--- [4] POTENTIAL SECRETS & SECURITY PATTERNS ---")
for fpath in files_scanned:
    if fpath.endswith('.env') or 'test' in fpath or 'scripts' in fpath:
        continue
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        if re.search(r'["\'](ghp_[A-Za-z0-9]+|sk-[A-Za-z0-9]+|eyJh[A-Za-z0-9_-]+)["\']', content):
            print(f"CRITICAL: Potential token in {fpath}")

print("\nAudit scan script finished successfully.")
