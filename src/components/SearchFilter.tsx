'use client';

import { Search, Filter, X } from 'lucide-react';
import { useState } from 'react';

interface SearchFilterProps {
  searchPlaceholder?: string;
  onSearch: (term: string) => void;
  filters?: {
    label: string;
    key: string;
    options: { label: string; value: string }[];
  }[];
  onFilterChange?: (filters: Record<string, string>) => void;
  dateFilter?: boolean;
  onDateFilter?: (from: string, to: string) => void;
}

export default function SearchFilter({
  searchPlaceholder = 'بحث...',
  onSearch,
  filters,
  onFilterChange,
  dateFilter,
  onDateFilter,
}: SearchFilterProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    onSearch(value);
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filterValues, [key]: value };
    setFilterValues(newFilters);
    onFilterChange?.(newFilters);
  };

  const handleDateFilter = () => {
    if (dateFrom && dateTo) {
      onDateFilter?.(dateFrom, dateTo);
    }
  };

  const clearFilters = () => {
    setFilterValues({});
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
    onSearch('');
    onFilterChange?.({});
    onDateFilter?.('', '');
  };

  const hasActiveFilters = searchTerm || Object.values(filterValues).some(v => v) || dateFrom || dateTo;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Filter Toggle */}
        {(filters || dateFilter) && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              showFilters ? 'bg-primary-50 text-primary-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Filter size={16} />
            فلاتر
          </button>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            <X size={16} />
            مسح
          </button>
        )}
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filters?.map((filter) => (
            <div key={filter.key}>
              <label className="block text-xs text-slate-500 mb-1">{filter.label}</label>
              <select
                value={filterValues[filter.key] || ''}
                onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">الكل</option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {dateFilter && (
            <>
              <div>
                <label className="block text-xs text-slate-500 mb-1">من تاريخ</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">إلى تاريخ</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  onBlur={handleDateFilter}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
