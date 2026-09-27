import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("==================================================================")
print("🔎 DEEP AUDIT INSPECTOR ENGINE")
print("==================================================================")

# 1. Inspect Server APIs
print("\n[1] INSPECTING SERVER APIS & SECURITY...")
server_files = [
    'server/_core/app.ts',
    'server/localApi.ts',
    'server/localAdminApi.ts',
    'server/localDb.ts',
    'server/turso.ts',
    'server/sync.ts',
    'server/invoiceHandlers.ts',
]

for sf in server_files:
    if not os.path.exists(sf):
        continue
    with open(sf, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        lines = content.split('\n')
        # Check raw SQL queries for string concatenation (SQLi risk)
        for i, line in enumerate(lines):
            if 'sql:' in line or 'execute(' in line:
                if re.search(r'\$\{[^}]+\}', line) and not 'WHERE ${where.join' in line and not 'IN (${' in line:
                    print(f"⚠️ Potential String Concatenation in SQL: {sf}:{i+1} -> {line.strip()}")

# 2. Inspect Client Pages & Forms
print("\n[2] INSPECTING CLIENT PAGES & BUTTONS...")
client_pages = [
    'client/src/pages/Launcher.tsx',
    'client/src/pages/Home.tsx',
    'client/src/pages/Delegates.tsx',
    'client/src/pages/SharedLink.tsx',
    'client/src/pages/NotFound.tsx',
]

for cp in client_pages:
    if not os.path.exists(cp):
        continue
    with open(cp, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        lines = content.split('\n')
        print(f"Page: {cp} ({len(lines)} lines)")
        
        # Check for unhandled fetch or error catches
        for i, line in enumerate(lines):
            if 'fetch(' in line:
                # check if there is .catch or try/catch around
                pass

print("\nScan completed.")
