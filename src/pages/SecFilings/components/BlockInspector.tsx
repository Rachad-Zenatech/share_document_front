import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Clock,
  User,
  X,
  Image as ImageIcon,
  Upload,
  FolderArchive
} from 'lucide-react';
import type { SecBlock } from '../../../types/secFiling';
import { MediaBucketModal } from './MediaBucketModal';
import { mediaBucketService } from '../../../services/mediaBucketService';
import { ZENATECH_LOGO_DATA_URL } from '../../../data/zenatechLogoAsset';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';

interface BlockInspectorProps {
  block: SecBlock | null;
  onUpdate: (updates: Partial<SecBlock>) => void;
  onClose: () => void;
  sections?: string[];
}

export const BlockInspector: React.FC<BlockInspectorProps> = ({
  block,
  onUpdate,
  onClose
}) => {
  const [isMediaBucketOpen, setIsMediaBucketOpen] = useState(false);

  if (!block) {
    return (
      <div className="w-full bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-6 text-center space-y-3 text-slate-400">
        <SlidersHorizontal className="w-6 h-6 mx-auto stroke-1" />
        <p className="text-xs">Select any block in the canvas to inspect and configure its attributes.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-purple-600" />
          <h3 className="font-semibold text-xs text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
            Block Inspector
          </h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Block Metadata */}
      <div className="space-y-3 text-xs">
        <div>
          <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block mb-1">
            Assigned Section / Statement
          </label>
          <Input
            value={block.section}
            onChange={(e) => onUpdate({ section: e.target.value })}
            placeholder="e.g. Note 3: Material Accounting Policies"
            className="h-8 text-xs font-medium"
          />
        </div>

        <div>
          <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block mb-1">
            Block Type
          </label>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs capitalize">
              {block.type.replace('_', ' ')}
            </Badge>
            <span className="text-[11px] text-slate-400 font-mono">ID: {block.id}</span>
          </div>
        </div>

        {/* Top Spacing Gap: Editable number input with label on top */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[11px] font-bold text-slate-800 dark:text-zinc-100 block uppercase tracking-wider">
                Top Spacing Gap
              </label>
              <span className="text-[10px] text-slate-400 block">
                Adjust vertical position of this block (does not move other blocks)
              </span>
            </div>
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded-lg border border-slate-300 dark:border-zinc-700 shadow-2xs">
              <input
                type="number"
                min={-20}
                max={150}
                step={1}
                value={typeof block.spacingTop === 'number' ? block.spacingTop : 0}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  onUpdate({ spacingTop: !isNaN(val) ? val : 0 });
                }}
                className="w-12 text-center text-xs font-mono font-bold text-blue-600 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Write a number in pixels for top spacing gap"
              />
              <span className="text-[10px] font-mono text-slate-400">px</span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="range"
              min={-20}
              max={120}
              step={1}
              value={typeof block.spacingTop === 'number' ? block.spacingTop : 0}
              onChange={(e) => onUpdate({ spacingTop: Number(e.target.value) })}
              className="flex-1 accent-blue-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg"
            />
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onUpdate({
                    spacingTop: Math.max(-20, (typeof block.spacingTop === 'number' ? block.spacingTop : 0) - 2)
                  })
                }
                className="h-6 w-6 p-0 text-xs font-bold"
                title="Decrease gap by 2px (Make closer)"
              >
                -
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onUpdate({
                    spacingTop: Math.min(150, (typeof block.spacingTop === 'number' ? block.spacingTop : 0) + 2)
                  })
                }
                className="h-6 w-6 p-0 text-xs font-bold"
                title="Increase gap by 2px (Make farther)"
              >
                +
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onUpdate({ spacingTop: 0 })}
                className="h-6 px-1.5 text-[10px] text-slate-400 hover:text-red-500 font-medium"
                title="Reset top spacing gap to 0px"
              >
                Reset
              </Button>
            </div>
          </div>
        </div>

        {/* Block Spacing & Margin Preset Modes */}
        <div>
          <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block mb-1">
            Block Spacing Mode
          </label>
          <div className="grid grid-cols-4 gap-1">
            {(['compact', 'normal', 'relaxed', 'loose'] as const).map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => onUpdate({ spacing: sp })}
                className={`py-1 px-1.5 rounded text-[10px] font-semibold capitalize border transition-all ${
                  (block.spacing || 'normal') === sp
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-100'
                }`}
              >
                {sp}
              </button>
            ))}
          </div>
        </div>

        {/* Typography & Alignment (for text-based blocks) */}
        {(block.type === 'heading' || block.type === 'paragraph') && (
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Typography & Formatting
            </label>

            {/* Font Family */}
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Font Family</label>
              <select
                value={(block as any).fontFamily || 'Calibri, "Segoe UI", Arial, sans-serif'}
                onChange={(e) => onUpdate({ fontFamily: e.target.value } as any)}
                className="w-full text-xs h-8 px-2 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value='Calibri, "Segoe UI", Arial, sans-serif'>Calibri (Word Standard)</option>
                <option value='Aptos, "Segoe UI", sans-serif'>Aptos (Modern Office)</option>
                <option value='Arial, Helvetica, sans-serif'>Arial (Clean Sans)</option>
                <option value='"Times New Roman", Times, serif'>Times New Roman (Formal)</option>
                <option value='Georgia, serif'>Georgia (Editorial)</option>
                <option value='Garamond, "EB Garamond", serif'>Garamond (Executive)</option>
                <option value='"Courier New", Courier, monospace'>Courier New (Monospace)</option>
              </select>
            </div>

            {/* Font Size */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-slate-500">Font Size</label>
                <span className="text-xs font-mono font-bold text-blue-600">
                  {(block as any).fontSize || (block.type === 'heading' ? 16 : 14)}pt
                </span>
              </div>
              <input
                type="range"
                min={9}
                max={36}
                step={1}
                value={(block as any).fontSize || (block.type === 'heading' ? 16 : 14)}
                onChange={(e) => onUpdate({ fontSize: Number(e.target.value) } as any)}
                className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg"
              />
            </div>

            {/* Alignment Buttons */}
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Text Alignment</label>
              <div className="grid grid-cols-4 gap-1">
                {(['left', 'center', 'right', 'justify'] as const).map((al) => (
                  <button
                    key={al}
                    type="button"
                    onClick={() => onUpdate({ alignment: al } as any)}
                    className={`py-1 px-1 rounded text-[10px] font-medium capitalize border transition-all ${
                      ((block as any).alignment || 'left') === al
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-100'
                    }`}
                  >
                    {al}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Style Toggles */}
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Style Modifiers</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdate({ bold: !(block as any).bold } as any)}
                  className={`flex-1 py-1 rounded text-xs font-bold border transition-all ${
                    (block as any).bold ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-700'
                  }`}
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ italic: !(block as any).italic } as any)}
                  className={`flex-1 py-1 rounded text-xs italic border transition-all ${
                    (block as any).italic ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-700'
                  }`}
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ underline: !(block as any).underline } as any)}
                  className={`flex-1 py-1 rounded text-xs underline border transition-all ${
                    (block as any).underline ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-700'
                  }`}
                >
                  U
                </button>
              </div>
            </div>

            {/* Text Color */}
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Text Color</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { name: 'Navy', color: '#0E2841' },
                  { name: 'Charcoal', color: '#111827' },
                  { name: 'Slate', color: '#64748B' },
                  { name: 'Blue', color: '#2563EB' },
                  { name: 'Red', color: '#DC2626' },
                  { name: 'Green', color: '#16A34A' }
                ].map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => onUpdate({ color: c.color } as any)}
                    className="w-5 h-5 rounded-full border border-slate-300 dark:border-zinc-700 shadow-2xs hover:scale-110 transition-transform"
                    style={{ backgroundColor: c.color }}
                    title={c.name}
                  />
                ))}
                <input
                  type="color"
                  value={(block as any).color || '#111827'}
                  onChange={(e) => onUpdate({ color: e.target.value } as any)}
                  className="w-6 h-6 p-0 border border-slate-300 rounded cursor-pointer ml-auto"
                  title="Custom Color"
                />
              </div>
            </div>
          </div>
        )}

        {/* Specialized settings per block type */}
        {block.type === 'paragraph' && (
          <div>
            <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block mb-1">
              Note Disclosure Reference Number
            </label>
            <Input
              value={block.noteNumber || ''}
              onChange={(e) => onUpdate({ noteNumber: e.target.value })}
              placeholder="e.g. Note 3 or Note 7"
              className="h-8 text-xs"
            />
          </div>
        )}

        {block.type === 'financial_table' && (
          <div className="space-y-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800">
            <div className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
              Financial Schedule Settings
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Schedule / Table Title</label>
              <Input
                value={block.title || ''}
                onChange={(e) => onUpdate({ title: e.target.value })}
                placeholder="e.g. Consolidated Statements of Financial Position"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Header Row Shading</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { name: 'SEC Cyan', color: '#CCECFF' },
                  { name: 'Soft Ice', color: '#E0F2FE' },
                  { name: 'Light Slate', color: '#E2E8F0' },
                  { name: 'Pale Yellow', color: '#FEF9C3' },
                  { name: 'Mint Soft', color: '#DCFCE7' },
                  { name: 'Transparent', color: 'transparent' }
                ].map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => onUpdate({ headerShading: c.color })}
                    className="w-5 h-5 rounded border border-slate-300 dark:border-zinc-700 shadow-2xs hover:scale-110 transition-transform"
                    style={{ backgroundColor: c.color }}
                    title={c.name}
                  />
                ))}
                <input
                  type="color"
                  value={block.headerShading || '#CCECFF'}
                  onChange={(e) => onUpdate({ headerShading: e.target.value })}
                  className="w-6 h-6 p-0 border border-slate-300 rounded cursor-pointer ml-auto"
                  title="Custom Header Shading"
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200 dark:border-zinc-700">
              <span>Rows: <strong>{block.rows.length}</strong></span>
              <span>Columns: <strong>{block.headers.length}</strong></span>
            </div>
          </div>
        )}

        {block.type === 'callout' && (
          <div className="space-y-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800">
            <div className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
              Auditor Notice & Callout Settings
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Notice Variant / Badge</label>
              <div className="grid grid-cols-3 gap-1">
                {(['notice', 'warning', 'info', 'unaudited', 'success'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onUpdate({ variant: v })}
                    className={`py-1 px-1 rounded text-[10px] font-medium capitalize border transition-all ${
                      block.variant === v
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-100'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Callout Title</label>
              <Input
                value={block.title || ''}
                onChange={(e) => onUpdate({ title: e.target.value })}
                placeholder="e.g. Unaudited Interim Period"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        {block.type === 'signature' && (
          <div className="space-y-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800">
            <div className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
              Signatures & Officers
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Section Title</label>
              <Input
                value={block.title || ''}
                onChange={(e) => onUpdate({ title: e.target.value })}
                placeholder="e.g. SIGNATURES"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-500">Signers ({block.officers.length})</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newOfficer = {
                      id: `off-${Date.now()}`,
                      name: '',
                      title: 'Chief Financial Officer',
                      signatureText: '',
                      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                      signed: false
                    };
                    onUpdate({ officers: [...block.officers, newOfficer] });
                  }}
                  className="h-6 text-[10px] px-2"
                >
                  + Add Officer
                </Button>
              </div>

              {block.officers.map((off, idx) => (
                <div key={off.id || idx} className="p-2 bg-white dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700 space-y-1 text-xs">
                  <Input
                    value={off.name}
                    onChange={(e) => {
                      const next = [...block.officers];
                      next[idx] = { ...next[idx], name: e.target.value };
                      onUpdate({ officers: next });
                    }}
                    placeholder="Officer Name"
                    className="h-6 text-xs font-semibold"
                  />
                  <Input
                    value={off.title}
                    onChange={(e) => {
                      const next = [...block.officers];
                      next[idx] = { ...next[idx], title: e.target.value };
                      onUpdate({ officers: next });
                    }}
                    placeholder="Title (e.g. CEO)"
                    className="h-6 text-xs text-slate-600"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {block.type === 'divider' && (
          <div className="space-y-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800">
            <div className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
              Divider / Section Break
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Divider Label</label>
              <Input
                value={block.label || ''}
                onChange={(e) => onUpdate({ label: e.target.value })}
                placeholder="e.g. Page Break / Next Section"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        {block.type === 'metadata' && (
          <div className="space-y-2.5 p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800">
            <div className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
              Filing Header Details
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Company Name</label>
              <Input
                value={block.companyName}
                onChange={(e) => onUpdate({ companyName: e.target.value })}
                className="h-7 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Document Title</label>
              <Input
                value={block.documentTitle}
                onChange={(e) => onUpdate({ documentTitle: e.target.value })}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Period Ended</label>
              <Input
                value={block.periodEnded}
                onChange={(e) => onUpdate({ periodEnded: e.target.value })}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Reporting Currency</label>
              <Input
                value={block.currency}
                onChange={(e) => onUpdate({ currency: e.target.value })}
                className="h-7 text-xs"
              />
            </div>
          </div>
        )}

        {block.type === 'image' && (
          <div className="space-y-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800">
            {isMediaBucketOpen && (
              <MediaBucketModal
                isOpen={isMediaBucketOpen}
                onClose={() => setIsMediaBucketOpen(false)}
                selectedImageUrl={block.url}
                onSelectImage={(asset) => {
                  onUpdate({
                    url: asset.url,
                    alt: asset.name
                  });
                  setIsMediaBucketOpen(false);
                }}
              />
            )}

            <div className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>Picture / Logo Settings</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsMediaBucketOpen(true)}
                className="h-6 text-[10px] gap-1 px-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
              >
                <FolderArchive className="w-3 h-3" />
                <span>Media Bucket</span>
              </Button>
            </div>

            {/* Image Preview & Upload */}
            <div className="flex items-center gap-3 bg-white dark:bg-zinc-800 p-2 rounded-md border border-slate-200 dark:border-zinc-700">
              <div className="w-16 h-12 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={block.url || ZENATECH_LOGO_DATA_URL}
                  alt={block.alt || 'Preview'}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== ZENATECH_LOGO_DATA_URL) {
                      target.src = ZENATECH_LOGO_DATA_URL;
                    }
                  }}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsMediaBucketOpen(true)}
                    className="h-6 text-[10px] px-2 bg-blue-600 hover:bg-blue-700 text-white gap-1"
                  >
                    <FolderArchive className="w-3 h-3" />
                    <span>Bucket Library</span>
                  </Button>

                  <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-200 rounded border border-slate-300 dark:border-zinc-600 transition-colors">
                    <Upload className="w-3 h-3" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const asset = await mediaBucketService.uploadAsset(file);
                          onUpdate({ url: asset.url, alt: asset.name });
                        } catch {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            if (ev.target?.result) {
                              onUpdate({ url: ev.target.result as string, alt: file.name });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {block.alt || 'Corporate Graphic / Logo'}
                </div>
              </div>
            </div>

            {/* Image Width Slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-slate-500 font-medium">Display Width</label>
                <span className="text-xs font-mono font-bold text-blue-600">
                  {block.width || 260}px
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={80}
                  max={700}
                  step={10}
                  value={block.width || 260}
                  onChange={(e) => onUpdate({ width: Number(e.target.value) })}
                  className="flex-1 accent-blue-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg"
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                <span>80px</span>
                <span>260px (Standard)</span>
                <span>700px (Full)</span>
              </div>
            </div>

            {/* Alignment */}
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Alignment</label>
              <div className="grid grid-cols-3 gap-1">
                {(['left', 'center', 'right'] as const).map((al) => (
                  <button
                    key={al}
                    type="button"
                    onClick={() => onUpdate({ alignment: al })}
                    className={`py-1 px-1 rounded text-[10px] font-medium capitalize border transition-all ${
                      (block.alignment || 'center') === al
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-100'
                    }`}
                  >
                    {al}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption */}
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Caption (Optional)</label>
              <Input
                value={block.caption || ''}
                onChange={(e) => onUpdate({ caption: e.target.value })}
                placeholder="e.g. Figure 1: Corporate Brand Mark"
                className="h-7 text-xs"
              />
            </div>

            {/* Alt Text */}
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Alt Description</label>
              <Input
                value={block.alt || ''}
                onChange={(e) => onUpdate({ alt: e.target.value })}
                placeholder="e.g. ZenaTech Logo"
                className="h-7 text-xs"
              />
            </div>
          </div>
        )}

        {/* Audit info */}
        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-1.5 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Last Updated: {block.updatedAt ? new Date(block.updatedAt).toLocaleTimeString() : 'Initial'}</span>
          </div>
          {block.modifiedBy && (
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Editor: {block.modifiedBy}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
