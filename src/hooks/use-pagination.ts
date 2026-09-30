import { useState } from "react";

// Plain local state (not URL-persisted) — deliberately simple so any list page can adopt it by
// adding one line, rather than every page needing its own zod search-param schema. `data`/`meta`
// accept the exact shape `apiJson` gets back from a paginated endpoint (`{ data, total, page,
// pageSize }`) or `undefined` while loading, and resets page to 1 whenever pageSize changes so
// you never land on an empty out-of-range page after widening the page size.
export function usePagination(initialPageSize = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  return {
    page,
    pageSize,
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    },
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
