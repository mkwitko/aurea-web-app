import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Help } from '@/components/Help';
import { useGetPresignedUrl, uploadToPresignedUrl } from '@/api/modules/upload';

interface LogoUploadProps {
  currentUrl?: string;
  onUpload: (url: string) => void;
}

export function LogoUpload({ currentUrl, onUpload }: LogoUploadProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(currentUrl || '');
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
        type: 'logo',
        size: file.size,
      });

      await uploadToPresignedUrl(uploadUrl, file);
      setPreview(publicUrl);
      onUpload(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('wizard.logoUpload.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted/30">
          {preview ? (
            <img src={preview} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-muted-foreground text-xs text-center px-1">{t('wizard.logoUpload.noLogo')}</span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t('wizard.logoUpload.companyLogo')}</span>
            <Help title={t('wizard.logoUpload.help.logoTitle')}>{t('wizard.logoUpload.help.logo')}</Help>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFile}
            className="hidden"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? t('wizard.logoUpload.uploading') : preview ? t('wizard.logoUpload.changeLogo') : t('wizard.logoUpload.uploadLogo')}
            </Button>
            {preview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPreview('');
                  onUpload('');
                }}
              >
                {t('wizard.logoUpload.remove')}
              </Button>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </Card>
  );
}
