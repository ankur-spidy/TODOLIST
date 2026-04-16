export interface Habit {
  id: string;
  name: string;
  data: Record<string, boolean>; // date string (YYYY-MM-DD) -> completed
  target: number; // target percentage (0-100)
  createdAt: number;
}

export interface HabitData {
  habits: Habit[];
  theme: 'light' | 'dark';
}

export interface DayStats {
  date: string;
  day: number;
  completionRate: number;
  completedCount: number;
  totalCount: number;
}

export interface WeekStats {
  weekNumber: number;
  days: DayStats[];
  averageCompletion: number;
}
