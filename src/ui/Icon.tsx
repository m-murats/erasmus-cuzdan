// Prototipteki lucide ikon adlarını (ör. "shopping-cart") lucide-react bileşenlerine eşler.
import {
  ArrowLeft, BedDouble, Bus, Calendar, ChartPie, ChevronDown, ChevronRight, CircleEllipsis, DatabaseBackup, Download,
  Gift, GraduationCap, HeartPulse, House, Info, Landmark, Languages, Layers, LayoutGrid, Map, MapPin, Pencil, PiggyBank,
  Plane, Plus, Receipt, RefreshCw, ScanLine, Search, Settings, Shirt, ShoppingCart, Smartphone, Sofa, Store, Upload, UserRound,
  Users, Utensils, Wallet, WashingMachine, X, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "arrow-left": ArrowLeft, "bed-double": BedDouble, bus: Bus, calendar: Calendar, "chart-pie": ChartPie,
  "chevron-down": ChevronDown, "chevron-right": ChevronRight, "circle-ellipsis": CircleEllipsis, "database-backup": DatabaseBackup,
  download: Download, gift: Gift, "graduation-cap": GraduationCap, "heart-pulse": HeartPulse, house: House, info: Info,
  landmark: Landmark, languages: Languages, layers: Layers, "layout-grid": LayoutGrid, map: Map, "map-pin": MapPin, pencil: Pencil,
  "piggy-bank": PiggyBank, plane: Plane, plus: Plus, receipt: Receipt, "refresh-cw": RefreshCw, "scan-line": ScanLine,
  search: Search, settings: Settings, shirt: Shirt, "shopping-cart": ShoppingCart, smartphone: Smartphone, sofa: Sofa,
  store: Store, upload: Upload, "user-round": UserRound, users: Users, utensils: Utensils, wallet: Wallet,
  "washing-machine": WashingMachine, x: X,
};

export function Icon({ name }: { name: string }) {
  const C = ICONS[name] ?? CircleEllipsis;
  return <C className="lucide" aria-hidden="true" />;
}
