import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#1f3d2b',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontStyle: 'italic',
            fontFamily: 'Georgia, serif',
            color: '#c8ae7e',
            display: 'flex',
            lineHeight: 1,
          }}
        >
          Av
        </div>
        <div
          style={{
            width: 88,
            height: 2,
            background: '#c8ae7e',
            marginTop: 14,
            display: 'flex',
          }}
        />
      </div>
    ),
    size,
  );
}
