import React from 'react';

/**
 * Simple client-side pagination bar.
 *
 * Props:
 *   total      — total number of items
 *   page       — current page (0-indexed)
 *   pageSize   — items per page (default 20)
 *   onPage     — callback(newPage)
 */
export default function Pagination({ total, page, pageSize = 20, onPage }) {
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount <= 1) return null;

  const pages = [];
  for (let i = 0; i < pageCount; i++) pages.push(i);

  return (
    <div className="pagination">
      <button
        className="pagination-btn"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      >
        ‹
      </button>

      {pages.map((p) => (
        <button
          key={p}
          className={`pagination-btn${p === page ? ' active' : ''}`}
          onClick={() => onPage(p)}
        >
          {p + 1}
        </button>
      ))}

      <button
        className="pagination-btn"
        disabled={page === pageCount - 1}
        onClick={() => onPage(page + 1)}
      >
        ›
      </button>

      <span className="pagination-info">
        {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
      </span>
    </div>
  );
}
