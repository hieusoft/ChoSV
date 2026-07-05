export interface ProductImage {
  id: string;
  productId: string;
  uploadId: string | null;
  objectKey: string;
  imageUrl: string;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  contentType: string | null;
  sortOrder: number;
  createdAt: Date;
}
