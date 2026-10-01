import type { MediaBucketItem } from '../types/mediaBucket';
import { apiClient, BASE_URL } from './apiClient';
import { ZENATECH_LOGO_DATA_URL } from '../data/zenatechLogoAsset';

const STORAGE_KEY = 'company_media_bucket_assets_v2';

const DEFAULT_BUCKET_ASSETS: MediaBucketItem[] = [
  {
    id: 'asset-zenatech-picture1',
    name: 'Picture1.jpg (ZenaTech Wordmark Logo)',
    url: ZENATECH_LOGO_DATA_URL,
    companyName: 'ZenaTech, Inc.',
    fileSize: '26 KB',
    dimensions: '260 × 64',
    uploadedAt: '2026-09-23T00:00:00.000Z',
    isDefault: true
  }
];

export const mediaBucketService = {
  getAssets(): MediaBucketItem[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_BUCKET_ASSETS));
      return DEFAULT_BUCKET_ASSETS;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure default Picture1 is always available if not present
        if (!parsed.some((item: MediaBucketItem) => item.name.includes('Picture1') || item.id === 'asset-zenatech-picture1')) {
          parsed.unshift(DEFAULT_BUCKET_ASSETS[0]);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse media bucket storage', e);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_BUCKET_ASSETS));
    return DEFAULT_BUCKET_ASSETS;
  },

  async uploadAsset(file: File, companyName = 'General Corporate'): Promise<MediaBucketItem> {
    const sizeKb = Math.round(file.size / 1024);
    let assetUrl: string | null = null;
    let assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const effectiveCompany = companyName?.trim() || 'General Corporate';

    // 1. Attempt upload to backend AWS S3 / cloud storage endpoint
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('company_name', effectiveCompany);
      formData.append('upload_type', 'media-bucket');

      const response = await apiClient.post<any>('/upload-files/media', formData);
      if (response && (response.url || response.file_url || response.id)) {
        assetUrl = response.url || response.file_url || `${BASE_URL}/api/upload-files/${response.id}/view`;
        if (response.id) assetId = response.id;
      }
    } catch (e) {
      console.warn('Backend S3 endpoint offline or unavailable; persisting in local media bucket storage', e);
    }

    // 2. If remote S3 URL not returned, read locally as high-resolution Data URL
    if (!assetUrl) {
      assetUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          if (dataUrl) resolve(dataUrl);
          else reject(new Error('Failed to read image file'));
        };
        reader.onerror = () => reject(new Error('File reading error'));
        reader.readAsDataURL(file);
      });
    }

    const newAsset: MediaBucketItem = {
      id: assetId,
      name: file.name.replace(/\.[^/.]+$/, ''),
      url: assetUrl,
      companyName: effectiveCompany,
      fileSize: `${sizeKb} KB`,
      uploadedAt: new Date().toISOString(),
      isDefault: false
    };

    const current = this.getAssets();
    const updated = [newAsset, ...current];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newAsset;
  },

  addAssetFromUrl(name: string, url: string, companyName = 'General Corporate'): MediaBucketItem {
    const effectiveCompany = companyName?.trim() || 'General Corporate';
    const newAsset: MediaBucketItem = {
      id: `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: name?.trim() || 'External Corporate Asset',
      url: url.trim(),
      companyName: effectiveCompany,
      uploadedAt: new Date().toISOString(),
      isDefault: false
    };

    const current = this.getAssets();
    const updated = [newAsset, ...current];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newAsset;
  },

  deleteAsset(id: string): void {
    const current = this.getAssets();
    const updated = current.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  resetToDefaults(): MediaBucketItem[] {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_BUCKET_ASSETS));
    return DEFAULT_BUCKET_ASSETS;
  }
};
