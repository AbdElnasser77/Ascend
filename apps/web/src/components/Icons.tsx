import {
  BookOpen,
  Briefcase,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  GraduationCap,
  Laptop,
  Mountain,
  Palette,
  PenLine,
  Sprout,
  Star,
  Target,
  Users,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { GoalKind } from "../lib/progress";

/** habit icons are stored by name so they survive a change of icon set */
export const HABIT_ICON_SET: Record<string, LucideIcon> = {
  laptop: Laptop,
  book: BookOpen,
  run: Footprints,
  droplet: Droplet,
  wind: Wind,
  pen: PenLine,
  target: Target,
  sprout: Sprout,
  dumbbell: Dumbbell,
  palette: Palette,
  graduation: GraduationCap,
  star: Star,
  users: Users,
};

export function HabitIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = HABIT_ICON_SET[name];
  // habits saved before the switch to Lucide still carry an emoji
  if (!Icon) return <span aria-hidden="true">{name}</span>;
  return <Icon size={size} strokeWidth={2} aria-hidden="true" />;
}

export const GOAL_ICON_SET: Record<GoalKind, LucideIcon> = {
  course: GraduationCap,
  streak: Flame,
  position: Briefcase,
  milestone: Mountain,
};
