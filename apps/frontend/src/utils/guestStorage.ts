export interface GuestExamAttempt {
  id: string;
  targetExam: string;
  targetYear: string;
  topicName: string;
  subtopicName: string;
  score: number;
  totalMarksPossible: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  accuracy: number;
  totalQuestions: number;
  timeSpentSeconds?: number;
  completedAt: string;
}

const STORAGE_KEY = 'guest_exam_history';

export function getGuestAttempts(): GuestExamAttempt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse guest exam history from localStorage:', err);
    return [];
  }
}

export function saveGuestAttempt(attempt: Omit<GuestExamAttempt, 'id' | 'completedAt'> & { id?: string; completedAt?: string }): GuestExamAttempt {
  const attempts = getGuestAttempts();
  const newAttempt: GuestExamAttempt = {
    ...attempt,
    id: attempt.id || `guest-attempt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    completedAt: attempt.completedAt || new Date().toISOString(),
  };

  const existingIdx = attempts.findIndex((a) => a.id === newAttempt.id);
  if (existingIdx >= 0) {
    attempts[existingIdx] = newAttempt;
  } else {
    attempts.unshift(newAttempt);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
  } catch (err) {
    console.warn('Failed to save guest exam attempt to localStorage:', err);
  }

  return newAttempt;
}

export function clearGuestAttempts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear guest exam attempts from localStorage:', err);
  }
}
