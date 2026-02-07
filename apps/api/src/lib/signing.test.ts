import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock assessment signing logic
interface Assessment {
  id: string;
  type: string;
  date: Date;
  signedAt: Date | null;
  rating?: number;
  narrativeFeedback?: string;
}

function canEditAssessment(assessment: Assessment): boolean {
  return assessment.signedAt === null;
}

function canDeleteAssessment(assessment: Assessment): boolean {
  return assessment.signedAt === null;
}

function signAssessment(assessment: Assessment): Assessment {
  if (assessment.signedAt !== null) {
    throw new Error('Assessment is already signed');
  }
  return {
    ...assessment,
    signedAt: new Date(),
  };
}

describe('Assessment signing and locking', () => {
  let unsignedAssessment: Assessment;
  let signedAssessment: Assessment;

  beforeEach(() => {
    unsignedAssessment = {
      id: '1',
      type: 'DOPS',
      date: new Date('2024-01-15'),
      signedAt: null,
      rating: 4,
      narrativeFeedback: 'Good performance',
    };

    signedAssessment = {
      id: '2',
      type: 'MINI_CEX',
      date: new Date('2024-01-10'),
      signedAt: new Date('2024-01-11'),
      rating: 5,
      narrativeFeedback: 'Excellent',
    };
  });

  describe('canEditAssessment', () => {
    it('should allow editing unsigned assessments', () => {
      expect(canEditAssessment(unsignedAssessment)).toBe(true);
    });

    it('should prevent editing signed assessments', () => {
      expect(canEditAssessment(signedAssessment)).toBe(false);
    });
  });

  describe('canDeleteAssessment', () => {
    it('should allow deleting unsigned assessments', () => {
      expect(canDeleteAssessment(unsignedAssessment)).toBe(true);
    });

    it('should prevent deleting signed assessments', () => {
      expect(canDeleteAssessment(signedAssessment)).toBe(false);
    });
  });

  describe('signAssessment', () => {
    it('should sign an unsigned assessment', () => {
      const result = signAssessment(unsignedAssessment);

      expect(result.signedAt).not.toBeNull();
      expect(result.id).toBe(unsignedAssessment.id);
    });

    it('should throw error when signing already signed assessment', () => {
      expect(() => signAssessment(signedAssessment)).toThrow('Assessment is already signed');
    });

    it('should make assessment read-only after signing', () => {
      const result = signAssessment(unsignedAssessment);

      expect(canEditAssessment(result)).toBe(false);
      expect(canDeleteAssessment(result)).toBe(false);
    });
  });
});

// Mock supervision meeting signing logic
interface SupervisionMeeting {
  id: string;
  date: Date;
  signedAt: Date | null;
  notes?: string;
}

function canEditMeeting(meeting: SupervisionMeeting): boolean {
  return meeting.signedAt === null;
}

function signMeeting(meeting: SupervisionMeeting): SupervisionMeeting {
  if (meeting.signedAt !== null) {
    throw new Error('Meeting is already signed');
  }
  return {
    ...meeting,
    signedAt: new Date(),
  };
}

describe('Supervision meeting signing and locking', () => {
  let unsignedMeeting: SupervisionMeeting;
  let signedMeeting: SupervisionMeeting;

  beforeEach(() => {
    unsignedMeeting = {
      id: '1',
      date: new Date('2024-01-15'),
      signedAt: null,
      notes: 'Discussed progress',
    };

    signedMeeting = {
      id: '2',
      date: new Date('2024-01-10'),
      signedAt: new Date('2024-01-11'),
      notes: 'Good discussion',
    };
  });

  it('should allow editing unsigned meetings', () => {
    expect(canEditMeeting(unsignedMeeting)).toBe(true);
  });

  it('should prevent editing signed meetings', () => {
    expect(canEditMeeting(signedMeeting)).toBe(false);
  });

  it('should sign a meeting successfully', () => {
    const result = signMeeting(unsignedMeeting);
    expect(result.signedAt).not.toBeNull();
  });

  it('should prevent double signing', () => {
    expect(() => signMeeting(signedMeeting)).toThrow('Meeting is already signed');
  });
});

// Subgoal signing test
interface SubGoalProgress {
  id: string;
  status: 'EJ_PABORJAD' | 'PAGAENDE' | 'UPPNADD';
  signedAt: Date | null;
  signedById: string | null;
}

function signSubGoal(progress: SubGoalProgress, userId: string): SubGoalProgress {
  if (progress.signedAt !== null) {
    throw new Error('SubGoal is already signed');
  }
  return {
    ...progress,
    status: 'UPPNADD',
    signedAt: new Date(),
    signedById: userId,
  };
}

describe('SubGoal signing', () => {
  it('should sign a subgoal and mark as completed', () => {
    const progress: SubGoalProgress = {
      id: '1',
      status: 'PAGAENDE',
      signedAt: null,
      signedById: null,
    };

    const result = signSubGoal(progress, 'supervisor-123');

    expect(result.status).toBe('UPPNADD');
    expect(result.signedAt).not.toBeNull();
    expect(result.signedById).toBe('supervisor-123');
  });

  it('should prevent re-signing', () => {
    const progress: SubGoalProgress = {
      id: '1',
      status: 'UPPNADD',
      signedAt: new Date(),
      signedById: 'supervisor-123',
    };

    expect(() => signSubGoal(progress, 'supervisor-456')).toThrow('SubGoal is already signed');
  });
});
