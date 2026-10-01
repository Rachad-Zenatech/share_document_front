import { useState } from 'react';
import { GitBranch, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';

interface NewProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (title: string, description: string) => void;
  baseVersion: string;
}

export const NewProposalModal: React.FC<NewProposalModalProps> = ({
  open,
  onOpenChange,
  onCreate,
  baseVersion
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a title for the change proposal');
      return;
    }
    onCreate(title.trim(), description.trim());
    setTitle('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl">
        <DialogHeader className="pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <GitBranch className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Create New Change Proposal
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Fork a working copy from <strong className="text-slate-800 dark:text-zinc-200">{baseVersion}</strong> to make your edits. When ready, submit it to the Lead Controller for review and merging.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Proposal Title *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Update Note 4 Acquisitions schedule & figures"
              required
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Summary of Intended Changes
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the purpose of your edits for the Lead Controller..."
              rows={3}
              className="text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Working Branch</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
