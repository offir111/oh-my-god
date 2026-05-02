import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllPublicPhotos } from '../lib/cageUserProfile.js';

export default function PhotosPage() {
  const navigate = useNavigate();
  const photos = useMemo(() => getAllPublicPhotos(), []);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 12px', direction: 'rtl' }}>
      <h1 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--gold)', margin: '0 0 16px', textAlign: 'center' }}>
        תמונות משתמשים
      </h1>

      {photos.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>
          🖼 אין תמונות ציבוריות עדיין
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {photos.map(item => (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: 'var(--card2)', border: '1px solid var(--border)' }}>
                <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <button
                type="button"
                onClick={() => navigate(`/profile/${encodeURIComponent(item.username)}`)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)',
                  textAlign: 'center', padding: '2px 0',
                  textDecoration: 'underline', textUnderlineOffset: 3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {item.username}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
