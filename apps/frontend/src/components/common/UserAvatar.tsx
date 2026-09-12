import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';

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

  // Hook into Clerk user if available
  let clerkImageUrl = '';
  let clerkFullName = '';
  try {
    const { user: clerkUser } = useUser();
    if (clerkUser) {
      clerkImageUrl = clerkUser.imageUrl || '';
      clerkFullName = clerkUser.fullName || clerkUser.firstName || '';
    }
  } catch (err) {
    // Ignore if outside ClerkProvider
  }

  let resolvedUrl = '';
  let resolvedEmoji = '';

  // Order of candidate properties to inspect
  const candidateSources = [
    typeof userOrImage === 'string' ? userOrImage : '',
    clerkImageUrl,
    userOrImage?.imageUrl,
    userOrImage?.profileImageUrl,
    userOrImage?.avatar_url,
    userOrImage?.profile_image_url,
    userOrImage?.profile_image,
    userOrImage?.avatar,
    userOrImage?.picture,
    userOrImage?.image
  ];

  for (const candidate of candidateSources) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      const trimmed = candidate.trim();
      const isHttpOrData =
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('/');

      if (isHttpOrData) {
        if (!resolvedUrl) resolvedUrl = trimmed;
      } else {
        if (!resolvedEmoji) resolvedEmoji = trimmed;
      }
    }
  }

  const name =
    fullName ||
    (typeof userOrImage === 'object' ? userOrImage?.full_name || userOrImage?.name : '') ||
    clerkFullName;

  const initials = getUserInitials(name);
  const borderRadius = '50%';

  // Render photo image if valid URL is resolved and hasn't errored out
  if (resolvedUrl && !imgError) {
    return (
      <img
        src={resolvedUrl}
        alt={name || 'User Avatar'}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius,
          objectFit: 'cover',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
          ...style
        }}
      />
    );
  }

  // Render custom emoji/avatar if no photo URL found
  if (resolvedEmoji) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius,
          background: 'linear-gradient(135deg, var(--primary-red), var(--primary-red))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.round(size * 0.55),
          lineHeight: 1,
          flexShrink: 0,
          userSelect: 'none',
          boxShadow: '0 2px 6px rgba(var(--primary-red-rgb), 0.3)',
          ...style
        }}
      >
        {resolvedEmoji}
      </div>
    );
  }

  // Fallback to user initials
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius,
        background: 'linear-gradient(135deg, var(--primary-red), var(--accent-darker))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: Math.round(size * 0.42),
        color: '#ffffff',
        flexShrink: 0,
        userSelect: 'none',
        boxShadow: '0 2px 6px rgba(var(--primary-red-rgb), 0.3)',
        ...style
      }}
    >
      {initials}
    </div>
  );
}
