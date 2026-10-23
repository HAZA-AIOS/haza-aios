import { sisRequest } from "./sis-api";
import type { PaginationMetadata } from "./student.service";

export interface CompleteRetrievalOptions<T> {
  /** Maximum pages to retrieve to protect against infinite loops (default: 100 = 200,000 records at 2,000/page) */
  maxPages?: number;
  /** Extract a unique key for deduplication across concurrent record shifts (default: item.id) */
  keyExtractor?: (item: T) => string;
  /** AbortSignal for user or lifecycle cancellation */
  signal?: AbortSignal;
  /** Optional progress callback */
  onProgress?: (progress: { loaded: number; total: number; page: number; totalPages: number }) => void;
}

export class CompleteDatasetRetrievalError extends Error {
  readonly page: number;
  readonly retrievedSoFar: number;
  readonly totalExpected?: number;
  readonly originalCause?: unknown;

  constructor(
    message: string,
    details: { page: number; retrievedSoFar: number; totalExpected?: number; cause?: unknown }
  ) {
    super(message);
    this.name = "CompleteDatasetRetrievalError";
    this.page = details.page;
    this.retrievedSoFar = details.retrievedSoFar;
    this.totalExpected = details.totalExpected;
    this.originalCause = details.cause;
  }
}

/**
 * Reusable bounded dataset retrieval helper.
 *
 * Iteratively fetches paginated batches until the complete authorized dataset is retrieved.
 * Features:
 * - Deterministic iteration until `hasNextPage === false`
 * - Defends against infinite loops with configurable `maxPages` cap
 * - Automatic deduplication by unique key (`item.id`) to protect against concurrent record insertions
 * - Strict error handling: never returns partial data as complete if a request fails mid-stream
 * - Preserves cancellation via `AbortSignal`
 */
export async function fetchCompleteDataset<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; pagination?: PaginationMetadata }>,
  options?: CompleteRetrievalOptions<T>
): Promise<T[]> {
  const maxPages = options?.maxPages ?? 100;
  const keyExtractor = options?.keyExtractor ?? ((item: T) => (item as unknown as { id?: string })?.id ?? "");
  const allRecords: T[] = [];
  const seenKeys = new Set<string>();
  let currentPage = 1;
  let totalItems: number | undefined;
  let moreRecordsRemain = false;

  while (currentPage <= maxPages) {
    if (options?.signal?.aborted) {
      throw new DOMException("Complete dataset retrieval was aborted by user or lifecycle event.", "AbortError");
    }

    let result: { items: T[]; pagination?: PaginationMetadata };
    try {
      result = await fetchPage(currentPage);
    } catch (cause) {
      // Do not return partial data as complete: throw structured error
      throw new CompleteDatasetRetrievalError(
        `Failed to retrieve complete dataset on page ${currentPage}. Retrieved ${allRecords.length} records before failure.`,
        { page: currentPage, retrievedSoFar: allRecords.length, totalExpected: totalItems, cause }
      );
    }

    const items = result.items ?? [];
    if (result.pagination && typeof result.pagination.totalItems === "number") {
      totalItems = result.pagination.totalItems;
    }

    // Deduplicate and accumulate items
    for (const item of items) {
      const key = keyExtractor(item);
      if (key) {
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          allRecords.push(item);
        }
      } else {
        allRecords.push(item);
      }
    }

    if (options?.onProgress && result.pagination) {
      options.onProgress({
        loaded: allRecords.length,
        total: result.pagination.totalItems,
        page: currentPage,
        totalPages: result.pagination.totalPages,
      });
    }

    // Determine whether more records remain after this page
    if (!result.pagination) {
      // Endpoint is unpaginated: finished in single request
      moreRecordsRemain = false;
      break;
    }

    const pagination = result.pagination;
    const hasNextFlag = pagination.hasNextPage === true;
    const hasMorePages =
      typeof pagination.totalPages === "number" && pagination.totalPages > 0 && currentPage < pagination.totalPages;
    const hasMoreItems =
      typeof totalItems === "number" && totalItems >= 0 && allRecords.length < totalItems;

    // Check if pagination explicitly indicates this is the last page
    if (pagination.hasNextPage === false) {
      if (hasMoreItems && items.length > 0) {
        // Inconsistent metadata: hasNextPage is false, but count indicates more records remain
        moreRecordsRemain = true;
      } else {
        // Normal clean completion (including full final page where hasNextPage=false)
        moreRecordsRemain = false;
        break;
      }
    } else if (hasNextFlag || hasMorePages || hasMoreItems) {
      moreRecordsRemain = true;
    } else {
      moreRecordsRemain = false;
      break;
    }

    // Empty page check
    if (items.length === 0) {
      if (hasMoreItems && currentPage > 1) {
        throw new CompleteDatasetRetrievalError(
          `Dataset retrieval received empty page ${currentPage} before reaching expected total of ${totalItems} records.`,
          { page: currentPage, retrievedSoFar: allRecords.length, totalExpected: totalItems }
        );
      }
      moreRecordsRemain = false;
      break;
    }

    // Boundary check: if reached maxPages and more records remain
    if (currentPage >= maxPages && moreRecordsRemain) {
      throw new CompleteDatasetRetrievalError(
        `Dataset retrieval exceeded safety page limit (${maxPages} pages). Bounded retrieval stopped to prevent memory exhaustion.`,
        { page: currentPage, retrievedSoFar: allRecords.length, totalExpected: totalItems }
      );
    }

    currentPage++;
  }

  if (moreRecordsRemain) {
    throw new CompleteDatasetRetrievalError(
      `Dataset retrieval exceeded safety page limit (${maxPages} pages). Bounded retrieval stopped to prevent memory exhaustion.`,
      { page: currentPage, retrievedSoFar: allRecords.length, totalExpected: totalItems }
    );
  }

  return allRecords;
}

/**
 * Convenience helper to fetch a complete SIS dataset across multiple bounded pages
 * using `sisRequest` and the standard dual-envelope API structure.
 */
export async function fetchCompleteSisDataset<T>(
  organizationId: string,
  basePath: string,
  options?: CompleteRetrievalOptions<T>
): Promise<T[]> {
  const [pathname, queryString] = basePath.split("?");
  const initialParams = new URLSearchParams(queryString ?? "");

  return fetchCompleteDataset<T>(async (page: number) => {
    const params = new URLSearchParams(initialParams);
    params.set("all", "true");
    params.set("page", String(page));

    const fullPath = `${pathname}?${params.toString()}`;
    const response = await sisRequest<Record<string, unknown>>(organizationId, fullPath);

    // Look for standard envelope: data, or specific array property
    let items: T[] = [];
    if (Array.isArray(response.data)) {
      items = response.data as T[];
    } else {
      // Find the first array property in response
      for (const [key, val] of Object.entries(response)) {
        if (key !== "pagination" && Array.isArray(val)) {
          items = val as T[];
          break;
        }
      }
    }

    const pagination = response.pagination as PaginationMetadata | undefined;
    return { items, pagination };
  }, options);
}
