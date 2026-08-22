export class JourneyValidationError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = "JourneyValidationError";
    this.issues = issues;
  }
}

export function requireString(value, field, issues) {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${field} must be a non-empty string`);
  }
}

export function requireInteger(value, field, issues, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    issues.push(`${field} must be an integer greater than or equal to ${minimum}`);
  }
}

export function optionalDC(value, field, issues) {
  if (value !== null && (!Number.isInteger(value) || value < 0)) {
    issues.push(`${field} must be null or a non-negative integer`);
  }
}
