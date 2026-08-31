// shared/lessonIconComponents.jsx — slug → lucide component, for the two
// React bundles (the learner app and the admin panel). The slug list itself
// lives in lessonIcons.js, which stays data-only so the backend can import it.
//
// Every slug in LESSON_ICONS must appear here; lessonIconFor() returns null
// for anything unmapped so the caller can fall back to its own default glyph.
import {
  Wallet, Coins, Banknote, CreditCard, HandCoins, Percent,
  PiggyBank, Landmark, TrendingUp, PieChart, BarChart3, Sprout,
  Calculator, Receipt, Calendar, Clock, Target, Scale,
  ShieldCheck, Key, Umbrella,
  Home, Car, ShoppingCart, Gift, Smartphone,
  Briefcase, Building2, Handshake, GraduationCap, BookOpen, Lightbulb,
  Rocket, Star, Flame, Users, Globe, Dumbbell,
} from 'lucide-react';

const COMPONENTS = {
  'wallet': Wallet,
  'coins': Coins,
  'banknote': Banknote,
  'credit-card': CreditCard,
  'hand-coins': HandCoins,
  'percent': Percent,

  'piggy-bank': PiggyBank,
  'landmark': Landmark,
  'trending-up': TrendingUp,
  'chart-pie': PieChart,
  'chart-bar': BarChart3,
  'sprout': Sprout,

  'calculator': Calculator,
  'receipt': Receipt,
  'calendar': Calendar,
  'clock': Clock,
  'target': Target,
  'scale': Scale,

  'shield-check': ShieldCheck,
  'key': Key,
  'umbrella': Umbrella,

  'home': Home,
  'car': Car,
  'shopping-cart': ShoppingCart,
  'gift': Gift,
  'smartphone': Smartphone,

  'briefcase': Briefcase,
  'building': Building2,
  'handshake': Handshake,
  'graduation-cap': GraduationCap,
  'book-open': BookOpen,
  'lightbulb': Lightbulb,

  'rocket': Rocket,
  'star': Star,
  'flame': Flame,
  'users': Users,
  'globe': Globe,
  'dumbbell': Dumbbell,
};

/** The lucide component for a slug, or null if the slug isn't in the set. */
export function lessonIconFor(slug) {
  return (slug && COMPONENTS[slug]) || null;
}
