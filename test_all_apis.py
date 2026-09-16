import json
import re
import subprocess
import time
import urllib.request
import urllib.parse
from typing import Dict, Any, List

BASE_URL = "http://localhost:8000"

# 1. Login as SuperAdmin
print("--> Logging in as SuperAdmin...")
login_payload = json.dumps({"email": "admin@examplanner.com", "password": "SuperAdmin#2026!"}).encode('utf-8')
req = urllib.request.Request(f"{BASE_URL}/api/v1/auth/login", data=login_payload, headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req) as resp:
    login_data = json.loads(resp.read().decode('utf-8'))
token = login_data["access_token"]
print(f"--> Authenticated successfully. Token obtained: {token[:15]}...")

# 2. Fetch OpenAPI Schema
print("--> Fetching OpenAPI schema...")
req = urllib.request.Request(f"{BASE_URL}/api/v1/openapi.json")
with urllib.request.urlopen(req) as resp:
    openapi = json.loads(resp.read().decode('utf-8'))

paths: Dict[str, Any] = openapi.get("paths", {})
print(f"--> Found {len(paths)} unique paths in OpenAPI schema.")

PARAM_MAP = {
    "exam_id": "16",
    "question_id": "204",
    "attempt_id": "69",
    "user_id": "22",
    "teacher_id": "2",
    "topic_id": "1",
    "subject_id": "1",
    "subtopic_id": "1",
    "task_id": "1",
    "review_task_id": "1",
    "testimonial_id": "1",
    "notification_id": "1",
    "role_id": "1",
    "permission_id": "1",
    "challenge_id": "1",
    "badge_id": "1",
    "syllabus_id": "1",
    "version_id": "1",
    "exam_code": "upsc-prelims-gs1-2024-set_a",
    "paper_set_code": "SET_A",
    "stage": "prelims",
    "language": "en",
    "exam_name": "upsc",
    "year": "2024",
    "subject_name": "Economy",
}

def resolve_path(path: str) -> str:
    resolved = path
    for param, val in PARAM_MAP.items():
        resolved = resolved.replace(f"{{{param}}}", val)
    # Generic fallback for any other {param}
    resolved = re.sub(r"\{[a-zA-Z0-9_]+\}", "1", resolved)
    return resolved

# Collect all GET endpoints to test
test_routes: List[Dict[str, str]] = []
for path, methods in paths.items():
    for method, op_info in methods.items():
        if method.lower() in ("get",):
            resolved = resolve_path(path)
            summary = op_info.get("summary", "")
            tags = op_info.get("tags", ["Untagged"])
            test_routes.append({
                "method": method.upper(),
                "path_template": path,
                "url": f"{BASE_URL}{resolved}",
                "summary": summary,
                "tag": tags[0] if tags else "General"
            })

print(f"--> Extracted {len(test_routes)} GET endpoints to test via curl.")

results = []

for idx, item in enumerate(test_routes):
    url = item["url"]
    cmd = [
        "curl", "-s", "-w", "\n%{http_code}\n%{time_total}",
        "-H", f"Authorization: Bearer {token}",
        "-H", "Accept: application/json",
        url
    ]
    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=25)
        lines = proc.stdout.strip().split("\n")
        if len(lines) >= 2:
            time_sec = float(lines[-1])
            time_ms = round(time_sec * 1000, 2)
            code = int(lines[-2])
            body = "\n".join(lines[:-2])
            error_preview = ""
            if code >= 400:
                try:
                    parsed = json.loads(body)
                    error_preview = parsed.get("detail", body[:100])
                except Exception:
                    error_preview = body[:100]
            
            res = {
                "tag": item["tag"],
                "path": item["path_template"],
                "url": url,
                "status": code,
                "latency_ms": time_ms,
                "error": str(error_preview) if error_preview else None
            }
            results.append(res)
            # Log progress every 15 items
            if (idx + 1) % 15 == 0 or idx == len(test_routes) - 1:
                print(f"[{idx+1}/{len(test_routes)}] Tested: {item['path_template']} -> {code} ({time_ms}ms)")
        else:
            results.append({
                "tag": item["tag"],
                "path": item["path_template"],
                "url": url,
                "status": 0,
                "latency_ms": 0,
                "error": "Failed to parse curl output"
            })
    except subprocess.TimeoutExpired:
        results.append({
            "tag": item["tag"],
            "path": item["path_template"],
            "url": url,
            "status": 504,
            "latency_ms": 25000.0,
            "error": "Timed out after 25s"
        })
        print(f"[{idx+1}/{len(test_routes)}] TIMEOUT: {item['path_template']}")
    except Exception as ex:
        results.append({
            "tag": item["tag"],
            "path": item["path_template"],
            "url": url,
            "status": -1,
            "latency_ms": 0,
            "error": str(ex)
        })

with open("api_test_results.json", "w") as f:
    json.dump(results, f, indent=2)

print("\n--> Benchmark Complete! Results saved to api_test_results.json")
