// Metadata upload-service trả về (đủ để copy vào product_images, render không cần gọi lại).
export interface UploadMetadata {
  id: string;
  owner_id: string;
  object_key: string;
  public_url: string;
  file_size: number | null;
  content_type: string | null;
  purpose: string;
  status: string;
}

// Client gọi upload-service (service-to-service, trong docker network).
// Vì KHÔNG qua Kong nên product-service tự forward X-User-Id để upload-service
// kiểm tra quyền sở hữu file.
export interface IUploadClient {
  // draft -> saved. Trả metadata để copy vào product_images. Ném nếu fail.
  save(uploadId: string, userId: string, productId: string): Promise<UploadMetadata>;
  // saved -> draft (để cron upload-service dọn). Best-effort: không ném để không chặn nghiệp vụ.
  unsave(uploadId: string, userId: string): Promise<void>;
}
