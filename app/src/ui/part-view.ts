import type { DashboardPart } from '../data/repositories/car-repository';
import { daysBetween } from '../domain/local-date';
import type { PartStatus } from '../domain/status';
import type { Theme } from './theme';

export function formatDate(value: string | null): string {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function partDetailLine(part: DashboardPart): string {
  if (part.intervalType === 'condition') {
    if (part.inspectionDue) return part.inspectionDueDate ? `Inspection due since ${formatDate(part.inspectionDueDate)}` : 'Inspection due';
    return part.inspectionDueDate ? `Inspect by ${formatDate(part.inspectionDueDate)}` : 'Set an inspection interval';
  }
  if (part.status === 'SetInterval') return 'Set a replacement interval';
  if (part.status === 'Unknown') return 'No service record yet';
  if (part.dueDate) {
    const days = part.remainingDays;
    return `Due ${formatDate(part.dueDate)}${days === null ? '' : ` · ${days} ${days === 1 ? 'day' : 'days'} left`}`;
  }
  if (part.remainingKm !== null) return `${part.remainingKm.toLocaleString()} km left`;
  return 'Needs a service record';
}

/** Remaining share of the shortest active interval, or null when it cannot be drawn. */
export function partProgress(part: DashboardPart): number | null {
  if (part.intervalType === 'condition') return null;
  if (part.remainingKm !== null && part.distanceKm !== null && part.distanceKm > 0) {
    return clamp((part.remainingKm / part.distanceKm) * 100);
  }
  if (part.remainingDays !== null && part.serviceDate && part.dueDate) {
    const total = daysBetween(part.serviceDate, part.dueDate);
    if (total > 0) return clamp((part.remainingDays / total) * 100);
  }
  return null;
}

export function summaryCounts(parts: DashboardPart[]): { upToDate: number; needRecord: number } {
  return {
    upToDate: parts.filter((part) => part.status === 'OK').length,
    needRecord: parts.filter((part) => part.status === 'Unknown' || part.status === 'SetInterval').length,
  };
}

export function statusTone(status: PartStatus, theme: Theme): { bg: string; fg: string } {
  switch (status) {
    case 'OK': return { bg: theme.okBg, fg: theme.okText };
    case 'DueSoon': return { bg: theme.warnBg, fg: theme.warn };
    case 'Overdue': return { bg: theme.dangerBg, fg: theme.danger };
    case 'SetInterval': return { bg: theme.tint, fg: theme.highlight };
    case 'Inspect': return { bg: theme.warnBg, fg: theme.warn };
    default: return { bg: theme.track, fg: theme.muted };
  }
}

export function partIcon(category: string): 'droplet' | 'filter' | 'zap' | 'disc' | 'thermometer' | 'circle' | 'battery-charging' | 'eye' | 'wind' | 'tool' {
  switch (category.toLowerCase()) {
    case 'engine': return 'droplet';
    case 'filters': return 'filter';
    case 'fuel': return 'zap';
    case 'brakes': return 'disc';
    case 'fluids': return 'thermometer';
    case 'tires': return 'circle';
    case 'electrical': return 'battery-charging';
    case 'visibility': return 'eye';
    case 'emissions': return 'wind';
    default: return 'tool';
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
