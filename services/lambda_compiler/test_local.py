from lambda_function import handler

event = {
  "language": "java",
  "source_code": "public class Main { public static int solve(int n) { return n * 2; } }",
  "test_cases": [
    {"input": "3", "output": "6"},
    {"input": "7", "output": "14"}
  ]
}

print(handler(event, None))
