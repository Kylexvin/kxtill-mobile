// src/screens/dashboard/hooks/useDashboardSearch.js
//
// Immediate input value + debounced query, plus a helper to filter any
// list by the debounced query. Pre-lowercases fields ONCE per list, so a
// filter pass is O(n) with cheap string compares.
//
// Returning `searching` from the DEBOUNCED query (not the input value) is
// deliberate: skeletons and empty-state only flip when the debounce
// settles, so the user typing "mpesa" doesn't briefly flash "no results"
// on "mp".

import { useEffect, useMemo, useState } from 'react';

const DEFAULT_DELAY = 150;

function lower(str) {
  return String(str ?? '').toLowerCase();
}

export function useDashboardSearch(delay = DEFAULT_DELAY) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!input.trim()) {
      setQuery('');
      return;
    }
    const id = setTimeout(() => setQuery(input.trim().toLowerCase()), delay);
    return () => clearTimeout(id);
  }, [input, delay]);

  const searching = query.length > 0;

  /**
   * @param {Array} list   — source array
   * @param {(item:any) => string[]} pick — fields to match
   * @returns {Array}
   */
  const filter = useMemo(
    () => (list, pick) => {
      if (!searching || !Array.isArray(list)) return list || [];
      return list.filter((item) => {
        const fields = pick(item);
        for (let i = 0; i < fields.length; i++) {
          if (lower(fields[i]).includes(query)) return true;
        }
        return false;
      });
    },
    [searching, query]
  );

  const clear = () => {
    setInput('');
    setQuery('');
  };

  return { input, setInput, query, searching, filter, clear };
}