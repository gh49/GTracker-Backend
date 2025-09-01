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
};
