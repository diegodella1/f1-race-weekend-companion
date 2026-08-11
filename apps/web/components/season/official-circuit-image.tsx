'use client';

import Image from 'next/image';
import { useState } from 'react';

interface OfficialCircuitImageProps {
  imageUrl: string | null;
  name: string;
  verified: boolean;
  priority?: boolean;
}

export function OfficialCircuitImage({ imageUrl, name, verified, priority = false }: OfficialCircuitImageProps) {
  const [failed, setFailed] = useState(false);
  if (!verified || !imageUrl || !imageUrl.startsWith('https://media.formula1.com/') || failed) {
    return <div className="official-map-unavailable"><b>Official map unavailable</b><span>No substitute drawing shown</span></div>;
  }
  return (
    <Image
      src={imageUrl}
      alt={`Official Formula 1 circuit map for ${name}`}
      width={720}
      height={540}
      sizes="(max-width: 767px) 92vw, (max-width: 1199px) 44vw, 380px"
      priority={priority}
      onError={() => setFailed(true)}
    />
  );
}
