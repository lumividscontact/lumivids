import { Search, Filter, Grid, List } from 'lucide-react'
import { FilterType, ViewMode, DurationFilter, SortBy, StatusFilter, MediaFilters, MY_VIDEOS_FALLBACK } from './types'

interface MediaFiltersBarProps {
  filters: MediaFilters
  onFilterChange: <K extends keyof MediaFilters>(key: K, value: MediaFilters[K]) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  modelOptions: string[]
  aspectOptions: string[]
  translations?: typeof MY_VIDEOS_FALLBACK
}

export function MediaFiltersBar({
  filters,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  viewMode,
  onViewModeChange,
  modelOptions,
  aspectOptions,
  translations = MY_VIDEOS_FALLBACK,
}: MediaFiltersBarProps) {
  const t = translations

  return (
    <div className="card">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Search */}
        <div className="lg:col-span-4 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={filters.searchQuery}
            onChange={(e) => onFilterChange('searchQuery', e.target.value)}
            className="input-field pl-12"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2 lg:col-span-3">
          <Filter className="w-5 h-5 text-dark-400" />
          <div className="flex bg-dark-800 rounded-lg p-1">
            {(['all', 'video', 'image'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => onFilterChange('filter', f)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filters.filter === f
                    ? 'bg-primary-500 text-white'
                    : 'text-dark-300 hover:text-white'
                }`}
              >
                {f === 'all' ? t.filterAll : f === 'video' ? t.filterVideos : t.filterImages}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="lg:col-span-3 flex items-center gap-2">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onFilterChange('dateFrom', e.target.value)}
            aria-label={t.dateFromLabel}
            title={t.dateFromLabel}
            className="input-field"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onFilterChange('dateTo', e.target.value)}
            aria-label={t.dateToLabel}
            title={t.dateToLabel}
            className="input-field"
          />
        </div>

        {/* View Mode */}
        <div className="flex bg-dark-800 rounded-lg p-1 lg:col-span-2 justify-self-end">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-dark-700 text-white' : 'text-dark-400 hover:text-white'
            }`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-dark-700 text-white' : 'text-dark-400 hover:text-white'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
        <select
          value={filters.modelFilter}
          onChange={(e) => onFilterChange('modelFilter', e.target.value)}
          className="input-field"
        >
          <option value="all">{t.modelAll}</option>
          {modelOptions.map((model) => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>

        <select
          value={filters.durationFilter}
          onChange={(e) => onFilterChange('durationFilter', e.target.value as DurationFilter)}
          className="input-field"
        >
          <option value="all">{t.durationAll}</option>
          <option value="short">{t.durationShort}</option>
          <option value="medium">{t.durationMedium}</option>
          <option value="long">{t.durationLong}</option>
        </select>

        <select
          value={filters.aspectFilter}
          onChange={(e) => onFilterChange('aspectFilter', e.target.value)}
          className="input-field"
        >
          <option value="all">{t.aspectAll}</option>
          {aspectOptions.map((ratio) => (
            <option key={ratio} value={ratio}>{ratio}</option>
          ))}
        </select>

        <select
          value={filters.sortBy}
          onChange={(e) => onFilterChange('sortBy', e.target.value as SortBy)}
          className="input-field"
        >
          <option value="recent">{t.sortRecent}</option>
          <option value="cost">{t.sortCost}</option>
          <option value="duration">{t.sortDuration}</option>
        </select>

        <select
          value={filters.statusFilter}
          onChange={(e) => onFilterChange('statusFilter', e.target.value as StatusFilter)}
          className="input-field"
        >
          <option value="all">{t.statusAll}</option>
          <option value="ready">{t.statusReady}</option>
          <option value="processing">{t.statusProcessing}</option>
          <option value="failed">{t.statusFailed}</option>
        </select>
      </div>

      {hasActiveFilters && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClearFilters}
            className="btn-secondary"
          >
            {t.clearFilters}
          </button>
        </div>
      )}
    </div>
  )
}
