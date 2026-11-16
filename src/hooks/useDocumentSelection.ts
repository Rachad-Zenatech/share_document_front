import { useCallback, useEffect, useMemo, useState } from 'react';

/** Which documents of the visible list are ticked, for deleting several at once. */
export function useDocumentSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // A document that is filtered out or removed can't stay ticked.
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(visibleIds);
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleIds]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(visibleIds));
  }, [allSelected, visibleIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  return useMemo(
    () => ({ selected, selectedIds: [...selected], count: selected.size, allSelected, toggle, toggleAll, clear }),
    [selected, allSelected, toggle, toggleAll, clear],
  );
}
