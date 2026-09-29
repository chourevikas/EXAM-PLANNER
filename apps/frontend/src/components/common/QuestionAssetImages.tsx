export interface QuestionAsset {
  asset_id?: string;
  asset_type?: string;
  caption?: string | null;
  url?: string | null;
}

interface QuestionAssetImagesProps {
  assets?: QuestionAsset[] | Record<string, any>[] | null;
}

/**
 * Diagrams, maps and figures cropped from the question paper, shown under the question stem.
 * Tables are not rendered here: they are part of the question text as markdown.
 */
export function QuestionAssetImages({ assets }: QuestionAssetImagesProps) {
  const images = (assets || []).filter((a: any) => a && a.url) as QuestionAsset[];
  if (images.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '10px 0 14px' }}>
      {images.map((asset, idx) => (
        <figure key={asset.asset_id || idx} style={{ margin: 0 }}>
          <img
            src={asset.url || ''}
            alt={asset.caption || `Question figure ${idx + 1}`}
            loading="lazy"
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: 420,
              objectFit: 'contain',
              background: '#FFFFFF',
              border: '1px solid var(--border-color, #E2E8F0)',
              borderRadius: 8,
              padding: 6,
            }}
          />
          {asset.caption && (
            <figcaption style={{ fontSize: 12.5, color: 'var(--text-muted, #64748B)', marginTop: 4 }}>
              {asset.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
