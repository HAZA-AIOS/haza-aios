import { useCallback, useRef, useState } from "react";

export interface AsyncSubmissionOptions<T> {
  onSuccess?: (result: T) => void | Promise<void>;
  onError?: (error: Error) => void;
}

/**
 * useAsyncSubmission
 *
 * Provides a synchronous in-flight guard (inFlightRef) combined with React state (isSubmitting)
 * to strictly prevent duplicate form submissions caused by rapid double-clicks or repeated
 * Enter-key presses.
 *
 * Ensures controls are unlocked on both success and error, preserving user-entered data
 * in caller state for retry if a network or validation error occurs.
 */
export function useAsyncSubmission<T = void>() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  const submitWithGuard = useCallback(
    async (
      action: () => Promise<T>,
      options?: AsyncSubmissionOptions<T>
    ): Promise<T | undefined> => {
      // Synchronous in-flight guard: blocks second call immediately in the same event tick
      if (inFlightRef.current) {
        return undefined;
      }

      inFlightRef.current = true;
      setIsSubmitting(true);

      try {
        const result = await action();
        if (options?.onSuccess) {
          await options.onSuccess(result);
        }
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (options?.onError) {
          options.onError(error);
        } else {
          throw error;
        }
      } finally {
        inFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    []
  );

  return {
    isSubmitting,
    submitWithGuard,
    inFlightRef,
  };
}
