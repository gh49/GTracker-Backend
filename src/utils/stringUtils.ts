export const GString = {
  isAlphaNumeric: (input: string): boolean => {
    // {3,} means at least 3 characters
    return /^[A-Za-z0-9]{3,}$/.test(input);
  },
  isValidEmail: (email: string): boolean => {
    // Simple regex for validating emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  isValidPassword: (password: string): boolean => {
    // ^ start, $ end
    // [A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~] allowed chars
    // {6,} at least 6 chars
    // \s not allowed
    return /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]{6,}$/.test(
      password
    );
  },
  isValidFullName: (fullName: string): boolean => {
    return fullName.length > 0;
  },
  isUuid: (v: unknown): v is string =>
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    ),
};
