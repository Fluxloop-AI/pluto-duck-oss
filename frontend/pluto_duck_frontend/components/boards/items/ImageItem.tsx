'use client';

import type { BoardItem } from '../../../lib/boardsApi';
import { getAssetDownloadUrl } from '../../../lib/boardsApi';

interface ImageItemProps {
  item: BoardItem;
}

export function ImageItem({ item }: ImageItemProps) {
  const assetId = item.payload.asset_id;
  const altText = item.payload.alt_text || 'Image';
  const caption = item.payload.caption;
  const fit = item.payload.fit || 'contain';

  if (!assetId) {
    return (
      <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-lg text-muted-foreground">
        <p className="text-sm">No image uploaded</p>
      </div>
    );
  }

  const imageUrl = getAssetDownloadUrl(assetId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 relative rounded-lg overflow-hidden border border-border">
        <img
          src={imageUrl}
          alt={altText}
          className={`w-full h-full ${
            fit === 'cover' ? 'object-cover' :
            fit === 'fill' ? 'object-fill' :
            'object-contain'
          }`}
        />
      </div>
      
      {caption && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {caption}
        </p>
      )}
    </div>
  );
}

