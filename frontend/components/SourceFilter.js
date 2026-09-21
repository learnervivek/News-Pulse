// components/SourceFilter.js
//
// Checkboxes that let the user hide/show news sources.
// A cluster stays on the timeline as long as at least one of its
// articles comes from a source that is still ticked.

export default function SourceFilter({ sources, selectedSources, onToggle }) {
  return (
    <div className="filter">
      <span className="filter-title">Sources:</span>
      {sources.map((source) => (
        <label key={source} className="filter-option">
          <input
            type="checkbox"
            checked={selectedSources.includes(source)}
            onChange={() => onToggle(source)}
          />
          {source}
        </label>
      ))}
    </div>
  );
}
