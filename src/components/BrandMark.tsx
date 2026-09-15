import React from 'react';
import { Image } from 'react-native';

export const BRAND_TEAL = '#0F7A63';

export type BrandMarkProps = {
  size?: number;
};

/** The app icon (assets/icon.png), placed in-app at whatever size is needed. */
export function BrandMark({ size = 32 }: BrandMarkProps) {
  return (
    <Image
      source={require('../../assets/icon.png')}
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
      resizeMode="contain"
    />
  );
}
