import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAsyncSubmission } from "../use-async-submission";

describe("useAsyncSubmission Hook (UX-002)", () => {
  it("executes the async action once under normal submission", async () => {
    const { result } = renderHook(() => useAsyncSubmission());
    const actionSpy = vi.fn().mockResolvedValue("success-data");

    let finalResult: any;
    await act(async () => {
      finalResult = await result.current.submitWithGuard(actionSpy);
    });

    expect(actionSpy).toHaveBeenCalledTimes(1);
    expect(finalResult).toBe("success-data");
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.inFlightRef.current).toBe(false);
  });

  it("blocks rapid double-clicks synchronously and executes action exactly once", async () => {
    const { result } = renderHook(() => useAsyncSubmission());

    let resolveAction!: (val: string) => void;
    const slowAction = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveAction = resolve;
        })
    );

    let firstPromise: Promise<any>;
    let secondPromise: Promise<any>;

    // Fire two calls synchronously in the same tick (simulating rapid double-click or Enter key)
    act(() => {
      firstPromise = result.current.submitWithGuard(slowAction);
      secondPromise = result.current.submitWithGuard(slowAction);
    });

    // The in-flight ref should immediately be true
    expect(result.current.inFlightRef.current).toBe(true);
    expect(result.current.isSubmitting).toBe(true);

    // The action must have been invoked only ONCE
    expect(slowAction).toHaveBeenCalledTimes(1);

    // Second call should resolve to undefined immediately because it was blocked
    const secondResult = await secondPromise!;
    expect(secondResult).toBeUndefined();

    // Now resolve the first action
    await act(async () => {
      resolveAction("first-done");
      await firstPromise;
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.inFlightRef.current).toBe(false);
  });

  it("restores controls after an action failure to allow user retry", async () => {
    const { result } = renderHook(() => useAsyncSubmission());
    const errorAction = vi.fn().mockRejectedValue(new Error("Network timeout"));
    const onErrorSpy = vi.fn();

    await act(async () => {
      await result.current.submitWithGuard(errorAction, { onError: onErrorSpy });
    });

    expect(errorAction).toHaveBeenCalledTimes(1);
    expect(onErrorSpy).toHaveBeenCalledWith(expect.any(Error));
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.inFlightRef.current).toBe(false);

    // Verify retry succeeds
    const retryAction = vi.fn().mockResolvedValue("retry-ok");
    let retryResult: any;
    await act(async () => {
      retryResult = await result.current.submitWithGuard(retryAction);
    });

    expect(retryAction).toHaveBeenCalledTimes(1);
    expect(retryResult).toBe("retry-ok");
  });

  it("calls onSuccess callback on successful completion", async () => {
    const { result } = renderHook(() => useAsyncSubmission<number>());
    const action = vi.fn().mockResolvedValue(42);
    const onSuccess = vi.fn();

    await act(async () => {
      await result.current.submitWithGuard(action, { onSuccess });
    });

    expect(onSuccess).toHaveBeenCalledWith(42);
  });
});
