import subprocess
import json
import os
import tempfile

TMP_DIR = tempfile.gettempdir()

def handler(event, context):
    # ===============================
    # 1. Parse Input
    # ===============================
    try:
        body = json.loads(event["body"]) if isinstance(event.get("body"), str) else event

        code = body.get("source_code") or body.get("code", "")
        test_cases = body.get("test_cases", [])
        stdin_input = body.get("stdin", "") # Fallback if no test cases
        
        language_id = body.get("language_id")
        if language_id is None:
            lang = body.get("language", "python").lower()
            if lang == "python": language_id = 71
            elif lang in ["cpp", "c++"]: language_id = 54
            elif lang == "java": language_id = 62
            else: return response_error("Unsupported language")

        if not code.strip():
            return response_error("No source code provided")

    except Exception:
        return response_error("Invalid JSON input")

    # ===============================
    # 2. PYTHON (ID: 71) - Logic Remains Same
    # ===============================
    if language_id == 71:
        script_path = os.path.join(TMP_DIR, "script.py")

        driver_code = f"""
import json

# -------- USER CODE START --------
{code}
# -------- USER CODE END ----------

def main():
    cases = {json.dumps(test_cases)}

    solve_fn = globals().get("solve")
    if not callable(solve_fn):
        print(json.dumps({{"error": "Function solve() not found"}}))
        return

    if not cases:
        try:
            solve_fn(None)
        except Exception as e:
            print(json.dumps({{"error": str(e)}}))
        return

    results = []
    passed = 0

    for i, c in enumerate(cases):
        try:
            inp = c.get("input")
            expected = str(c.get("output", "")).strip()

            arg = inp
            if isinstance(inp, str):
                if inp.isdigit():
                    arg = int(inp)
                elif inp.replace(".", "", 1).isdigit():
                    arg = float(inp)

            actual = str(solve_fn(arg)).strip()
            status = "Passed" if actual == expected else "Failed"
            if status == "Passed":
                passed += 1

            results.append({{
                "id": i,
                "input": str(inp),
                "expected": expected,
                "actual": actual,
                "status": status
            }})

        except Exception as e:
            results.append({{
                "id": i,
                "status": "Runtime Error",
                "error": str(e)
            }})

    print(json.dumps({{
        "stats": {{"passed": passed, "total": len(cases)}},
        "results": results
    }}))

if __name__ == "__main__":
    main()
"""

        with open(script_path, "w", encoding="utf-8") as f:
            f.write(driver_code)

        run_cmd = ["python", script_path]
        
        # IMPORTANT: execute immediately and return to skip the C++/Java loop below
        return run_and_capture(run_cmd, "")

    # ===============================
    # 3. COMPILE STEP (C++ & Java)
    # ===============================
    run_cmd = []
    
    if language_id == 54: # C++
        src_path = os.path.join(TMP_DIR, "main.cpp")
        exe_path = os.path.join(TMP_DIR, "main")
        with open(src_path, "w", encoding="utf-8") as f: f.write(code)
        
        # Compile
        compile_res = subprocess.run(["g++", src_path, "-O2", "-o", exe_path], capture_output=True)
        if compile_res.returncode != 0:
            return response_error("Compilation Error:\n" + compile_res.stderr.decode())
        
        run_cmd = [exe_path]

    elif language_id == 62: # Java
        src_path = os.path.join(TMP_DIR, "Main.java")
        with open(src_path, "w", encoding="utf-8") as f: f.write(code)
        
        # Compile
        compile_res = subprocess.run(["javac", src_path], capture_output=True)
        if compile_res.returncode != 0:
            return response_error("Compilation Error:\n" + compile_res.stderr.decode())
        
        run_cmd = ["java", "-cp", TMP_DIR, "Main"]

    # ===============================
    # 4. EXECUTION LOOP (The Fix for C++/Java)
    # ===============================
    # Unlike Python (which loops internally), we must loop manually here
    
    results = []
    passed_count = 0

    # If no test cases, just run once (Dry run without grading)
    if not test_cases:
        return run_and_capture(run_cmd, stdin_input)

    for i, case in enumerate(test_cases):
        inp_str = str(case.get("input", ""))
        expected = str(case.get("output", "")).strip()

        try:
            # Run the binary for EACH test case
            proc = subprocess.run(
                run_cmd,
                input=inp_str.encode(),
                capture_output=True,
                timeout=2 # 2 Seconds strict timeout per case
            )
            
            # Capture output
            actual = proc.stdout.decode().strip()
            err = proc.stderr.decode().strip()

            if proc.returncode != 0:
                results.append({"id": i, "status": "Runtime Error", "error": err or "Crash"})
                continue

            # Check Match
            status = "Passed" if actual == expected else "Failed"
            if status == "Passed": passed_count += 1

            results.append({
                "id": i,
                "input": inp_str,
                "expected": expected,
                "actual": actual,
                "status": status
            })

        except subprocess.TimeoutExpired:
            results.append({"id": i, "status": "Time Limit Exceeded", "error": "Timeout"})
        except Exception as e:
            results.append({"id": i, "status": "System Error", "error": str(e)})

    # Return structured response compatible with Python output
    return {
        "statusCode": 200,
        "body": json.dumps({
            "stats": {"passed": passed_count, "total": len(test_cases)},
            "results": results
        })
    }

# ===============================
# Helper: Run Single Command (For Python or No-Test-Case mode)
# ===============================
def run_and_capture(cmd, stdin_txt):
    try:
        res = subprocess.run(cmd, input=stdin_txt.encode(), capture_output=True, timeout=5)
        output = res.stdout.decode() + res.stderr.decode()
        
        # Attempt to parse JSON if it's the Python driver output
        try:
            return {"statusCode": 200, "body": output if output.strip().startswith("{") else json.dumps({"output": output})}
        except:
            return {"statusCode": 200, "body": json.dumps({"output": output})}
            
    except subprocess.TimeoutExpired:
        return response_error("Time Limit Exceeded")
    except Exception as e:
        return response_error(f"Execution Error: {str(e)}")

def response_error(msg):
    return { "statusCode": 200, "body": json.dumps({"error": msg}) }