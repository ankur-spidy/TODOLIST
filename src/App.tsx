import React, { useState, useEffect, useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  startOfWeek, 
  addDays, 
  parseISO,
  startOfToday,
  isAfter,
  differenceInSeconds
} from 'date-fns';
import { 
  Plus, 
  Trash2, 
  Download, 
  Moon, 
  Sun, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  Filter,
  HelpCircle,
  Trophy,
  Flame,
  Target,
  BarChart3,
  Droplets,
  Zap,
  Coffee,
  Utensils,
  Briefcase,
  BookOpen,
  Dumbbell,
  Wind,
  CheckCircle2,
  Circle,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { cn } from '@/src/lib/utils';
import { Habit, HabitData, DayStats, WeekStats } from '@/src/types';
import { WEEK_COLORS, INITIAL_HABITS, DAILY_ROUTINE } from '@/src/constants';

const IconMap: Record<string, React.ElementType> = {
  Sun, Droplets, Wind, Zap, Coffee, Utensils, Briefcase, BookOpen, Dumbbell, Moon
};

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [dailyRoutine, setDailyRoutine] = useState<Record<string, boolean>>({});
  const [waterIntake, setWaterIntake] = useState<number>(0);
  const [wakeUpTimestamp, setWakeUpTimestamp] = useState<number | null>(null);
  const [actualWakeUpTime, setActualWakeUpTime] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFromDate, setExportFromDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [exportToDate, setExportToDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const nextWork = useMemo(() => {
    const currentTimeStr = format(time, 'HH:mm');
    const next = DAILY_ROUTINE.find(item => item.time > currentTimeStr);
    return next || DAILY_ROUTINE[0];
  }, [time]);

  const elapsedTime = useMemo(() => {
    if (!wakeUpTimestamp) return null;
    const seconds = differenceInSeconds(time, new Date(wakeUpTimestamp));
    if (seconds < 0) return "0s";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m ` : ''}${s}s`;
  }, [time, wakeUpTimestamp]);

  const updateWaterIntake = (val: number) => {
    setWaterIntake(val);
    const today = format(new Date(), 'yyyy-MM-dd');
    // If goal reached (20 servings = 5L), mark habit as done
    setHabits(prev => prev.map(h => {
      if (h.name === "Water Intake (5L Goal)" || h.name === "Drink 250ml Water") {
        return {
          ...h,
          data: { ...h.data, [today]: val >= 20 }
        };
      }
      return h;
    }));
  };

  const toggleRoutineItem = (task: string) => {
    setDailyRoutine(prev => {
      const isCurrentlyCompleted = !!prev[task];
      const newState = { ...prev, [task]: !isCurrentlyCompleted };
      
      // Sync to Monthly Grid
      const today = format(new Date(), 'yyyy-MM-dd');
      const mapping: Record<string, string[]> = {
        "Wake up": ["Wake up (3:00 AM)", "Wake up", "wake up"],
        "Deep Work Session": ["Deep Work (3:30 AM - 8:00 AM)", "Work (Session 1)", "Work (Session 2)"],
        "Reading (30-40 mins)": ["Reading (30-40 mins)", "Read Books"],
        "Gym (Strength + Cardio)": ["Gym (7:00 PM - 9:00 PM)"],
        "Dinner (High Protein)": ["Dinner (10:00 PM)", "Food Eating"],
        "Sleep Preparation": ["Sleep Preparation", "Sleep"],
        "No Phone Scrolling": ["No Phone Scrolling (Morning)"],
        "Productive Output": ["Min 1 Productive Output"]
      };

      const habitNames = mapping[task];
      if (habitNames) {
        setHabits(habitsPrev => habitsPrev.map(h => {
          if (habitNames.includes(h.name)) {
            return {
              ...h,
              data: { ...h.data, [today]: !isCurrentlyCompleted }
            };
          }
          return h;
        }));
      }

      if (task === "Drink 250ml water" && !isCurrentlyCompleted) {
        updateWaterIntake(Math.min(waterIntake + 1, 20));
      }

      if (task === "Wake up") {
        if (!isCurrentlyCompleted) {
          const now = new Date();
          setWakeUpTimestamp(now.getTime());
          setActualWakeUpTime(format(now, 'hh:mm a'));
        } else {
          setWakeUpTimestamp(null);
          setActualWakeUpTime(null);
        }
      }
      return newState;
    });
  };

  const [isCustomRange, setIsCustomRange] = useState(false);
  const [viewFromDate, setViewFromDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [viewToDate, setViewToDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [helpLanguage, setHelpLanguage] = useState<'en' | 'hi' | 'bn'>('en');

  // Load data from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('habitflow_data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setHabits(parsed.habits);
        setIsDarkMode(parsed.theme === 'dark');
        
        const today = format(new Date(), 'yyyy-MM-dd');
        if (parsed.lastDate === today) {
          setDailyRoutine(parsed.dailyRoutine || {});
          setWaterIntake(parsed.waterIntake || 0);
          setWakeUpTimestamp(parsed.wakeUpTimestamp || null);
          setActualWakeUpTime(parsed.actualWakeUpTime || null);
        }
      } catch (e) {
        console.error('Failed to parse saved data', e);
        initializeDefaultHabits();
      }
    } else {
      initializeDefaultHabits();
    }
    setIsLoaded(true);
  }, []);

  // Save data to localStorage
  useEffect(() => {
    if (isLoaded) {
      const today = format(new Date(), 'yyyy-MM-dd');
      const data = {
        habits,
        theme: isDarkMode ? 'dark' : 'light',
        dailyRoutine,
        waterIntake,
        wakeUpTimestamp,
        actualWakeUpTime,
        lastDate: today
      };
      localStorage.setItem('habitflow_data', JSON.stringify(data));
    }
  }, [habits, isDarkMode, isLoaded, dailyRoutine, waterIntake, wakeUpTimestamp, actualWakeUpTime]);

  const initializeDefaultHabits = () => {
    const initial = INITIAL_HABITS.map(name => ({
      id: Math.random().toString(36).substr(2, 9),
      name,
      data: {},
      target: 80,
      createdAt: Date.now()
    }));
    setHabits(initial);
  };

  const daysInMonth = useMemo(() => {
    if (isExporting) {
      const start = parseISO(exportFromDate);
      const end = parseISO(exportToDate);
      return eachDayOfInterval({ start, end });
    }
    if (isCustomRange) {
      const start = parseISO(viewFromDate);
      const end = parseISO(viewToDate);
      try {
        return eachDayOfInterval({ start, end });
      } catch (e) {
        return eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
      }
    }
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate, isExporting, exportFromDate, exportToDate, isCustomRange, viewFromDate, viewToDate]);

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const result: WeekStats[] = [];
    
    let currentWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    
    for (let i = 0; i < 5; i++) {
      const weekDays: DayStats[] = [];
      let weekCompleted = 0;
      let weekTotal = 0;

      for (let j = 0; j < 7; j++) {
        const day = addDays(currentWeekStart, j);
        const dateStr = format(day, 'yyyy-MM-dd');
        
        // Only include days that are in the current month
        if (day.getMonth() === currentDate.getMonth()) {
          const completedCount = habits.reduce((acc, h) => acc + (h.data[dateStr] ? 1 : 0), 0);
          const totalCount = habits.length;
          const rate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
          
          weekDays.push({
            date: dateStr,
            day: day.getDate(),
            completionRate: rate,
            completedCount,
            totalCount
          });

          weekCompleted += completedCount;
          weekTotal += totalCount;
        } else {
          // Placeholder for days outside month but in the week grid
          weekDays.push({
            date: dateStr,
            day: day.getDate(),
            completionRate: 0,
            completedCount: 0,
            totalCount: 0
          });
        }
      }

      result.push({
        weekNumber: i + 1,
        days: weekDays,
        averageCompletion: weekTotal > 0 ? (weekCompleted / weekTotal) * 100 : 0
      });

      currentWeekStart = addDays(currentWeekStart, 7);
    }
    return result;
  }, [currentDate, habits]);

  const dailyStats = useMemo(() => {
    return daysInMonth.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const completedCount = habits.reduce((acc, h) => acc + (h.data[dateStr] ? 1 : 0), 0);
      const totalCount = habits.length;
      return {
        name: format(day, 'd'),
        date: dateStr,
        rate: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
        completed: completedCount,
        total: totalCount
      };
    });
  }, [daysInMonth, habits]);

  const overallStats = useMemo(() => {
    let totalCompleted = 0;
    let totalPossible = 0;

    habits.forEach(habit => {
      daysInMonth.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (habit.data[dateStr]) totalCompleted++;
        totalPossible++;
      });
    });

    return {
      percentage: totalPossible > 0 ? (totalCompleted / totalPossible) * 100 : 0,
      completed: totalCompleted,
      total: totalPossible
    };
  }, [habits, daysInMonth]);

  const topHabits = useMemo(() => {
    return habits
      .map(h => {
        const completed = daysInMonth.filter(d => h.data[format(d, 'yyyy-MM-dd')]).length;
        const total = daysInMonth.length;
        return {
          ...h,
          progress: (completed / total) * 100,
          completedCount: completed
        };
      })
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 10);
  }, [habits, daysInMonth]);

  const calculateStreak = (habit: Habit) => {
    let current = 0;
    let longest = 0;
    let temp = 0;
    
    // Sort all dates in habit data
    const dates = Object.keys(habit.data).sort();
    if (dates.length === 0) return { current: 0, longest: 0 };

    const today = startOfToday();
    let checkDate = today;

    // Current streak (counting backwards from today)
    while (habit.data[format(checkDate, 'yyyy-MM-dd')]) {
      current++;
      checkDate = addDays(checkDate, -1);
    }

    // Longest streak
    // We need to check all historical data
    const allDays = eachDayOfInterval({
      start: parseISO(dates[0]),
      end: today
    });

    allDays.forEach(day => {
      if (habit.data[format(day, 'yyyy-MM-dd')]) {
        temp++;
        if (temp > longest) longest = temp;
      } else {
        temp = 0;
      }
    });

    return { current, longest };
  };

  const toggleHabit = (habitId: string, dateStr: string) => {
    setHabits(prev => prev.map(h => {
      if (h.id === habitId) {
        return {
          ...h,
          data: {
            ...h.data,
            [dateStr]: !h.data[dateStr]
          }
        };
      }
      return h;
    }));
  };

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [habitToDelete, setHabitToDelete] = useState<string | null>(null);

  const addHabit = () => {
    if (newHabitName.trim()) {
      setHabits(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substr(2, 9),
          name: newHabitName.trim(),
          data: {},
          target: 80,
          createdAt: Date.now()
        }
      ]);
      setNewHabitName('');
      setIsAddModalOpen(false);
    }
  };

  const resetToDefaultRoutine = () => {
    if (window.confirm("This will replace all your current habits with the default daily routine. Continue?")) {
      const initial = INITIAL_HABITS.map(name => ({
        id: Math.random().toString(36).substr(2, 9),
        name,
        data: {},
        target: 80,
        createdAt: Date.now()
      }));
      setHabits(initial);
      setIsAddModalOpen(false);
    }
  };

  const confirmDelete = () => {
    if (habitToDelete) {
      setHabits(prev => prev.filter(h => h.id !== habitToDelete));
      setHabitToDelete(null);
    }
  };

  const renameHabit = (id: string, newName: string) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, name: newName } : h));
  };

  const updateHabitTarget = (id: string, target: number) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, target } : h));
  };

  const exportPDF = async () => {
    const start = parseISO(exportFromDate);
    const end = parseISO(exportToDate);
    
    if (isAfter(start, end)) {
      setExportError("Start date must be before end date");
      return;
    }

    setExportError(null);
    setIsExporting(true);
    // Wait for React to re-render with the filtered range if needed
    setTimeout(async () => {
      const element = document.getElementById('dashboard-content');
      if (!element) {
        setIsExporting(false);
        return;
      }
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`habit-tracker-${exportFromDate}-to-${exportToDate}.pdf`);
      setIsExporting(false);
      setIsExportModalOpen(false);
    }, 500);
  };

  if (!isLoaded) return null;

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300 font-sans",
      isDarkMode ? "bg-slate-950 text-slate-100 dark" : "bg-cream-50 text-slate-900"
    )}>
      <div id="dashboard-content" className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
        
        {/* Top Controls */}
        {!isExporting && (
          <div className="flex items-center justify-end gap-3">
            <button 
              onClick={() => setIsFilterModalOpen(true)}
              className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              <Filter className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsHelpModalOpen(true)}
              className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
            <button 
              onClick={() => setIsExportModalOpen(true)}
              className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black shadow-sm hover:opacity-90 transition-all active:scale-95 text-sm"
            >
              Export PDF
            </button>
          </div>
        )}

        {/* Header Section */}
        <header className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left: Month Info */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="space-y-1">
              <h1 className="text-7xl font-serif font-black tracking-tighter text-slate-900 dark:text-white leading-none">
                {format(currentDate, 'MMMM')}
              </h1>
              <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">Habit Tracker {format(currentDate, 'yyyy')}</p>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 w-full mt-6">
              <div className="flex-1 flex flex-col px-3 border-r border-slate-200 dark:border-slate-700">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Month</span>
                <select 
                  value={currentDate.getMonth()}
                  onChange={(e) => {
                    const newDate = new Date(currentDate);
                    newDate.setMonth(parseInt(e.target.value));
                    setCurrentDate(newDate);
                  }}
                  className="bg-transparent font-bold text-xs focus:outline-none cursor-pointer"
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i} value={i}>{format(new Date(2026, i, 1), 'MMMM')}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 flex flex-col px-3">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Year</span>
                <select 
                  value={currentDate.getFullYear()}
                  onChange={(e) => {
                    const newDate = new Date(currentDate);
                    newDate.setFullYear(parseInt(e.target.value));
                    setCurrentDate(newDate);
                  }}
                  className="bg-transparent font-bold text-xs focus:outline-none cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Center: Area Chart */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="px-8 pt-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Activity Wave</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Completion %</span>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-[160px] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                      fontSize: '12px'
                    }}
                    labelStyle={{ fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="rate" 
                    stroke="#60A5FA" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorRate)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Stats Box */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monthly Score</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-5xl font-black text-slate-900 dark:text-white">{Math.round(overallStats.percentage)}</p>
                  <p className="text-xl font-bold text-slate-300">%</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Check-ins</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white italic">{overallStats.completed}</p>
              </div>
            </div>
            <div className="relative w-28 h-28">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { value: overallStats.percentage },
                      { value: 100 - overallStats.percentage }
                    ]}
                    innerRadius="70%"
                    outerRadius="100%"
                    paddingAngle={0}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    <Cell fill="#F472B6" />
                    <Cell fill={isDarkMode ? '#1e293b' : '#f8fafc'} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <Trophy className="w-8 h-8 text-pink-400" />
              </div>
            </div>
          </div>
        </header>

        {/* Middle Row: Motivation, Weekly Charts, Top 10 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Next Work & Goal Card */}
          <div className="lg:col-span-2">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm h-full flex flex-col justify-between space-y-8"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-500" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Next Work</h3>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{nextWork.task}</p>
                  <p className="text-xs font-bold text-blue-500">{nextWork.time}</p>
                </div>
              </div>

              {elapsedTime && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Since Wakeup</h3>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-tight tabular-nums">{elapsedTime}</p>
                    {actualWakeUpTime && (
                      <p className="text-[10px] font-bold text-slate-400">Started at {actualWakeUpTime}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-pink-500" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Daily Goal</h3>
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-black text-slate-900 dark:text-white leading-tight">5L Water Intake</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-pink-400 transition-all duration-500"
                        style={{ width: `${(waterIntake / 20) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{Math.round((waterIntake / 20) * 100)}%</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Weekly Bar & Donut Charts */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
            <div className="grid grid-cols-5 gap-4">
              {weeks.map((week, idx) => (
                <div key={week.weekNumber} className="space-y-6">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-300 text-center">Week {week.weekNumber}</h4>
                  <div className="h-32 flex items-end justify-between gap-1">
                    {week.days.map((day, dIdx) => (
                      <div key={dIdx} className="flex-1 flex flex-col items-center gap-2">
                        <div 
                          className="w-full rounded-t-lg transition-all duration-500"
                          style={{ 
                            height: `${day.completionRate}%`,
                            backgroundColor: WEEK_COLORS[idx],
                            opacity: day.completionRate > 0 ? 1 : 0.1
                          }}
                        />
                        <span className="text-[8px] font-bold text-slate-400">{Math.round(day.completionRate)}%</span>
                        <span className="text-[8px] font-black text-slate-900 dark:text-white">{day.completedCount}</span>
                      </div>
                    ))}
                  </div>
                  <div className="relative w-20 h-20 mx-auto">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { value: week.averageCompletion },
                            { value: 100 - week.averageCompletion }
                          ]}
                          innerRadius="75%"
                          outerRadius="100%"
                          paddingAngle={0}
                          dataKey="value"
                          startAngle={90}
                          endAngle={-270}
                        >
                          <Cell fill={WEEK_COLORS[idx]} />
                          <Cell fill={isDarkMode ? '#1e293b' : '#f8fafc'} />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-900 dark:text-white">
                      {Math.round(week.averageCompletion)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top 10 Habits Table */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Top Performers</h3>
            </div>
            <div className="flex-1 overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[8px] font-bold uppercase tracking-widest text-slate-400">
                    <th className="p-3">Rank</th>
                    <th className="p-3">Habit</th>
                    <th className="p-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {topHabits.map((h, i) => (
                    <tr key={h.id} className="text-[10px] group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 font-bold text-slate-300">{i + 1}</td>
                      <td className="p-3 font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[100px]">{h.name}</td>
                      <td className="p-3 text-right">
                        <span className={cn(
                          "font-black",
                          h.progress >= h.target ? "text-emerald-500" : "text-blue-500"
                        )}>
                          {Math.round(h.progress)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-center text-slate-500 italic leading-tight">
                "Small wins lead to big changes. Keep pushing!"
              </p>
            </div>
          </div>
        </div>

        {/* Daily Disciplines: Routine Checklist & Water Tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Daily Routine Checklist */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Daily Disciplines</h3>
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {format(time, 'EEEE, MMM do')}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DAILY_ROUTINE.map((item, idx) => {
                const Icon = IconMap[item.icon] || Circle;
                const isCompleted = dailyRoutine[item.task];
                return (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => toggleRoutineItem(item.task)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group",
                      isCompleted 
                        ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/50" 
                        : "bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      isCompleted ? "bg-emerald-500 text-white" : "bg-white dark:bg-slate-800 text-slate-400 group-hover:text-slate-600"
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs font-bold transition-colors",
                        isCompleted ? "text-emerald-700 dark:text-emerald-400 line-through opacity-60" : "text-slate-700 dark:text-slate-200"
                      )}>
                        {item.task}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        {item.time} {item.end ? `- ${item.end}` : ''}
                      </p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      isCompleted ? "bg-emerald-500 border-emerald-500" : "border-slate-200 dark:border-slate-700"
                    )}>
                      {isCompleted && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Water Tracker (20 Checkboxes) */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Droplets className="w-5 h-5 text-blue-500" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Hydration Goal</h3>
              </div>
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">
                {waterIntake * 250}ml / 5000ml
              </div>
            </div>

            <div className="flex-1 grid grid-cols-5 gap-3">
              {Array.from({ length: 20 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => updateWaterIntake(i + 1 === waterIntake ? i : i + 1)}
                  className={cn(
                    "aspect-square rounded-xl border-2 transition-all flex items-center justify-center group",
                    i < waterIntake 
                      ? "bg-blue-500 border-blue-500 shadow-lg shadow-blue-500/20" 
                      : "bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 hover:border-blue-200"
                  )}
                >
                  {i < waterIntake ? (
                    <Droplets className="w-4 h-4 text-white" />
                  ) : (
                    <span className="text-[8px] font-bold text-slate-300 group-hover:text-blue-400">{i + 1}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/50">
              <p className="text-[10px] text-center text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest leading-tight">
                250ml per serving • 20 servings total
              </p>
            </div>
          </div>
        </div>

        {/* Main Section: Unified Habit Grid */}
        <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                  {/* Habit Name Header */}
                  <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-800 p-4 text-left border-r border-slate-100 dark:border-slate-700 min-w-[240px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Daily Habits</span>
                      {!isExporting && (
                        <button 
                          onClick={() => setIsAddModalOpen(true)}
                          className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </th>

                  {/* Days Headers */}
                  {daysInMonth.map((day, i) => {
                    const weekIdx = Math.floor(i / 7);
                    return (
                      <th 
                        key={day.toString()} 
                        className="p-3 text-center border-r border-slate-100 dark:border-slate-700 min-w-[40px]"
                        style={{ color: WEEK_COLORS[weekIdx] }}
                      >
                        <div className="text-[8px] uppercase font-bold opacity-60 mb-1">{format(day, 'EEE')}</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white italic">{format(day, 'd')}</div>
                      </th>
                    );
                  })}

                  {/* Stats Headers */}
                  <th className="p-4 text-center border-l border-slate-100 dark:border-slate-700 min-w-[80px] bg-blue-50/30 dark:bg-blue-900/10">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Goal</span>
                  </th>
                  <th className="p-4 text-center border-l border-slate-100 dark:border-slate-700 min-w-[140px] bg-blue-50/30 dark:bg-blue-900/10">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Progress</span>
                  </th>
                  <th className="p-4 text-center border-l border-slate-100 dark:border-slate-700 min-w-[100px] bg-blue-50/30 dark:bg-blue-900/10">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Count</span>
                  </th>
                  <th className="p-4 text-center border-l border-slate-100 dark:border-slate-700 min-w-[80px] bg-blue-50/30 dark:bg-blue-900/10">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Streak</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {habits.map((habit, hIdx) => {
                  const { current, longest } = calculateStreak(habit);
                  const completed = Object.values(habit.data).filter(v => v).length;
                  const total = daysInMonth.length;
                  const progress = total > 0 ? (completed / total) * 100 : 0;

                  return (
                    <motion.tr 
                      key={habit.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: hIdx * 0.05 }}
                      className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Habit Name Cell */}
                      <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 p-4 border-r border-slate-50 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-slate-300 w-4">{hIdx + 1}</span>
                          <input 
                            type="text"
                            value={habit.name}
                            onChange={(e) => renameHabit(habit.id, e.target.value)}
                            className="text-xs font-semibold bg-transparent border-none focus:ring-0 w-full p-0 text-slate-700 dark:text-slate-200"
                          />
                          {!isExporting && (
                            <button 
                              onClick={() => setHabitToDelete(habit.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-500 transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Checkbox Cells */}
                      {daysInMonth.map((day, i) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const isCompleted = habit.data[dateStr];
                        const weekIdx = Math.floor(i / 7);
                        return (
                          <td key={dateStr} className="p-0 border-r border-slate-50 dark:border-slate-800">
                            <button
                              onClick={() => toggleHabit(habit.id, dateStr)}
                              className="w-full aspect-square flex items-center justify-center transition-all duration-200 group/btn"
                            >
                              <div className={cn(
                                "w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center",
                                isCompleted 
                                  ? "bg-current border-current shadow-sm" 
                                  : "border-slate-200 dark:border-slate-700 group-hover/btn:border-slate-400"
                              )} style={{ color: isCompleted ? WEEK_COLORS[weekIdx] : 'inherit' }}>
                                {isCompleted && <div className="w-2 h-2 rounded-full bg-white shadow-inner" />}
                              </div>
                            </button>
                          </td>
                        );
                      })}

                      {/* Stats Cells */}
                      <td className="p-4 text-center border-l border-slate-50 dark:border-slate-800 bg-blue-50/10 dark:bg-blue-900/5">
                        <div className="flex flex-col items-center gap-1">
                          <input 
                            type="number"
                            value={habit.target}
                            onChange={(e) => updateHabitTarget(habit.id, parseInt(e.target.value) || 0)}
                            className="w-10 text-center text-[10px] font-bold bg-transparent border-none focus:ring-0 p-0 text-slate-900 dark:text-white"
                          />
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">%</span>
                        </div>
                      </td>
                      <td className="p-4 border-l border-slate-50 dark:border-slate-800 bg-blue-50/10 dark:bg-blue-900/5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-widest">
                            <span className={progress >= habit.target ? "text-emerald-500" : "text-slate-400"}>
                              {progress >= habit.target ? "Target Met" : "In Progress"}
                            </span>
                            <span className="text-slate-900 dark:text-white">{Math.round(progress)}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              className={cn(
                                "h-full transition-all duration-500",
                                progress >= habit.target ? "bg-emerald-400" : "bg-blue-400"
                              )}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center border-l border-slate-50 dark:border-slate-800 bg-blue-50/10 dark:bg-blue-900/5">
                        <span className="text-[10px] font-black text-slate-900 dark:text-white">{completed}</span>
                        <span className="text-[8px] font-bold text-slate-400 mx-1">/</span>
                        <span className="text-[8px] font-bold text-slate-400">{total}</span>
                      </td>
                      <td className="p-4 text-center border-l border-slate-50 dark:border-slate-800 bg-blue-50/10 dark:bg-blue-900/5">
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-1">
                            <Flame className={cn("w-3 h-3", current > 0 ? "text-orange-500" : "text-slate-300")} />
                            <span className="text-xs font-black text-slate-900 dark:text-white">{current}</span>
                          </div>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Best: {longest}</span>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <h3 className="text-xl font-bold mb-4">Add New Habit</h3>
              <input 
                autoFocus
                type="text" 
                placeholder="e.g. Morning Yoga"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addHabit()}
                className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              
              <button 
                onClick={resetToDefaultRoutine}
                className="w-full mb-6 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors border border-blue-100 dark:border-blue-900/30"
              >
                Reset to Default Daily Routine
              </button>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={addHabit}
                  className="flex-1 px-4 py-3 rounded-2xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
                >
                  Add Habit
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {habitToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHabitToDelete(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <h3 className="text-xl font-bold mb-2">Delete Habit?</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">This action cannot be undone. All progress data for this habit will be lost.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setHabitToDelete(null)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-3 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isHelpModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHelpModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <HelpCircle className="w-6 h-6 text-blue-500" />
                  How it Works
                </h3>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button 
                    onClick={() => setHelpLanguage('en')}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", helpLanguage === 'en' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-500" : "text-slate-500")}
                  >
                    English
                  </button>
                  <button 
                    onClick={() => setHelpLanguage('hi')}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", helpLanguage === 'hi' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-500" : "text-slate-500")}
                  >
                    हिंदी
                  </button>
                  <button 
                    onClick={() => setHelpLanguage('bn')}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", helpLanguage === 'bn' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-500" : "text-slate-500")}
                  >
                    বাংলা
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {helpLanguage === 'en' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-500 font-bold text-sm">1</div>
                      <p className="text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-900 dark:text-white">Track Habits:</span> Click on any cell in the grid to mark a habit as completed for that day. Click again to unmark.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-500 font-bold text-sm">2</div>
                      <p className="text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-900 dark:text-white">Add/Delete:</span> Use the <Plus className="inline w-4 h-4" /> button in the grid header to add new habits. Hover over a habit name to see the <Trash2 className="inline w-4 h-4" /> delete icon.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-500 font-bold text-sm">3</div>
                      <p className="text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-900 dark:text-white">Filters:</span> Use the <Filter className="inline w-4 h-4" /> button to view a custom date range. Use arrows <ChevronLeft className="inline w-4 h-4" /> <ChevronRight className="inline w-4 h-4" /> to jump between months.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-500 font-bold text-sm">4</div>
                      <p className="text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-900 dark:text-white">Export:</span> Click "Export PDF" to generate a clean, professional report of your selected date range.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-500 font-bold text-sm">5</div>
                      <p className="text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-900 dark:text-white">Offline Sync:</span> Your data is saved automatically in your browser. You can use this app offline!</p>
                    </div>
                  </div>
                )}

                {helpLanguage === 'hi' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-500 font-bold text-sm">1</div>
                      <p className="text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-900 dark:text-white">आदतों को ट्रैक करें:</span> किसी भी दिन के लिए आदत को पूरा चिह्नित करने के लिए ग्रिड में किसी भी सेल पर क्लिक करें।</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-500 font-bold text-sm">2</div>
                      <p className="text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-900 dark:text-white">जोड़ें/हटाएं:</span> नई आदतों को जोड़ने के लिए ग्रिड हेडर में <Plus className="inline w-4 h-4" /> बटन का उपयोग करें। हटाने के लिए आदत के नाम पर माउस ले जाएं।</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-500 font-bold text-sm">3</div>
                      <p className="text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-900 dark:text-white">फ़िल्टर:</span> कस्टम तिथि सीमा देखने के लिए <Filter className="inline w-4 h-4" /> बटन का उपयोग करें। महीनों के बीच जाने के लिए तीरों का उपयोग करें।</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-500 font-bold text-sm">4</div>
                      <p className="text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-900 dark:text-white">निर्यात:</span> अपनी प्रगति रिपोर्ट डाउनलोड करने के लिए "Export PDF" बटन पर क्लिक करें।</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-500 font-bold text-sm">5</div>
                      <p className="text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-900 dark:text-white">ऑफ़लाइन सिंक:</span> आपका डेटा आपके ब्राउज़र में स्वचालित रूप से सहेजा जाता है।</p>
                    </div>
                  </div>
                )}

                {helpLanguage === 'bn' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-500 font-bold text-sm">1</div>
                      <p className="text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-900 dark:text-white">অভ্যাস ট্র্যাক করুন:</span> কোনো নির্দিষ্ট দিনের জন্য অভ্যাসটি সম্পন্ন হিসেবে চিহ্নিত করতে গ্রিডের যেকোনো সেলে ক্লিক করুন।</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-500 font-bold text-sm">2</div>
                      <p className="text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-900 dark:text-white">যোগ/মুছে ফেলা:</span> নতুন অভ্যাস যোগ করতে গ্রিড হেডারে <Plus className="inline w-4 h-4" /> বোতামটি ব্যবহার করুন। মুছতে নামের ওপর মাউস রাখুন।</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-500 font-bold text-sm">3</div>
                      <p className="text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-900 dark:text-white">ফিল্টার:</span> নির্দিষ্ট তারিখের ব্যাপ্তি দেখতে <Filter className="inline w-4 h-4" /> বোতামটি ব্যবহার করুন। মাস পরিবর্তনের জন্য তীর চিহ্ন ব্যবহার করুন।</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-500 font-bold text-sm">4</div>
                      <p className="text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-900 dark:text-white">এক্সপোর্ট:</span> আপনার অগ্রগতির রিপোর্ট ডাউনলোড করতে "Export PDF" বোতামে ক্লিক করুন।</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-500 font-bold text-sm">5</div>
                      <p className="text-slate-600 dark:text-slate-300"><span className="font-bold text-slate-900 dark:text-white">অফলাইন সিঙ্ক:</span> আপনার তথ্য আপনার ব্রাউজারে স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়।</p>
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setIsHelpModalOpen(false)}
                className="w-full mt-8 px-4 py-4 rounded-2xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
              >
                Got it!
              </button>
            </motion.div>
          </div>
        )}

        {isFilterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Filter View Range</h3>
                <button 
                  onClick={() => {
                    setIsCustomRange(false);
                    setIsFilterModalOpen(false);
                  }}
                  className="text-xs font-bold text-blue-500 hover:underline"
                >
                  Reset to Month
                </button>
              </div>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Start Date</label>
                  <input 
                    type="date" 
                    value={viewFromDate}
                    onChange={(e) => setViewFromDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">End Date</label>
                  <input 
                    type="date" 
                    value={viewToDate}
                    onChange={(e) => setViewToDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsFilterModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setIsCustomRange(true);
                    setIsFilterModalOpen(false);
                  }}
                  className="flex-1 px-4 py-3 rounded-2xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
                >
                  Apply Filter
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isExportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExportModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <h3 className="text-xl font-bold mb-4">Export PDF Range</h3>
              {exportError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-500 text-xs font-bold rounded-xl border border-red-100 dark:border-red-900/30">
                  {exportError}
                </div>
              )}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">From Date</label>
                  <input 
                    type="date" 
                    value={exportFromDate}
                    onChange={(e) => setExportFromDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">To Date</label>
                  <input 
                    type="date" 
                    value={exportToDate}
                    onChange={(e) => setExportToDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsExportModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={exportPDF}
                  disabled={isExporting}
                  className="flex-1 px-4 py-3 rounded-2xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {isExporting ? 'Generating...' : 'Export PDF'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
