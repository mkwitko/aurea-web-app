import { useMutation } from '@tanstack/react-query';
import client from '@/api/client';

interface PresignedUrlInput {
  filename: string;
  contentType: string;
  type: 'logo' | 'document' | 'media';
  /**
   * Exact byte length of the file. The backend signs the presigned PUT with this
   * as content-length, so the body sent to `uploadToPresignedUrl` must match it
   * exactly or R2 rejects the upload with SignatureDoesNotMatch.
   */
  size: number;
}

interface PresignedUrlOutput {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export function useGetPresignedUrl() {
  return useMutation<PresignedUrlOutput, Error, PresignedUrlInput>({
    mutationFn: (input) =>
      client<PresignedUrlOutput>({ method: 'POST', url: '/upload/presigned', data: input }).then((r) => r.data),
  });
}

export async function uploadToPresignedUrl(presignedUrl: string, file: File): Promise<void> {
  const res = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
}
