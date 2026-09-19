import { useCallback, useEffect, useState } from 'react';
import { TestimonialApprovalsTab } from '../../superadmin/TestimonialApprovalsTab';
import {
  fetchAllTestimonialsForAdmin,
  approveTestimonial,
  rejectTestimonial,
  deleteTestimonial,
  invalidateApprovedTestimonialsCache,
} from '../../../services/testimonialService';
import type { TestimonialItem } from '../../../services/testimonialService';

export function TestimonialsView() {
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | string | null>(null);
  const [toast, setToast] = useState<{ text: string; isError: boolean } | null>(null);

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTestimonials(await fetchAllTestimonialsForAdmin());
    } catch (err: any) {
      showToast(err.message || 'Failed to load testimonials', true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (id: number | string, action: () => Promise<unknown>, success: string, failure: string) => {
    setProcessingId(id);
    try {
      await action();
      // The landing page caches approved testimonials; drop it so the change shows up.
      invalidateApprovedTestimonialsCache();
      showToast(success);
      await load();
    } catch (err: any) {
      showToast(err.message || failure, true);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div>
      {toast && (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            fontSize: 13,
            fontWeight: 600,
            backgroundColor: toast.isError ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${toast.isError ? '#fecaca' : '#bbf7d0'}`,
            color: toast.isError ? '#b91c1c' : '#15803d',
          }}
        >
          {toast.text}
        </div>
      )}
      <TestimonialApprovalsTab
        testimonials={testimonials}
        loading={loading}
        processingId={processingId}
        onApprove={(id, name) => run(id, () => approveTestimonial(id), `Approved testimonial by ${name}`, 'Failed to approve testimonial')}
        onReject={(id, name) =>
          run(id, () => rejectTestimonial(id, 'Inappropriate or invalid submission'), `Rejected testimonial by ${name}`, 'Failed to reject testimonial')
        }
        onDelete={(id, name) => {
          if (!window.confirm(`Permanently delete the story by ${name}?`)) return;
          run(id, () => deleteTestimonial(id), `Deleted testimonial by ${name}`, 'Failed to delete testimonial');
        }}
        onRefresh={load}
      />
    </div>
  );
}
