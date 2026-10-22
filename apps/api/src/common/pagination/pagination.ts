export interface PaginationParams {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
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
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 1;

export function parsePagination(
  source?: URL | URLSearchParams | Record<string, unknown> | null,
  options?: PaginationOptions
): PaginationParams {
  const defaultPageSize = options?.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const maxPageSize = options?.maxPageSize ?? MAX_PAGE_SIZE;

  let rawPage: unknown;
  let rawPageSize: unknown;
  let rawLimit: unknown;
  let rawOffset: unknown;

  if (source instanceof URL) {
    rawPage = source.searchParams.get("page") ?? undefined;
    rawPageSize = source.searchParams.get("pageSize") ?? undefined;
    rawLimit = source.searchParams.get("limit") ?? undefined;
    rawOffset = source.searchParams.get("offset") ?? undefined;
  } else if (source instanceof URLSearchParams) {
    rawPage = source.get("page") ?? undefined;
    rawPageSize = source.get("pageSize") ?? undefined;
    rawLimit = source.get("limit") ?? undefined;
    rawOffset = source.get("offset") ?? undefined;
  } else if (source && typeof source === "object") {
    rawPage = source.page;
    rawPageSize = source.pageSize;
    rawLimit = source.limit;
    rawOffset = source.offset;
  }

  // Parse page size / limit
  let pageSize = defaultPageSize;
  if (rawPageSize !== undefined && rawPageSize !== null && String(rawPageSize).trim() !== "") {
    const parsed = parseInt(String(rawPageSize), 10);
    if (!isNaN(parsed) && Number.isFinite(parsed)) {
      pageSize = Math.min(Math.max(parsed, MIN_PAGE_SIZE), maxPageSize);
    }
  } else if (rawLimit !== undefined && rawLimit !== null && String(rawLimit).trim() !== "") {
    const parsed = parseInt(String(rawLimit), 10);
    if (!isNaN(parsed) && Number.isFinite(parsed)) {
      pageSize = Math.min(Math.max(parsed, MIN_PAGE_SIZE), maxPageSize);
    }
  }

  // Parse page / offset
  let page = DEFAULT_PAGE;
  let offset = 0;

  if (rawOffset !== undefined && rawOffset !== null && String(rawOffset).trim() !== "") {
    const parsedOffset = parseInt(String(rawOffset), 10);
    if (!isNaN(parsedOffset) && Number.isFinite(parsedOffset) && parsedOffset >= 0) {
      offset = parsedOffset;
      page = Math.floor(offset / pageSize) + 1;
    }
  } else if (rawPage !== undefined && rawPage !== null && String(rawPage).trim() !== "") {
    const parsedPage = parseInt(String(rawPage), 10);
    if (!isNaN(parsedPage) && Number.isFinite(parsedPage) && parsedPage >= 1) {
      page = parsedPage;
      offset = (page - 1) * pageSize;
    }
  }

  return {
    page,
    pageSize,
    limit: pageSize,
    offset,
  };
}

export function buildPaginationMetadata(
  totalItems: number,
  pagination: PaginationParams
): PaginationMetadata {
  const safeTotal = Math.max(0, Number.isFinite(totalItems) ? Math.floor(totalItems) : 0);
  const totalPages = Math.ceil(safeTotal / pagination.pageSize);

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
