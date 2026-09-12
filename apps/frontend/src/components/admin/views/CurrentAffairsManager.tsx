import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

export function CurrentAffairsManager() {
  const { getToken } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };
  const [topic, setTopic] = useState('');
  const [subtopic, setSubtopic] = useState('');
  const [date, setDate] = useState('');
  
  const [affairs, setAffairs] = useState<any[]>([]);

  const fetchAffairs = async () => {
    try {
      const clerkToken = await getToken().catch(() => null);
      const token = clerkToken || localStorage.getItem('access_token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/v1/current-affairs/', { headers });
      if (res.ok) {
        setAffairs(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAffairs();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const clerkToken = await getToken().catch(() => null);
      const token = clerkToken || localStorage.getItem('access_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const url = editingId ? `/api/v1/current-affairs/${editingId}` : '/api/v1/current-affairs/';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ title, content, topic, subtopic, date: date || null })
      });
      if (res.ok) {
        showMessage(editingId ? "Article updated successfully!" : "Article published successfully!", "success");
        setEditingId(null);
        setTitle('');
        setContent('');
        setTopic('');
        setSubtopic('');
        setDate('');
        fetchAffairs();
      } else {
        showMessage(editingId ? "Failed to update" : "Failed to publish", "error");
      }
    } catch (err) {
      console.error(err);
      showMessage("Error occurred while saving", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (a: any) => {
    setEditingId(a.id);
    setTitle(a.title);
    setContent(a.content);
    setTopic(a.topic || '');
    setSubtopic(a.subtopic || '');
    setDate(a.date ? new Date(a.date).toISOString().split('T')[0] : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setTopic('');
    setSubtopic('');
    setDate('');
  };

  const handleDelete = async (id: number) => {
    try {
      const clerkToken = await getToken().catch(() => null);
      const token = clerkToken || localStorage.getItem('access_token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/v1/current-affairs/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        showMessage("Article deleted successfully!", "success");
        setConfirmDeleteId(null);
        fetchAffairs();
      } else {
        showMessage("Failed to delete article", "error");
      }
    } catch (err) {
      console.error(err);
      showMessage("Error occurred while deleting", "error");
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Manage Current Affairs</h2>
      
      {message && (
        <div style={{ 
          padding: '12px 16px', 
          borderRadius: 6, 
          marginBottom: 24, 
          backgroundColor: message.type === 'success' ? '#D1FAE5' : '#FEE2E2',
          color: message.type === 'success' ? '#065F46' : '#991B1B',
          border: `1px solid ${message.type === 'success' ? '#34D399' : '#F87171'}`,
          fontWeight: 500
        }}>
          {message.text}
        </div>
      )}

      <div style={{ backgroundColor: '#fff', padding: 24, borderRadius: 8, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>{editingId ? 'Edit Article' : 'Publish New Article'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Title</label>
            <input required type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Content (Markdown)</label>
            <textarea required rows={6} value={content} onChange={e => setContent(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }} />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Topic (Optional)</label>
              <select value={topic} onChange={e => setTopic(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }}>
                <option value="">-- Select Topic --</option>
                <option value="Indian Polity & Governance">Indian Polity & Governance</option>
                <option value="Modern Indian History">Modern Indian History</option>
                <option value="Indian Economy">Indian Economy</option>
                <option value="Geography & Environment">Geography & Environment</option>
                <option value="Science & Technology">Science & Technology</option>
                <option value="Current Affairs">Current Affairs</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Subtopic (Optional)</label>
              <input type="text" value={subtopic} onChange={e => setSubtopic(e.target.value)} placeholder="e.g. Fundamental Rights" style={{ width: '100%', padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Date (Optional)</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              type="submit" 
              disabled={isSubmitting}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: isSubmitting ? '#f87171' : 'var(--primary-red)', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 4, 
                cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                fontWeight: 600 
              }}
            >
              {isSubmitting ? (editingId ? 'Updating...' : 'Publishing...') : (editingId ? 'Update Article' : 'Publish')}
            </button>
            {editingId && (
              <button type="button" onClick={handleCancelEdit} disabled={isSubmitting} style={{ padding: '10px 20px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div style={{ backgroundColor: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Published Articles</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
              <th style={{ padding: 12 }}>Date</th>
              <th style={{ padding: 12 }}>Title</th>
              <th style={{ padding: 12 }}>Topic</th>
              <th style={{ padding: 12 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {affairs.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 12 }}>{new Date(a.date).toLocaleDateString()}</td>
                <td style={{ padding: 12 }}>{a.title}</td>
                <td style={{ padding: 12 }}>{a.topic || '-'}</td>
                <td style={{ padding: 12, display: 'flex', gap: 12 }}>
                  <button onClick={() => handleEdit(a)} style={{ color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Edit</button>
                  {confirmDeleteId === a.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#6B7280' }}>Are you sure?</span>
                      <button onClick={() => handleDelete(a.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Yes</button>
                      <button onClick={() => setConfirmDeleteId(null)} style={{ color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(a.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
            {affairs.length === 0 && <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center' }}>No current affairs found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
