// frontend/src/utils/pyodideManager.ts

let pyodide: any = null;

// 1. Initialize Pyodide (Loads only once)
export const initializePyodide = async () => {
    if (!pyodide) {
        // @ts-ignore
        pyodide = await loadPyodide();
        console.log("✅ Pyodide Loaded");
    }
    return pyodide;
};

// 2. Run User Code Locally
export const runPythonLocally = async (code: string, input: string = "") => {
    const py = await initializePyodide();
    try {
        // ✅ STEP 1: Pass the TypeScript 'input' string into Python's global scope
        // This fixes the "unused variable" error and safely transfers the data.
        py.globals.set("user_input_data", input);

        // ✅ STEP 2: Configure Python to read from that input variable
        // We allow Python to read 'user_input_data' as if it were typed in the terminal (stdin)
        py.runPython(`
            import sys
            from io import StringIO
            
            # 1. Capture Output (stdout)
            sys.stdout = StringIO()
            
            # 2. Inject Input (stdin)
            # This allows input() to read the string passed from TypeScript
            sys.stdin = StringIO(user_input_data) 
        `);
        
        // Execute User Code
        await py.runPythonAsync(code);
        
        // Get the Output
        const stdout = py.runPython("sys.stdout.getvalue()");
        return { success: true, output: stdout };
        
    } catch (err: any) {
        return { success: false, error: err.toString() };
    }
};