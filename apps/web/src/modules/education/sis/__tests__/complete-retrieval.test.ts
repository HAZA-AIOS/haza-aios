import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchCompleteDataset,
  fetchCompleteSisDataset,
  CompleteDatasetRetrievalError,
} from "../complete-retrieval";
import type { PaginationMetadata } from "../student.service";
import * as sisApi from "../sis-api";

describe("Epic 10N / Phase 3 Correction: Frontend Complete Dataset Retrieval", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. completes retrieval across multiple pages (e.g. 5,000 records in 3 pages)", async () => {
    // Page 1: 2,000 items, Page 2: 2,000 items, Page 3: 1,000 items -> total 5,000
    const page1Items = Array.from({ length: 2000 }, (_, i) => ({ id: `rec-${i + 1}`, name: `Item ${i + 1}` }));
    const page2Items = Array.from({ length: 2000 }, (_, i) => ({ id: `rec-${i + 2001}`, name: `Item ${i + 2001}` }));
    const page3Items = Array.from({ length: 1000 }, (_, i) => ({ id: `rec-${i + 4001}`, name: `Item ${i + 4001}` }));

    const fetchPageMock = vi.fn(async (page: number) => {
      if (page === 1) {
        return {
          items: page1Items,
          pagination: { page: 1, pageSize: 2000, totalItems: 5000, totalPages: 3, hasNextPage: true, hasPreviousPage: false },
        };
      }
      if (page === 2) {
        return {
          items: page2Items,
          pagination: { page: 2, pageSize: 2000, totalItems: 5000, totalPages: 3, hasNextPage: true, hasPreviousPage: true },
        };
      }
      return {
        items: page3Items,
        pagination: { page: 3, pageSize: 2000, totalItems: 5000, totalPages: 3, hasNextPage: false, hasPreviousPage: true },
      };
    });

    const progressLogs: Array<{ loaded: number; total: number; page: number }> = [];
    const results = await fetchCompleteDataset(fetchPageMock, {
      onProgress: (p) => progressLogs.push({ loaded: p.loaded, total: p.total, page: p.page }),
    });

    expect(fetchPageMock).toHaveBeenCalledTimes(3);
    expect(results.length).toBe(5000);
    expect(results[0].id).toBe("rec-1");
    expect(results[1999].id).toBe("rec-2000");
    expect(results[2000].id).toBe("rec-2001");
    expect(results[4999].id).toBe("rec-5000");

    expect(progressLogs).toEqual([
      { loaded: 2000, total: 5000, page: 1 },
      { loaded: 4000, total: 5000, page: 2 },
      { loaded: 5000, total: 5000, page: 3 },
    ]);
  });

  it("2. retrieves complete dataset above 2,000 records without silent truncation (2,001 records)", async () => {
    const page1Items = Array.from({ length: 2000 }, (_, i) => ({ id: `std-${i + 1}`, val: i + 1 }));
    const page2Items = [{ id: "std-2001", val: 2001 }];

    const fetchPageMock = vi.fn(async (page: number) => {
      if (page === 1) {
        return {
          items: page1Items,
          pagination: { page: 1, pageSize: 2000, totalItems: 2001, totalPages: 2, hasNextPage: true, hasPreviousPage: false },
        };
      }
      return {
        items: page2Items,
        pagination: { page: 2, pageSize: 2000, totalItems: 2001, totalPages: 2, hasNextPage: false, hasPreviousPage: true },
      };
    });

    const results = await fetchCompleteDataset(fetchPageMock);
    expect(fetchPageMock).toHaveBeenCalledTimes(2);
    expect(results.length).toBe(2001);
    expect(results[2000].id).toBe("std-2001");
  });

  it("3. deduplicates records if concurrent inserts shift records across page boundaries", async () => {
    // Record 2000 appears at the end of page 1 and the start of page 2 due to concurrent row insertion
    const page1 = [{ id: "id-1" }, { id: "id-2" }, { id: "id-3" }];
    const page2 = [{ id: "id-3" }, { id: "id-4" }, { id: "id-5" }];

    const fetchPageMock = vi.fn(async (page: number) => {
      if (page === 1) {
        return { items: page1, pagination: { page: 1, pageSize: 3, totalItems: 5, totalPages: 2, hasNextPage: true, hasPreviousPage: false } };
      }
      return { items: page2, pagination: { page: 2, pageSize: 3, totalItems: 5, totalPages: 2, hasNextPage: false, hasPreviousPage: true } };
    });

    const results = await fetchCompleteDataset(fetchPageMock, { keyExtractor: (item) => item.id });
    expect(results.length).toBe(5);
    expect(results.map((r) => r.id)).toEqual(["id-1", "id-2", "id-3", "id-4", "id-5"]);
  });

  it("4. terminates cleanly on single-page datasets without making redundant second request", async () => {
    const items = [{ id: "item-1" }, { id: "item-2" }, { id: "item-3" }];
    const fetchPageMock = vi.fn(async (_page: number) => ({
      items,
      pagination: { page: 1, pageSize: 2000, totalItems: 3, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    }));

    const results = await fetchCompleteDataset(fetchPageMock);
    expect(fetchPageMock).toHaveBeenCalledTimes(1);
    expect(results.length).toBe(3);
  });

  it("5. terminates cleanly on unpaginated responses without errors", async () => {
    const items = [{ id: "item-1" }, { id: "item-2" }];
    const fetchPageMock = vi.fn(async () => ({ items }));

    const results = await fetchCompleteDataset(fetchPageMock);
    expect(fetchPageMock).toHaveBeenCalledTimes(1);
    expect(results.length).toBe(2);
  });

  it("6. throws CompleteDatasetRetrievalError on middle-page failure and prevents partial data leakage", async () => {
    const page1 = Array.from({ length: 2000 }, (_, i) => ({ id: `rec-${i}` }));

    const fetchPageMock = vi.fn(async (page: number) => {
      if (page === 1) {
        return { items: page1, pagination: { page: 1, pageSize: 2000, totalItems: 4000, totalPages: 2, hasNextPage: true, hasPreviousPage: false } };
      }
      throw new Error("504 Gateway Timeout on page 2");
    });

    await expect(fetchCompleteDataset(fetchPageMock)).rejects.toThrow(CompleteDatasetRetrievalError);

    try {
      await fetchCompleteDataset(fetchPageMock);
    } catch (err) {
      const error = err as CompleteDatasetRetrievalError;
      expect(error.name).toBe("CompleteDatasetRetrievalError");
      expect(error.page).toBe(2);
      expect(error.retrievedSoFar).toBe(2000);
      expect(error.totalExpected).toBe(4000);
      expect(error.message).toContain("Failed to retrieve complete dataset on page 2");
    }
  });

  it("7. supports safe retry after failure without retaining stale state", async () => {
    let shouldFail = true;
    const fetchPageMock = vi.fn(async (page: number) => {
      if (page === 2 && shouldFail) {
        throw new Error("Transient network disconnection");
      }
      return {
        items: [{ id: `item-${page}` }],
        pagination: { page, pageSize: 1, totalItems: 2, totalPages: 2, hasNextPage: page === 1, hasPreviousPage: page > 1 },
      };
    });

    // First attempt fails on page 2
    await expect(fetchCompleteDataset(fetchPageMock)).rejects.toThrow(CompleteDatasetRetrievalError);

    // Second attempt (retry) succeeds completely
    shouldFail = false;
    const retryResults = await fetchCompleteDataset(fetchPageMock);
    expect(retryResults.length).toBe(2);
    expect(retryResults.map((r) => r.id)).toEqual(["item-1", "item-2"]);
  });

  it("8. handles empty datasets (0 records) accurately in 1 call", async () => {
    const fetchPageMock = vi.fn(async () => ({
      items: [],
      pagination: { page: 1, pageSize: 2000, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    }));

    const results = await fetchCompleteDataset(fetchPageMock);
    expect(fetchPageMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual([]);
  });

  it("9. defends against infinite loops via configurable maxPages guard", async () => {
    // Defective mock that always returns hasNextPage: true
    const fetchPageMock = vi.fn(async (page: number) => ({
      items: [{ id: `rec-${page}` }],
      pagination: { page, pageSize: 1, totalItems: 99999, totalPages: 99999, hasNextPage: true, hasPreviousPage: page > 1 },
    }));

    await expect(
      fetchCompleteDataset(fetchPageMock, { maxPages: 5 })
    ).rejects.toThrow("safety page limit (5 pages)");

    expect(fetchPageMock).toHaveBeenCalledTimes(5);
  });

  it("10. respects AbortSignal for user or component unmount cancellation", async () => {
    const controller = new AbortController();
    const fetchPageMock = vi.fn(async (page: number) => {
      if (page === 2) controller.abort();
      return {
        items: [{ id: `rec-${page}` }],
        pagination: { page, pageSize: 1, totalItems: 10, totalPages: 10, hasNextPage: true, hasPreviousPage: page > 1 },
      };
    });

    await expect(
      fetchCompleteDataset(fetchPageMock, { signal: controller.signal })
    ).rejects.toThrow("aborted");
  });

  it("11. fetchCompleteSisDataset integrates with sisRequest across pages", async () => {
    const sisRequestSpy = vi.spyOn(sisApi, "sisRequest").mockImplementation(async (_orgId, path) => {
      const url = new URL(path, "http://localhost");
      const page = Number(url.searchParams.get("page") ?? 1);
      if (page === 1) {
        return {
          data: Array.from({ length: 2000 }, (_, i) => ({ id: `s-${i + 1}` })),
          pagination: { page: 1, pageSize: 2000, totalItems: 2500, totalPages: 2, hasNextPage: true, hasPreviousPage: false },
        } as unknown as Record<string, unknown>;
      }
      return {
        data: Array.from({ length: 500 }, (_, i) => ({ id: `s-${i + 2001}` })),
        pagination: { page: 2, pageSize: 2000, totalItems: 2500, totalPages: 2, hasNextPage: false, hasPreviousPage: true },
      } as unknown as Record<string, unknown>;
    });

    const students = await fetchCompleteSisDataset<{ id: string }>("org-456", "/students?status=active");
    expect(sisRequestSpy).toHaveBeenCalledTimes(2);
    expect(sisRequestSpy).toHaveBeenNthCalledWith(1, "org-456", "/students?status=active&all=true&page=1");
    expect(sisRequestSpy).toHaveBeenNthCalledWith(2, "org-456", "/students?status=active&all=true&page=2");
    expect(students.length).toBe(2500);
    expect(students[0].id).toBe("s-1");
    expect(students[2499].id).toBe("s-2500");
  });

  describe("Maximum-Page Boundary and Incomplete Retrieval Edge Cases (Epic 10N Phase 3 Acceptance)", () => {
    it("A. exactly maxPages pages with no remaining records completes successfully", async () => {
      // 3 pages, maxPages: 3. Page 3 has hasNextPage: false.
      const p1 = [{ id: "1" }, { id: "2" }];
      const p2 = [{ id: "3" }, { id: "4" }];
      const p3 = [{ id: "5" }, { id: "6" }];

      const fetchPageMock = vi.fn(async (page: number) => {
        if (page === 1) {
          return { items: p1, pagination: { page: 1, pageSize: 2, totalItems: 6, totalPages: 3, hasNextPage: true, hasPreviousPage: false } };
        }
        if (page === 2) {
          return { items: p2, pagination: { page: 2, pageSize: 2, totalItems: 6, totalPages: 3, hasNextPage: true, hasPreviousPage: true } };
        }
        return { items: p3, pagination: { page: 3, pageSize: 2, totalItems: 6, totalPages: 3, hasNextPage: false, hasPreviousPage: true } };
      });

      const results = await fetchCompleteDataset(fetchPageMock, { maxPages: 3 });
      expect(fetchPageMock).toHaveBeenCalledTimes(3);
      expect(results.length).toBe(6);
      expect(results.map((r) => r.id)).toEqual(["1", "2", "3", "4", "5", "6"]);
    });

    it("B. more than maxPages pages throws CompleteDatasetRetrievalError and returns NO partial results", async () => {
      // 3 pages available, but maxPages = 2. Must throw on page 2 boundary, never returning the 4 partial records.
      const p1 = [{ id: "1" }, { id: "2" }];
      const p2 = [{ id: "3" }, { id: "4" }];

      const fetchPageMock = vi.fn(async (page: number) => {
        if (page === 1) {
          return { items: p1, pagination: { page: 1, pageSize: 2, totalItems: 6, totalPages: 3, hasNextPage: true, hasPreviousPage: false } };
        }
        return { items: p2, pagination: { page: 2, pageSize: 2, totalItems: 6, totalPages: 3, hasNextPage: true, hasPreviousPage: true } };
      });

      let caughtError: CompleteDatasetRetrievalError | undefined;
      let resolvedValue: unknown;
      try {
        resolvedValue = await fetchCompleteDataset(fetchPageMock, { maxPages: 2 });
      } catch (err) {
        caughtError = err as CompleteDatasetRetrievalError;
      }

      expect(resolvedValue).toBeUndefined();
      expect(caughtError).toBeInstanceOf(CompleteDatasetRetrievalError);
      expect(caughtError?.page).toBe(2);
      expect(caughtError?.retrievedSoFar).toBe(4);
      expect(caughtError?.totalExpected).toBe(6);
      expect(caughtError?.message).toContain("safety page limit (2 pages)");
      expect(fetchPageMock).toHaveBeenCalledTimes(2);
    });

    it("C. full final page with hasNextPage=false terminates cleanly without false boundary error", async () => {
      // Page size 2, totalItems 4. Page 2 has 2 items (full page!) and hasNextPage: false.
      const p1 = [{ id: "1" }, { id: "2" }];
      const p2 = [{ id: "3" }, { id: "4" }];

      const fetchPageMock = vi.fn(async (page: number) => {
        if (page === 1) {
          return { items: p1, pagination: { page: 1, pageSize: 2, totalItems: 4, totalPages: 2, hasNextPage: true, hasPreviousPage: false } };
        }
        return { items: p2, pagination: { page: 2, pageSize: 2, totalItems: 4, totalPages: 2, hasNextPage: false, hasPreviousPage: true } };
      });

      const results = await fetchCompleteDataset(fetchPageMock, { maxPages: 2 });
      expect(results.length).toBe(4);
      expect(results.map((r) => r.id)).toEqual(["1", "2", "3", "4"]);
      expect(fetchPageMock).toHaveBeenCalledTimes(2);
    });

    it("D. empty final page terminates cleanly when all records retrieved", async () => {
      // Page 1 returns 2 items with totalItems: 2. Page 2 returns 0 items with hasNextPage: false.
      const fetchPageMock = vi.fn(async (page: number) => {
        if (page === 1) {
          return { items: [{ id: "1" }, { id: "2" }], pagination: { page: 1, pageSize: 2, totalItems: 2, totalPages: 1, hasNextPage: true, hasPreviousPage: false } };
        }
        return { items: [], pagination: { page: 2, pageSize: 2, totalItems: 2, totalPages: 1, hasNextPage: false, hasPreviousPage: true } };
      });

      const results = await fetchCompleteDataset(fetchPageMock);
      expect(results.length).toBe(2);
      expect(fetchPageMock).toHaveBeenCalledTimes(2);
    });

    it("E. empty page before expected total throws CompleteDatasetRetrievalError", async () => {
      // Expected 10 items, but page 2 returned empty array
      const fetchPageMock = vi.fn(async (page: number) => {
        if (page === 1) {
          return { items: [{ id: "1" }, { id: "2" }], pagination: { page: 1, pageSize: 2, totalItems: 10, totalPages: 5, hasNextPage: true, hasPreviousPage: false } };
        }
        return { items: [], pagination: { page: 2, pageSize: 2, totalItems: 10, totalPages: 5, hasNextPage: true, hasPreviousPage: true } };
      });

      await expect(fetchCompleteDataset(fetchPageMock)).rejects.toThrow(CompleteDatasetRetrievalError);
    });

    it("F. missing pagination metadata completes safely as single-page dataset", async () => {
      const fetchPageMock = vi.fn(async () => ({
        items: [{ id: "1" }, { id: "2" }],
        // pagination omitted entirely
      }));

      const results = await fetchCompleteDataset(fetchPageMock);
      expect(results.length).toBe(2);
      expect(fetchPageMock).toHaveBeenCalledTimes(1);
    });

    it("G. inconsistent pagination metadata (hasNextPage=false but totalItems > loaded) detects remaining records and enforces boundary", async () => {
      // Defective API says hasNextPage: false on page 1, but totalItems is 100 while returning 10 items
      const fetchPageMock = vi.fn(async () => ({
        items: Array.from({ length: 10 }, (_, i) => ({ id: `item-${i + 1}` })),
        pagination: { page: 1, pageSize: 10, totalItems: 100, totalPages: 10, hasNextPage: false, hasPreviousPage: false },
      }));

      // With maxPages: 1, helper recognizes that records remain despite false hasNextPage, and throws safety boundary error
      await expect(
        fetchCompleteDataset(fetchPageMock, { maxPages: 1 })
      ).rejects.toThrow(CompleteDatasetRetrievalError);
    });

    it("H. failure before reaching maxPages rethrows CompleteDatasetRetrievalError with cause and no partial leakage", async () => {
      const errorCause = new Error("Network connection reset by peer");
      const fetchPageMock = vi.fn(async (page: number) => {
        if (page === 1) {
          return { items: [{ id: "1" }], pagination: { page: 1, pageSize: 1, totalItems: 5, totalPages: 5, hasNextPage: true, hasPreviousPage: false } };
        }
        throw errorCause;
      });

      let caught: CompleteDatasetRetrievalError | undefined;
      try {
        await fetchCompleteDataset(fetchPageMock, { maxPages: 5 });
      } catch (err) {
        caught = err as CompleteDatasetRetrievalError;
      }

      expect(caught).toBeInstanceOf(CompleteDatasetRetrievalError);
      expect(caught?.page).toBe(2);
      expect(caught?.retrievedSoFar).toBe(1);
      expect(caught?.totalExpected).toBe(5);
      expect(caught?.originalCause).toBe(errorCause);
    });
  });
});
