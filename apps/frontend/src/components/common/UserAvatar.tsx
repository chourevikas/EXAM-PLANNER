import React, { useState } from 'react';

export function getUserInitials(name?: string): string {
  if (!name || typeof name !== 'string') return 'SA';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'SA';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

interface UserAvatarProps {
  userOrImage?: any;
  size?: number;
  fullName?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function UserAvatar({
  userOrImage,
  size = 28,
  fullName,
  className,
  style
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const rawImg = typeof userOrImage === 'string' 
    ? userOrImage 
    : (userOrImage?.avatar_url || userOrImage?.imageUrl || userOrImage?.profile_image_url || userOrImage?.profile_image);
  const name = fullName || (typeof userOrImage === 'object' ? userOrImage?.full_name : '');
  const initials = getUserInitials(name);

  const isUrl = typeof rawImg === 'string' && (
    rawImg.startsWith('http://') || 
    rawImg.startsWith('https://') || 
    rawImg.startsWith('data:') || 
    rawImg.startsWith('/')
  );

  const borderRadius = Math.round(size * 0.25);

  if (isUrl && !imgError) {
    return (
      <img
        src={rawImg}
        alt={name || 'User Avatar'}
        onError={() => setImgError(true)}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius,
          objectFit: 'cover',
          flexShrink: 0,
          ...style
        }}
      />
    );
  }

  // Emoji or text icon
  if (rawImg && typeof rawImg === 'string' && rawImg.trim().length > 0 && !isUrl) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius,
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.round(size * 0.55),
          lineHeight: 1,
          flexShrink: 0,
          userSelect: 'none',
          ...style
        }}
      >
        {rawImg}
      </div>
    );
  }

  // Fallback to initials
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius,
        background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: Math.round(size * 0.42),
        color: '#ffffff',
        flexShrink: 0,
        userSelect: 'none',
        ...style
      }}
    >
      {initials}
    </div>
  );
}
