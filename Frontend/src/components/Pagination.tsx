import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalCount,
  pageSize,
  onPageChange,
}) => {
  const totalPages = Math.ceil(totalCount / pageSize);

  if (totalPages <= 1) {
    return null;
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className="flex items-center justify-center gap-4 mt-8">
      <button
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="secondary"
      >
        Previous
      </button>
      <span className="text-gray-300 font-medium">
        Page <span className="text-primary-400">{currentPage}</span> of {totalPages}
        <span className="text-gray-500 ml-2">({totalCount} total)</span>
      </span>
      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="secondary"
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;

