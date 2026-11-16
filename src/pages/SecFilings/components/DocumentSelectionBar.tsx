import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';

interface DocumentSelectionBarProps {
  total: number;
  count: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onClear: () => void;
  onDeleteSelected: () => void;
}

/** "Select all" with the count of ticked documents and a button to delete them (after a confirmation). */
export const DocumentSelectionBar: React.FC<DocumentSelectionBarProps> = ({
  total,
  count,
  allSelected,
  onToggleAll,
  onClear,
  onDeleteSelected,
}) => {
  const [confirming, setConfirming] = useState(false);
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <Checkbox
          checked={allSelected ? true : count > 0 ? 'indeterminate' : false}
          onCheckedChange={onToggleAll}
          aria-label="Select all documents"
        />
        <span>Select all</span>
      </label>
      {count > 0 && (
        <>
          <span className="text-muted-foreground">{count} selected</span>
          <button type="button" onClick={onClear} className="text-slate-500 hover:text-slate-900 underline">
            Clear
          </button>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs gap-1.5 ml-auto"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete selected ({count})
          </Button>
        </>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm text-destructive flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Remove {count} document{count === 1 ? '' : 's'}?
            </DialogTitle>
            <DialogDescription className="text-xs">
              The selected documents will be removed from your recent documents list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setConfirming(false);
                onDeleteSelected();
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
