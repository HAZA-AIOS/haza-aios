/**
 * Global test setup file.
 *
 * Imported by vitest before every test suite via the `setupFiles` config.
 * Augments Vitest's `expect` with @testing-library/jest-dom's custom DOM
 * matchers (toBeInTheDocument, toHaveValue, toBeDisabled, etc.).
 */
import "@testing-library/jest-dom";
