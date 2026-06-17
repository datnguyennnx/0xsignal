import { useState, useMemo, useCallback } from "react";

interface PaginationState {
  currentPage: number;
  pageSize: number;
}

interface UsePaginationResult<T> {
  pageData: T[];
  totalPages: number;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function usePagination<T>(data: T[], initialPageSize = 20): UsePaginationResult<T> {
  const [state, setState] = useState<PaginationState>({
    currentPage: 1,
    pageSize: initialPageSize,
  });

  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));
  const safeCurrentPage = Math.min(state.currentPage, totalPages);

  const pageData = useMemo(() => {
    const start = (safeCurrentPage - 1) * state.pageSize;
    const end = start + state.pageSize;
    return data.slice(start, end);
  }, [data, safeCurrentPage, state.pageSize]);

  const setPage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, currentPage: Math.max(1, page) }));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setState({ currentPage: 1, pageSize: size });
  }, []);

  const nextPage = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentPage: Math.min(prev.currentPage + 1, totalPages),
    }));
  }, [totalPages]);

  const previousPage = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentPage: Math.max(1, prev.currentPage - 1),
    }));
  }, []);

  return {
    pageData,
    totalPages,
    currentPage: safeCurrentPage,
    pageSize: state.pageSize,
    totalItems,
    setPage,
    setPageSize,
    nextPage,
    previousPage,
    hasNextPage: safeCurrentPage < totalPages,
    hasPreviousPage: safeCurrentPage > 1,
  };
}
