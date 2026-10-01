export interface MediaBucketItem {
  id: string;
  name: string;
  url: string;
  companyName: string;
  fileSize?: string;
  dimensions?: string;
  uploadedAt: string;
  isDefault?: boolean;
}
