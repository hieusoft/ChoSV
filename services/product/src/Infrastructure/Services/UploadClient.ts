import type {
  IUploadClient,
  UploadMetadata,
} from '../../Application/Interfaces/IUploadClient';

// Gọi upload-service trong docker network (KHÔNG qua Kong).
// Vì bỏ qua Kong nên phải tự set X-User-Id để upload-service check quyền sở hữu.
export class UploadClient implements IUploadClient {
  constructor(private readonly baseUrl: string) {}

  async save(uploadId: string, userId: string, productId: string): Promise<UploadMetadata> {
    const res = await fetch(`${this.baseUrl}/api/uploads/${uploadId}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify({
        linked_service: 'product-service',
        linked_entity_id: productId,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`upload save failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as { data: { upload: UploadMetadata } };
    return json.data.upload;
  }

  async unsave(uploadId: string, userId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/uploads/${uploadId}/unsave`, {
      method: 'POST',
      headers: { 'X-User-Id': userId },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`upload unsave failed (${res.status}): ${text}`);
    }
  }
}
