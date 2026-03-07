/**
 * ProfilePictureModal.js — Change profile picture
 *
 * Allows upload (Supabase Storage) or paste URL.
 * Updates user_metadata.avatar_url via supabase.auth.updateUser.
 */

import { useState, useRef, useEffect } from 'react';
import { supabase, updateProfilePicture, uploadAvatar } from '../utils/supabaseClient';

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function ProfilePictureModal({ user, onClose, onUpdated }) {
  const [mode, setMode] = useState('choose'); // choose | upload | url
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image (JPG, PNG, GIF, WebP)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const avatarUrl = await uploadAvatar(user.id, file);
      await updateProfilePicture(avatarUrl);
      setSuccess(true);
      onUpdated?.();
    } catch (err) {
      setError(err.message?.includes('Bucket not found')
        ? 'Storage bucket "avatars" not set up. Use a URL instead, or create the bucket in Supabase.'
        : err.message || 'Upload failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleUrlSubmit() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setSaving(true);
    setError('');
    try {
      await updateProfilePicture(trimmed);
      setSuccess(true);
      onUpdated?.();
    } catch (err) {
      setError(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    setError('');
    try {
      await updateProfilePicture(null);
      setSuccess(true);
      onUpdated?.();
    } catch (err) {
      setError(err.message || 'Failed to remove');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative glass-heavy rounded-2xl w-full max-w-sm p-6 shadow-card"
        style={{ animation: 'slide-up 0.35s cubic-bezier(0.25,0.46,0.45,0.94) both' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">Profile picture</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-atlas-text-muted hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <XIcon />
          </button>
        </div>

        {success ? (
          <div className="text-center py-6" style={{ animation: 'scale-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-semibold">Updated!</p>
            <button onClick={onClose} className="btn-glow px-6 py-2 text-sm mt-3">
              <span>Done</span>
            </button>
          </div>
        ) : mode === 'choose' ? (
          <div className="space-y-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-atlas-blue/40 bg-atlas-blue/10 text-atlas-blue hover:bg-atlas-blue/15 transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Upload photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => setMode('url')}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/[0.08] glass text-atlas-text-secondary hover:text-white hover:bg-white/[0.04] transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Paste image URL
            </button>
            {user?.user_metadata?.avatar_url && (
              <button
                onClick={handleRemove}
                disabled={saving}
                className="w-full px-4 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all disabled:opacity-50"
              >
                Remove photo
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="url"
              placeholder="https://example.com/photo.jpg"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-atlas-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-atlas-blue/50 focus:border-atlas-blue/30"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setMode('choose'); setUrl(''); setError(''); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.08] text-atlas-text-secondary hover:bg-white/[0.04] transition-all"
              >
                Back
              </button>
              <button
                onClick={handleUrlSubmit}
                disabled={saving || !url.trim()}
                className="flex-1 btn-glow px-4 py-2.5 text-sm disabled:opacity-50"
              >
                <span>{saving ? 'Saving…' : 'Save'}</span>
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs text-red-400 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
