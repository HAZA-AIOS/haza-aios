import { ApiError } from "../errors/api-error.js";

export interface PaginationParams {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
  isUnbounded?: boolean;
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
 * 3. Bounded Compatibility (Unbounded Mode):
 *    - If all=true or unbounded=true, returns isUnbounded=true with offset=0 and limit=maxUnboundedLimit (2000).
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
    rawAll = source.searchParams.get("all") ?? source.searchParams.get("unbounded") ?? undefined;
  } else if (source instanceof URLSearchParams) {
    rawPage = source.get("page") ?? undefined;
    rawPageSize = source.get("pageSize") ?? undefined;
    rawLimit = source.get("limit") ?? undefined;
    rawOffset = source.get("offset") ?? undefined;
    rawAll = source.get("all") ?? source.get("unbounded") ?? undefined;
  } else if (source && typeof source === "object") {
    rawPage = source.page;
    rawPageSize = source.pageSize;
    rawLimit = source.limit;
    rawOffset = source.offset;
    rawAll = source.all ?? source.unbounded;
  }

  // Check documented compatibility unbounded flag
  const isUnbounded = rawAll === true || rawAll === "true";
  if (isUnbounded) {
    return {
      page: 1,
      pageSize: maxUnboundedLimit,
      limit: maxUnboundedLimit,
      offset: 0,
      isUnbounded: true,
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
  };
}

export function buildPaginationMetadata(
  totalItems: number,
  pagination: PaginationParams
): PaginationMetadata {
  const safeTotal = Math.max(0, Number.isFinite(totalItems) ? Math.floor(totalItems) : 0);

  if (pagination.isUnbounded) {
    return {
      page: 1,
      pageSize: safeTotal,
      totalItems: safeTotal,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }

  const totalPages = Math.max(1, Math.ceil(safeTotal / pagination.pageSize));

  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalItems: safeTotal,
    totalPages,
    hasNextPage: pagination.page < totalPages,
    hasPreviousPage: pagination.page > 1 && pagination.page <= totalPages + 1,
  };
}

export function paginatedResponse<T>(
  data: T[],
  totalItems: number,
  pagination: PaginationParams
): { data: T[]; pagination: PaginationMetadata } {
  return {
    data,
    pagination: buildPaginationMetadata(totalItems, pagination),
  };
}
