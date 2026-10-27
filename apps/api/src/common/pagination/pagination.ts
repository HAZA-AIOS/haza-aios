import { ApiError } from "../errors/api-error.js";

export interface PaginationParams {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
  isUnbounded?: boolean;
  fetchAllRequested?: boolean;
  boundedFullDatasetMode?: boolean;
  compatibilityBatch?: boolean;
}

export interface PaginationMetadata {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationOptions {
  defaultPageSize?: number;
  maxPageSize?: number;
  maxUnboundedLimit?: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 1;
export const DEFAULT_MAX_UNBOUNDED_LIMIT = 2000;

/**
 * Parses and strictly validates integer strings or numbers.
 * Rejects:
 * - Fractional numbers (e.g. 1.5, "1.5")
 * - Partially numeric strings (e.g. "25abc", "page1")
 * - Negative values when min >= 0
 * - NaN, Infinity, -Infinity
 * - Values outside [min, Number.MAX_SAFE_INTEGER]
 */
function parseStrictInteger(
  value: unknown,
  fieldName: string,
  min: number,
  max: number = Number.MAX_SAFE_INTEGER
): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  // Handle number type directly
  if (typeof value === "number") {
    if (!Number.isFinite(value) || isNaN(value)) {
      throw new ApiError(400, "VALIDATION_FAILED", `Invalid ${fieldName}: must be a finite number.`, [
        { field: fieldName, message: `${fieldName} must be a valid finite integer.` },
      ]);
    }
    if (!Number.isInteger(value)) {
      throw new ApiError(400, "VALIDATION_FAILED", `Invalid ${fieldName}: must be an integer, received float.`, [
        { field: fieldName, message: `${fieldName} must be an integer, received float.` },
      ]);
    }
    if (!Number.isSafeInteger(value)) {
      throw new ApiError(400, "VALIDATION_FAILED", `Invalid ${fieldName}: exceeds maximum safe integer.`, [
        { field: fieldName, message: `${fieldName} exceeds maximum safe integer.` },
      ]);
    }
    if (value < min) {
      throw new ApiError(400, "VALIDATION_FAILED", `Invalid ${fieldName}: must be at least ${min}.`, [
        { field: fieldName, message: `${fieldName} must be at least ${min}.` },
      ]);
    }
    if (value > max) {
      throw new ApiError(400, "VALIDATION_FAILED", `Invalid ${fieldName}: must not exceed ${max}.`, [
        { field: fieldName, message: `${fieldName} must not exceed ${max}.` },
      ]);
    }
    return value;
  }

  // Handle string type strictly
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return undefined;
    }

    // Strict non-negative integer regex (digits only, no decimal point, no signs)
    if (!/^[0-9]+$/.test(trimmed)) {
      throw new ApiError(400, "VALIDATION_FAILED", `Invalid ${fieldName}: must contain digits only.`, [
        { field: fieldName, message: `${fieldName} must be a valid integer containing digits only.` },
      ]);
    }

    const num = Number(trimmed);
    if (!Number.isSafeInteger(num)) {
      throw new ApiError(400, "VALIDATION_FAILED", `Invalid ${fieldName}: exceeds maximum safe integer.`, [
        { field: fieldName, message: `${fieldName} exceeds maximum safe integer.` },
      ]);
    }
    if (num < min) {
      throw new ApiError(400, "VALIDATION_FAILED", `Invalid ${fieldName}: must be at least ${min}.`, [
        { field: fieldName, message: `${fieldName} must be at least ${min}.` },
      ]);
    }
    if (num > max) {
      throw new ApiError(400, "VALIDATION_FAILED", `Invalid ${fieldName}: must not exceed ${max}.`, [
        { field: fieldName, message: `${fieldName} must not exceed ${max}.` },
      ]);
    }
    return num;
  }

  // Any other type is rejected
  throw new ApiError(400, "VALIDATION_FAILED", `Invalid ${fieldName}: expected integer.`, [
    { field: fieldName, message: `${fieldName} must be a valid integer.` },
  ]);
}

/**
 * Deterministically parses pagination parameters with strict integer validation
 * and documented precedence rules.
 *
 * Precedence Rules:
 * 1. Page Size vs Limit:
 *    - If both pageSize and limit are provided, pageSize takes precedence.
 *    - If only limit is provided, limit is used as pageSize.
 *    - Both are strictly clamped between MIN_PAGE_SIZE (1) and maxPageSize (default 100).
 * 2. Page vs Offset:
 *    - If both page and offset are provided, page takes precedence. Offset is computed as (page - 1) * pageSize.
 *    - If only offset is provided, offset is respected and page is derived as Math.floor(offset / pageSize) + 1.
 * 3. Bounded Compatibility (Unbounded Mode / Full Dataset Mode):
 *    - If all=true or unbounded=true, sets pageSize and limit to maxUnboundedLimit (2000).
 *    - Supports optional bounded iteration across batches via page (e.g. all=true&page=2).
 *    - This provides a safe, documented compatibility path for operational rosters and reports without unbounded memory risks.
 * 4. Multiplication Overflow:
 *    - Offset computation verifies that (page - 1) * pageSize does not exceed Number.MAX_SAFE_INTEGER.
 */
export function parsePagination(
  source?: URL | URLSearchParams | Record<string, unknown> | null,
  options?: PaginationOptions
): PaginationParams {
  const defaultPageSize = options?.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const maxPageSize = options?.maxPageSize ?? MAX_PAGE_SIZE;
  const maxUnboundedLimit = options?.maxUnboundedLimit ?? DEFAULT_MAX_UNBOUNDED_LIMIT;

  let rawPage: unknown;
  let rawPageSize: unknown;
  let rawLimit: unknown;
  let rawOffset: unknown;
  let rawAll: unknown;

  if (source instanceof URL) {
    rawPage = source.searchParams.get("page") ?? undefined;
    rawPageSize = source.searchParams.get("pageSize") ?? undefined;
    rawLimit = source.searchParams.get("limit") ?? undefined;
    rawOffset = source.searchParams.get("offset") ?? undefined;
    rawAll =
      source.searchParams.get("all") ??
      source.searchParams.get("unbounded") ??
      source.searchParams.get("fetchAllRequested") ??
      source.searchParams.get("boundedFullDatasetMode") ??
      source.searchParams.get("compatibilityBatch") ??
      undefined;
  } else if (source instanceof URLSearchParams) {
    rawPage = source.get("page") ?? undefined;
    rawPageSize = source.get("pageSize") ?? undefined;
    rawLimit = source.get("limit") ?? undefined;
    rawOffset = source.get("offset") ?? undefined;
    rawAll =
      source.get("all") ??
      source.get("unbounded") ??
      source.get("fetchAllRequested") ??
      source.get("boundedFullDatasetMode") ??
      source.get("compatibilityBatch") ??
      undefined;
  } else if (source && typeof source === "object") {
    rawPage = source.page;
    rawPageSize = source.pageSize;
    rawLimit = source.limit;
    rawOffset = source.offset;
    rawAll =
      source.all ??
      source.unbounded ??
      source.fetchAllRequested ??
      source.boundedFullDatasetMode ??
      source.compatibilityBatch;
  }

  // Check documented compatibility unbounded / full dataset flag
  const isUnbounded = rawAll === true || rawAll === "true";
  if (isUnbounded) {
    const parsedPage = parseStrictInteger(rawPage, "page", 1);
    const parsedOffset = parseStrictInteger(rawOffset, "offset", 0);

    let page = DEFAULT_PAGE;
    let offset = 0;

    if (parsedPage !== undefined) {
      page = parsedPage;
      const maxSafePage = Math.floor(Number.MAX_SAFE_INTEGER / maxUnboundedLimit) + 1;
      if (page > maxSafePage) {
        throw new ApiError(400, "VALIDATION_FAILED", "page value is too large and causes offset overflow.", [
          { field: "page", message: "page value causes multiplication overflow when computing offset." },
        ]);
      }
      offset = (page - 1) * maxUnboundedLimit;
    } else if (parsedOffset !== undefined) {
      offset = parsedOffset;
      page = Math.floor(offset / maxUnboundedLimit) + 1;
    }

    return {
      page,
      pageSize: maxUnboundedLimit,
      limit: maxUnboundedLimit,
      offset,
      isUnbounded: true,
      fetchAllRequested: true,
      boundedFullDatasetMode: true,
      compatibilityBatch: true,
    };
  }

  // Parse page size and limit strictly (must be positive integer >= 1)
  const parsedPageSize = parseStrictInteger(rawPageSize, "pageSize", MIN_PAGE_SIZE);
  const parsedLimit = parseStrictInteger(rawLimit, "limit", MIN_PAGE_SIZE);

  // Precedence Rule: pageSize takes precedence over limit
  let pageSize = defaultPageSize;
  if (parsedPageSize !== undefined) {
    pageSize = Math.min(Math.max(parsedPageSize, MIN_PAGE_SIZE), maxPageSize);
  } else if (parsedLimit !== undefined) {
    pageSize = Math.min(Math.max(parsedLimit, MIN_PAGE_SIZE), maxPageSize);
  }

  // Parse page strictly (must be >= 1) and offset strictly (must be >= 0)
  const parsedPage = parseStrictInteger(rawPage, "page", 1);
  const parsedOffset = parseStrictInteger(rawOffset, "offset", 0);

  // Precedence Rule: page takes precedence over offset
  let page = DEFAULT_PAGE;
  let offset = 0;

  if (parsedPage !== undefined) {
    page = parsedPage;
    // Multiplication overflow protection
    const maxSafePage = Math.floor(Number.MAX_SAFE_INTEGER / pageSize) + 1;
    if (page > maxSafePage) {
      throw new ApiError(400, "VALIDATION_FAILED", "page value is too large and causes offset overflow.", [
        { field: "page", message: "page value causes multiplication overflow when computing offset." },
      ]);
    }
    offset = (page - 1) * pageSize;
  } else if (parsedOffset !== undefined) {
    offset = parsedOffset;
    page = Math.floor(offset / pageSize) + 1;
  }

  return {
    page,
    pageSize,
    limit: pageSize,
    offset,
    isUnbounded: false,
    fetchAllRequested: false,
    boundedFullDatasetMode: false,
    compatibilityBatch: false,
  };
}

/**
 * Builds truthful, accurate pagination metadata.
 * Never claims an incomplete dataset is complete:
 * - Accurately computes totalPages based on totalItems and pageSize
 * - Accurately sets hasNextPage to true if remaining items exist beyond the current page
 * - Preserves existing metadata contract keys
 */
export function buildPaginationMetadata(
  totalItems: number,
  pagination: PaginationParams
): PaginationMetadata {
  const safeTotal = Math.max(0, Number.isFinite(totalItems) ? Math.floor(totalItems) : 0);
  const pageSize = pagination.pageSize > 0 ? pagination.pageSize : DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize));
  const page = pagination.page;

  return {
    page,
    pageSize,
    totalItems: safeTotal,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && page <= totalPages + 1,
  };
}

export function paginatedResponse<T, K extends string = string>(
  data: T[],
  totalItems: number,
  pagination: PaginationParams,
  entityKey?: K
): { data: T[]; pagination: PaginationMetadata } & { [P in K]?: T[] } {
  const result: Record<string, unknown> = {
    data,
    pagination: buildPaginationMetadata(totalItems, pagination),
  };
  if (entityKey) {
    result[entityKey] = data;
  }
  return result as { data: T[]; pagination: PaginationMetadata } & { [P in K]?: T[] };
}

export class IncompleteDatasetRetrievalError extends Error {
  readonly page: number;
  readonly retrievedSoFar: number;
  readonly totalExpected?: number;
  readonly originalCause?: unknown;

  constructor(
    message: string,
    details: { page: number; retrievedSoFar: number; totalExpected?: number; cause?: unknown }
  ) {
    super(message);
    this.name = "IncompleteDatasetRetrievalError";
    this.page = details.page;
    this.retrievedSoFar = details.retrievedSoFar;
    this.totalExpected = details.totalExpected;
    this.originalCause = details.cause;
  }
}

export const CompleteDatasetRetrievalError = IncompleteDatasetRetrievalError;
export type CompleteDatasetRetrievalError = IncompleteDatasetRetrievalError;

export type BatchFetchResult<T> =
  | { data: T[]; pagination?: PaginationMetadata }
  | { items: T[]; total?: number; pagination?: PaginationMetadata };

export interface FetchAllBatchesOptions<T> {
  maxPages?: number;
  batchSize?: number;
  keyExtractor?: (item: T) => string;
  signal?: AbortSignal;
}

/**
 * Server-side reusable bounded retrieval helper.
 * Iterates through batches until all records are retrieved, with loop protection.
 *
 * Requirements:
 * - Deterministic iteration until completion.
 * - Protects against memory exhaustion with configurable maxPages.
 * - Throws IncompleteDatasetRetrievalError when maxPages is reached and more records remain.
 * - Never returns partial results as complete on failure or boundary limit.
 * - Handles full final pages (hasNextPage: false) cleanly without false error.
 * - Preserves deduplication, cancellation, and error context.
 */
export async function fetchAllBatches<T>(
  fetchBatch: (pagination: { limit: number; offset: number; page: number }) => Promise<BatchFetchResult<T>>,
  options?: FetchAllBatchesOptions<T>
): Promise<T[]> {
  const maxPages = options?.maxPages ?? 100;
  const batchSize = options?.batchSize ?? DEFAULT_MAX_UNBOUNDED_LIMIT;
  const keyExtractor = options?.keyExtractor;
  const allRecords: T[] = [];
  const seenKeys = new Set<string>();
  let currentPage = 1;
  let totalItems: number | undefined;
  let moreRecordsRemain = false;

  while (currentPage <= maxPages) {
    if (options?.signal?.aborted) {
      throw new Error("Complete batch retrieval was aborted by user or lifecycle event.");
    }

    const offset = (currentPage - 1) * batchSize;
    let result: BatchFetchResult<T>;
    try {
      result = await fetchBatch({ limit: batchSize, offset, page: currentPage });
    } catch (cause) {
      throw new IncompleteDatasetRetrievalError(
        `Failed to retrieve complete dataset on batch page ${currentPage}. Retrieved ${allRecords.length} records before failure.`,
        { page: currentPage, retrievedSoFar: allRecords.length, totalExpected: totalItems, cause }
      );
    }

    const items = ("data" in result ? result.data : result.items) ?? [];
    if (result.pagination && typeof result.pagination.totalItems === "number") {
      totalItems = result.pagination.totalItems;
    } else if ("total" in result && typeof result.total === "number") {
      totalItems = result.total;
    }

    for (const item of items) {
      if (keyExtractor) {
        const key = keyExtractor(item);
        if (key) {
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allRecords.push(item);
          }
        } else {
          allRecords.push(item);
        }
      } else {
        allRecords.push(item);
      }
    }

    // Determine completion status
    if (result.pagination) {
      const pagination = result.pagination;
      const hasNextFlag = pagination.hasNextPage === true;
      const hasMorePages =
        typeof pagination.totalPages === "number" && pagination.totalPages > 0 && currentPage < pagination.totalPages;
      const hasMoreItems =
        typeof totalItems === "number" && totalItems >= 0 && allRecords.length < totalItems;

      if (pagination.hasNextPage === false) {
        if (hasMoreItems && items.length > 0) {
          // Inconsistent metadata: hasNextPage false, but count indicates more items remain
          moreRecordsRemain = true;
        } else {
          // Clean completion (including full final page where hasNextPage=false)
          moreRecordsRemain = false;
          break;
        }
      } else if (hasNextFlag || hasMorePages || hasMoreItems) {
        moreRecordsRemain = true;
      } else {
        moreRecordsRemain = false;
        break;
      }
    } else if (typeof totalItems === "number") {
      const totalPages = Math.max(1, Math.ceil(totalItems / batchSize));
      const hasMorePages = currentPage < totalPages;
      const hasMoreItems = allRecords.length < totalItems;

      if (hasMorePages || hasMoreItems) {
        moreRecordsRemain = true;
      } else {
        moreRecordsRemain = false;
        break;
      }
    } else {
      // Unpaginated or batch without explicit total metadata
      if (items.length === batchSize) {
        moreRecordsRemain = true;
      } else {
        moreRecordsRemain = false;
        break;
      }
    }

    // Empty batch check
    if (items.length === 0) {
      if (currentPage > 1 && typeof totalItems === "number" && allRecords.length < totalItems) {
        throw new IncompleteDatasetRetrievalError(
          `Dataset retrieval received empty batch on page ${currentPage} before reaching expected total of ${totalItems} records.`,
          { page: currentPage, retrievedSoFar: allRecords.length, totalExpected: totalItems }
        );
      }
      moreRecordsRemain = false;
      break;
    }

    // Boundary check: if reached maxPages and more records remain
    if (currentPage >= maxPages && moreRecordsRemain) {
      throw new IncompleteDatasetRetrievalError(
        `Dataset retrieval exceeded safety page limit (${maxPages} pages). Bounded retrieval stopped to prevent memory exhaustion.`,
        { page: currentPage, retrievedSoFar: allRecords.length, totalExpected: totalItems }
      );
    }

    currentPage++;
  }

  if (moreRecordsRemain) {
    throw new IncompleteDatasetRetrievalError(
      `Dataset retrieval exceeded safety page limit (${maxPages} pages). Bounded retrieval stopped to prevent memory exhaustion.`,
      { page: currentPage, retrievedSoFar: allRecords.length, totalExpected: totalItems }
    );
  }

  return allRecords;
}
