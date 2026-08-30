import React, { useEffect, useState } from 'react';
import { StudentLayout } from '../components/student/StudentLayout';
import { listBookmarks, removeBookmark } from '../services/bookmarkService';
import { fetchCurrentUser } from '../services/authService';

import { formatEnum } from '../utils/formatEnum';

export function BookmarksPage(): React.ReactElement {
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchCurrentUser().then(u => setUser(u)).catch(console.error);
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    try {
      setLoading(true);
      const res = await listBookmarks();
      setBookmarks(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (questionId: string) => {
    try {
      await removeBookmark(questionId);
      setBookmarks(bookmarks.filter(b => b.question_id !== questionId));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <StudentLayout pageTitle="Bookmarked Questions">
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#172033' }}>Bookmarked Questions</h1>
        {loading ? (
          <div>Loading bookmarks...</div>
        ) : bookmarks.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', background: '#F8FAFC', borderRadius: 8, color: '#64748B' }}>
            No bookmarked questions yet. Start practicing and bookmark questions to review later!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {bookmarks.map((b) => (
              <div key={b.bookmark_id} style={{ padding: 20, border: '1px solid #E2E8F0', borderRadius: 8, background: '#FFFFFF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#334EAC', background: '#EFF6FF', padding: '4px 8px', borderRadius: 4 }}>
                    {formatEnum(b.difficulty)}
                  </span>
                  <button 
                    onClick={() => handleRemove(b.question_id)}
                    style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                  >
                    Remove Bookmark
                  </button>
                </div>
                <div style={{ fontSize: 15, color: '#1E293B', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: b.question_text }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
