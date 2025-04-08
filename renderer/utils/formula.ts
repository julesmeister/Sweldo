export function evaluateFormula(
  formula: string,
  variables: Record<string, number>
): number {
  try {
    // Replace variable names with their values
    let evaluableExpression = formula;
    for (const [name, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\b${name}\\b`, "g");
      evaluableExpression = evaluableExpression.replace(
        regex,
        value.toString()
      );
    }

    // Evaluate the expression
    // Note: Using Function constructor is safe here as we control both the formula and variables
    const result = new Function(`return ${evaluableExpression}`)();
    return typeof result === "number" ? result : 0;
  } catch (error) {
    console.error("Error evaluating formula:", error);
    return 0;
  }
}
