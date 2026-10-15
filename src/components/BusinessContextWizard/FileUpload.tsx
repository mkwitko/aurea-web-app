import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Help } from '@/components/Help';
import { useGetPresignedUrl, uploadToPresignedUrl } from '@/api/modules/upload';

interface FileUploadProps {
  files: string[];
  onChange: (files: string[]) => void;
}

export function FileUpload({ files, onChange }: FileUploadProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const presigned = useGetPresignedUrl();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const { uploadUrl, publicUrl } = await presigned.mutateAsync({
        filename: file.name,
        contentType: file.type,
        type: 'document',
        size: file.size,
      });

      await uploadToPresignedUrl(uploadUrl, file);
      onChange([...files, publicUrl]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('wizard.fileUpload.uploadFailed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{t('wizard.fileUpload.institutionalDocuments')}</span>
        <Help title={t('wizard.fileUpload.help.documentsTitle')}>{t('wizard.fileUpload.help.documents')}</Help>
      </div>

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((url, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground truncate flex-1" title={url}>
                {url.split('/').pop() || t('wizard.fileUpload.documentN', { n: i + 1 })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                {t('wizard.fileUpload.remove')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,image/png,image/jpeg"
        onChange={handleFile}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? t('wizard.fileUpload.uploading') : t('wizard.fileUpload.addDocument')}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
