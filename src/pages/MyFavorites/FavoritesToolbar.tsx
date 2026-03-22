import { Search, Filter, LayoutGrid, List } from 'lucide-react'
import { FilterType, SortType, ViewMode } from './types'

interface FavoritesToolbarProps {
  t: any
  searchQuery: string
  filter: FilterType
  sortBy: SortType
  viewMode: ViewMode
  hasItems: boolean
  isSelectionMode: boolean
  onSearchChange: (value: string) => void
  onFilterChange: (value: FilterType) => void
  onSortChange: (value: SortType) => void
  onViewModeChange: (value: ViewMode) => void
  onToggleSelectionMode: () => void
}

export function FavoritesToolbar({
  t,
  searchQuery,
  filter,
  sortBy,
  viewMode,
  hasItems,
  isSelectionMode,
  onSearchChange,
  onFilterChange,
  onSortChange,
  onViewModeChange,
  onToggleSelectionMode,
}: FavoritesToolbarProps) {
  return (
    <>
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder={t.myFavorites.searchPlaceholder}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              className="input-field pl-12"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-dark-400" />
            <div className="flex bg-dark-800 rounded-lg p-1">
              {(['all', 'video', 'image'] as FilterType[]).map((itemFilter) => (
                <button
                  key={itemFilter}
                  onClick={() => onFilterChange(itemFilter)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    filter === itemFilter
                      ? 'bg-red-500 text-white'
                      : 'text-dark-300 hover:text-white'
                  }`}
                >
                  {itemFilter === 'all'
                    ? t.myFavorites.filterAll
                    : itemFilter === 'video'
                      ? t.myFavorites.filterVideos
                      : t.myFavorites.filterImages}
                </button>
              ))}
            </div>
          </div>

          <div className="md:w-52">
            <select
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value as SortType)}
              className="input-field"
            >
              <option value="recent">{t.myFavorites.sortRecent}</option>
              <option value="oldest">{t.myFavorites.sortOldest}</option>
              <option value="video">{t.myFavorites.sortTypeVideos}</option>
              <option value="image">{t.myFavorites.sortTypeImages}</option>
            </select>
          </div>
        </div>
      </div>

      {hasItems && (
        <div className="flex items-center justify-between">
          <div className="flex bg-dark-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-primary-500 text-white'
                  : 'text-dark-300 hover:text-white'
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary-500 text-white'
                  : 'text-dark-300 hover:text-white'
              }`}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onToggleSelectionMode}
            className="btn-secondary"
          >
            {isSelectionMode ? t.myVideos.cancelSelection : t.myVideos.select}
          </button>
        </div>
      )}
    </>
  )
}
