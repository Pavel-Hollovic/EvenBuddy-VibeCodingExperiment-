export default function FilterBar({
  categories,
  selectedCategories,
  onToggleCategory,
  dateRange,
  onChangeDateRange
}) {
  return (
    <div className="card filter-card">
      <h3>Filters</h3>
      <div className="filter-group">
        <span className="filter-label">Categories</span>
        <div className="filter-options">
          {categories.map((category) => (
            <label key={category} className="checkbox">
              <input
                type="checkbox"
                checked={selectedCategories.has(category)}
                onChange={() => onToggleCategory(category)}
              />
              {category}
            </label>
          ))}
        </div>
      </div>
      <div className="filter-group">
        <span className="filter-label">Date range</span>
        <div className="filter-dates">
          <label>
            Start
            <input
              type="datetime-local"
              value={dateRange.start}
              onChange={(event) => onChangeDateRange({ ...dateRange, start: event.target.value })}
            />
          </label>
          <label>
            End
            <input
              type="datetime-local"
              value={dateRange.end}
              onChange={(event) => onChangeDateRange({ ...dateRange, end: event.target.value })}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
