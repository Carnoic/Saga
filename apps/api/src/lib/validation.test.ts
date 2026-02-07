import { describe, it, expect } from 'vitest';
import { isOverlapping, calculateProgressPercentage, daysBetween } from '@saga/shared';

describe('Rotation overlap validation', () => {
  it('should detect overlapping rotations', () => {
    // Rotation 1: Jan 1 - Jan 31
    const start1 = new Date('2024-01-01');
    const end1 = new Date('2024-01-31');

    // Rotation 2: Jan 15 - Feb 15 (overlaps)
    const start2 = new Date('2024-01-15');
    const end2 = new Date('2024-02-15');

    expect(isOverlapping(start1, end1, start2, end2)).toBe(true);
  });

  it('should detect no overlap for non-overlapping rotations', () => {
    // Rotation 1: Jan 1 - Jan 31
    const start1 = new Date('2024-01-01');
    const end1 = new Date('2024-01-31');

    // Rotation 2: Feb 1 - Feb 28 (no overlap)
    const start2 = new Date('2024-02-01');
    const end2 = new Date('2024-02-28');

    expect(isOverlapping(start1, end1, start2, end2)).toBe(false);
  });

  it('should detect overlap when one rotation contains another', () => {
    // Rotation 1: Jan 1 - Mar 31
    const start1 = new Date('2024-01-01');
    const end1 = new Date('2024-03-31');

    // Rotation 2: Feb 1 - Feb 28 (contained within)
    const start2 = new Date('2024-02-01');
    const end2 = new Date('2024-02-28');

    expect(isOverlapping(start1, end1, start2, end2)).toBe(true);
  });

  it('should handle rotations that touch at boundaries', () => {
    // Rotation 1: Jan 1 - Jan 31
    const start1 = new Date('2024-01-01');
    const end1 = new Date('2024-01-31');

    // Rotation 2: Jan 31 - Feb 28 (boundary touch - should overlap)
    const start2 = new Date('2024-01-31');
    const end2 = new Date('2024-02-28');

    expect(isOverlapping(start1, end1, start2, end2)).toBe(true);
  });
});

describe('Progress calculation', () => {
  it('should calculate correct percentage', () => {
    expect(calculateProgressPercentage(5, 10)).toBe(50);
    expect(calculateProgressPercentage(3, 10)).toBe(30);
    expect(calculateProgressPercentage(10, 10)).toBe(100);
    expect(calculateProgressPercentage(0, 10)).toBe(0);
  });

  it('should handle zero total', () => {
    expect(calculateProgressPercentage(0, 0)).toBe(0);
  });

  it('should round percentages', () => {
    expect(calculateProgressPercentage(1, 3)).toBe(33);
    expect(calculateProgressPercentage(2, 3)).toBe(67);
  });
});

describe('Days between calculation', () => {
  it('should calculate days between dates', () => {
    const date1 = new Date('2024-01-01');
    const date2 = new Date('2024-01-31');

    expect(daysBetween(date1, date2)).toBe(30);
  });

  it('should handle same date', () => {
    const date = new Date('2024-01-01');

    expect(daysBetween(date, date)).toBe(0);
  });

  it('should return positive value regardless of order', () => {
    const date1 = new Date('2024-01-01');
    const date2 = new Date('2024-01-31');

    expect(daysBetween(date1, date2)).toBe(30);
    expect(daysBetween(date2, date1)).toBe(30);
  });
});
