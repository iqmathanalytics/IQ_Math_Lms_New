export const CODE_TEMPLATES = {
    python: `# Write your solution inside the function below.
# ⚠️ DO NOT use input() or print(). 
# ⚠️ RETURN the result instead.

def solve(x):
    # Your logic here
    # Example: return x * 2
    return x
`,
    java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Reading input from stdin
        if (scanner.hasNext()) {
            String input = scanner.next();
            // Your logic here
            // Example: System.out.println(input);
        }
        scanner.close();
    }
}
`,
    cpp: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string input;
    // Reading input from stdin
    if (cin >> input) {
        // Your logic here
        // Example: cout << input << endl;
    }
    return 0;
}
`
};

export const getTemplate = (languageId: number) => {
    switch (languageId) {
        case 71: return CODE_TEMPLATES.python;
        case 62: return CODE_TEMPLATES.java;
        case 54: return CODE_TEMPLATES.cpp;
        default: return CODE_TEMPLATES.python;
    }
};
