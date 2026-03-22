import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { MY_VIDEOS_FALLBACK, MyVideosTranslations } from './types'

interface PaginationProps {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  translations?: MyVideosTranslations
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  translations = MY_VIDEOS_FALLBACK,
}: PaginationProps) {
  const t = translations
  const maxVisiblePages = 5
  let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2))
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1)
  }
  const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)

  const startItem = (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-dark-400">
        {startItem} - {endItem} / {totalItems}
      </span>
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          className="btn-secondary px-3 py-2"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          title={t.paginationFirst}
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        
        {/* Previous Page */}
        <button
          className="btn-secondary px-3 py-2"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        
        {/* Start ellipsis */}
        {startPage > 1 && (
          <span className="px-2 text-dark-400">...</span>
        )}
        
        {/* Page Numbers */}
        {pageNumbers.map((num) => (
          <button
            key={num}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              num === page
                ? 'bg-primary-500 text-white'
                : 'bg-dark-800 text-dark-300 hover:bg-dark-700 hover:text-white'
            }`}
            onClick={() => onPageChange(num)}
          >
            {num}
          </button>
        ))}
        
        {/* End ellipsis */}
        {endPage < totalPages && (
          <span className="px-2 text-dark-400">...</span>
        )}
        
        {/* Next Page */}
        <button
          className="btn-secondary px-3 py-2"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        
        {/* Last Page */}
        <button
          className="btn-secondary px-3 py-2"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          title={t.paginationLast}
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
