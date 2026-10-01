import React, { useState, useEffect, useRef } from 'react';
import {
  FolderArchive,
  Upload,
  Trash2,
  Check,
  Search,
  Plus,
  Image as ImageIcon,
  Sparkles
} from 'lucide-react';
import type { MediaBucketItem } from '../../../types/mediaBucket';
import { mediaBucketService } from '../../../services/mediaBucketService';
import { ZENATECH_LOGO_DATA_URL } from '../../../data/zenatechLogoAsset';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';

interface MediaBucketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage?: (asset: MediaBucketItem) => void;
  selectedImageUrl?: string;
}

export const MediaBucketModal: React.FC<MediaBucketModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  selectedImageUrl
}) => {
  const [assets, setAssets] = useState<MediaBucketItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [isUploading, setIsUploading] = useState(false);
  const [companyNameInput, setCompanyNameInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [urlNameInput, setUrlNameInput] = useState('');
  const [activeTab, setActiveTab] = useState<'bucket' | 'upload' | 'url'>('bucket');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = () => {
    const list = mediaBucketService.getAssets();
    setAssets(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadAssets();
    }
  }, [isOpen]);

  const uniqueCompanies = Array.from(
    new Set(assets.map((a) => a.companyName || 'General Corporate'))
  ).filter(Boolean);

  const filteredAssets = assets.filter((item) => {
    if (companyFilter !== 'ALL' && item.companyName !== companyFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.companyName && item.companyName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    try {
      let lastUploaded: MediaBucketItem | null = null;
      const targetCompany = companyNameInput.trim() || (companyFilter !== 'ALL' ? companyFilter : 'General Corporate');
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          toast.error(`"${file.name}" is not an image file.`);
          continue;
        }
        lastUploaded = await mediaBucketService.uploadAsset(file, targetCompany);
      }

      loadAssets();
      toast.success('Image(s) uploaded successfully to Company Media Bucket!');
      setActiveTab('bucket');

      if (lastUploaded && onSelectImage) {
        onSelectImage(lastUploaded);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to upload image to bucket');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      toast.error('Please provide an image URL');
      return;
    }

    try {
      const targetCompany = companyNameInput.trim() || (companyFilter !== 'ALL' ? companyFilter : 'General Corporate');
      const newAsset = mediaBucketService.addAssetFromUrl(
        urlNameInput.trim() || 'External Corporate Asset',
        urlInput.trim(),
        targetCompany
      );
      loadAssets();
      setUrlInput('');
      setUrlNameInput('');
      toast.success('Added external image to Media Bucket!');
      setActiveTab('bucket');

      if (onSelectImage) {
        onSelectImage(newAsset);
      }
    } catch (err: any) {
      toast.error('Failed to add image URL');
    }
  };

  const handleDeleteAsset = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${name}" from the company media bucket?`)) {
      mediaBucketService.deleteAsset(id);
      loadAssets();
      toast.success(`Deleted "${name}" from Media Bucket`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[94vw] max-w-5xl sm:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Company Media & Image Bucket</span>
                <Badge variant="outline" className="text-[11px] font-mono text-blue-600 bg-blue-50 dark:bg-blue-950/40">
                  {assets.length} {assets.length === 1 ? 'Asset' : 'Assets'}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
                Upload, manage, and select corporate logos, charts, and graphics across company filings.
              </DialogDescription>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-200/80 dark:bg-zinc-800 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('bucket')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeTab === 'bucket'
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              Media Gallery
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload New</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeTab === 'url'
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              Image URL
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'bucket' && (
            <div className="space-y-4">
              {/* Search & Company Filter Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search image name or company..."
                    className="pl-9 h-8 text-xs bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-medium">Company:</span>
                  <select
                    value={companyFilter}
                    onChange={(e) => setCompanyFilter(e.target.value)}
                    className="h-8 text-xs px-2.5 rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:outline-none"
                  >
                    <option value="ALL">All Companies ({assets.length})</option>
                    {uniqueCompanies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('upload')}
                    className="h-8 text-xs gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                  </Button>
                </div>
              </div>

              {/* Gallery Grid */}
              {filteredAssets.length === 0 ? (
                <div className="py-16 text-center space-y-3 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-slate-400">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                      No media bucket images found
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {searchQuery
                        ? 'Try clearing your search query or company filter.'
                        : 'Upload your first company logo or corporate graphic to the media bucket.'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image Now</span>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredAssets.map((asset) => {
                    const isSelected = selectedImageUrl === asset.url;

                    return (
                      <div
                        key={asset.id}
                        onClick={() => onSelectImage?.(asset)}
                        className={`group relative flex flex-col rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-md'
                            : 'border-slate-200 dark:border-zinc-800 hover:border-blue-400 hover:shadow-md'
                        }`}
                      >
                        {/* Image Preview Box */}
                        <div className="h-36 bg-slate-100 dark:bg-zinc-800/80 p-3 flex items-center justify-center relative overflow-hidden">
                          <img
                            src={asset.url}
                            alt={asset.name}
                            className="max-h-full max-w-full object-contain drop-shadow-xs group-hover:scale-105 transition-transform"
                          />

                          {/* Selected Checkmark Badge */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-blue-600 text-white p-1 rounded-full shadow">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}

                          {/* Action Overlay */}
                          <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                            {onSelectImage && (
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectImage(asset);
                                }}
                              >
                                <Check className="w-3 h-3" />
                                <span>Select & Insert</span>
                              </Button>
                            )}

                            {!asset.isDefault && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="h-7 w-7"
                                title="Delete from Media Bucket"
                                onClick={(e) => handleDeleteAsset(asset.id, asset.name, e)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Metadata Footer */}
                        <div className="p-3 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-xs text-slate-800 dark:text-zinc-200 truncate" title={asset.name}>
                              {asset.name}
                            </span>
                            {asset.isDefault && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 uppercase font-bold text-slate-500">
                                Default
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="truncate max-w-[140px] text-blue-600 dark:text-blue-400 font-medium">
                              {asset.companyName || 'Corporate'}
                            </span>
                            <span>{asset.fileSize || 'Image'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Upload New Image Tab */}
          {activeTab === 'upload' && (
            <div className="max-w-xl mx-auto space-y-5 py-4">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Company Name / Entity
                    </label>
                    {uniqueCompanies.length > 0 && (
                      <span className="text-[10px] text-slate-400">Click to select existing:</span>
                    )}
                  </div>
                  <Input
                    value={companyNameInput}
                    onChange={(e) => setCompanyNameInput(e.target.value)}
                    placeholder="Enter any Company Name or Subsidiary (e.g. Acme Corp, Apex Ltd)"
                    className="h-9 text-xs mb-1.5"
                  />
                  {uniqueCompanies.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {uniqueCompanies.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCompanyNameInput(c)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            companyNameInput === c
                              ? 'bg-blue-600 text-white border-blue-600 font-bold'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-blue-400'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dropzone */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                  multiple
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFileUpload(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-10 border-2 border-dashed rounded-2xl text-center space-y-3 cursor-pointer transition-all ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[0.99]'
                      : 'border-slate-300 dark:border-zinc-700 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-zinc-900'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-xs">
                    <Upload className="w-7 h-7" />
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                      Click to browse or drag & drop image files
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      PNG, JPG, SVG, WebP up to 10MB per file
                    </p>
                  </div>

                  <Button
                    type="button"
                    disabled={isUploading}
                    className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploading ? 'Uploading to Bucket...' : 'Select Files'}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Add via URL Tab */}
          {activeTab === 'url' && (
            <form onSubmit={handleAddUrl} className="max-w-xl mx-auto space-y-4 py-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Image Asset Name
                  </label>
                  <Input
                    value={urlNameInput}
                    onChange={(e) => setUrlNameInput(e.target.value)}
                    placeholder="e.g. Corporate Wordmark / Executive Photo"
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Company Name / Entity
                    </label>
                    {uniqueCompanies.length > 0 && (
                      <span className="text-[10px] text-slate-400">Click to select existing:</span>
                    )}
                  </div>
                  <Input
                    value={companyNameInput}
                    onChange={(e) => setCompanyNameInput(e.target.value)}
                    placeholder="Enter any Company Name or Subsidiary"
                    className="h-9 text-xs mb-1.5"
                  />
                  {uniqueCompanies.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {uniqueCompanies.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCompanyNameInput(c)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            companyNameInput === c
                              ? 'bg-blue-600 text-white border-blue-600 font-bold'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-blue-400'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Direct Image URL (HTTPS / Static Asset)
                  </label>
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/assets/logo.png"
                    className="h-9 text-xs"
                  />
                </div>

                {urlInput && (
                  <div className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 flex items-center gap-3">
                    <img
                      src={urlInput}
                      alt="URL Preview"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = ZENATECH_LOGO_DATA_URL;
                      }}
                      className="w-16 h-12 object-contain bg-white dark:bg-zinc-800 rounded p-1 border"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-700 dark:text-zinc-300 block">Live Preview</span>
                      <span className="text-[11px] text-slate-400 truncate block max-w-xs">{urlInput}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('bucket')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save to Media Bucket</span>
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Images stored here are shared across SEC filings and company reports.</span>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
