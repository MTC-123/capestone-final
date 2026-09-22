import * as React from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Camera,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Cloud,
  Compass,
  Database,
  Download,
  Droplets,
  ExternalLink,
  Eye,
  Flame,
  IdCard,
  Image,
  Info,
  KeyRound,
  Leaf,
  Loader2,
  LogOut,
  Map,
  MapPin,
  Megaphone,
  Menu,
  Moon,
  MoreHorizontal,
  Navigation,
  Pencil,
  Pin,
  Phone,
  RefreshCw,
  Route,
  Search,
  Send,
  Share2,
  Shield,
  Siren,
  Sun,
  Thermometer,
  Timer,
  Trash2,
  TrendingUp,
  Truck,
  Users,
  Waves,
  Wind,
  Mountain,
  Wrench,
  X,
  Layers,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/cn';

export type IconName =
  | 'search'
  | 'map'
  | 'analytics'
  | 'campaign'
  | 'list'
  | 'truck'
  | 'fire'
  | 'notifications'
  | 'logout'
  | 'close'
  | 'refresh'
  | 'warning'
  | 'thermostat'
  | 'air'
  | 'share'
  | 'open'
  | 'pin'
  | 'clipboard'
  | 'siren'
  | 'compass'
  | 'calendar'
  | 'id'
  | 'phone'
  | 'key'
  | 'moon'
  | 'sun'
  | 'loading'
  | 'route'
  | 'send'
  | 'cached'
  | 'check'
  | 'info'
  | 'database'
  | 'download'
  | 'more_horiz'
  | 'camera'
  | 'image'
  | 'navigation'
  | 'check-circle'
  | 'trash'
  | 'menu'
  | 'chevronUp'
  | 'chevronDown'
  | 'droplet'
  | 'eye'
  | 'leaf'
  | 'shield'
  | 'timer'
  | 'trending_up'
  | 'users'
  | 'waves'
  | 'wrench'
  | 'cloud'
  | 'mountain'
  | 'layers'
  | 'plus'
  | 'pencil'
  | 'mapPin'
  | 'chevronRight';

export type IconProps = {
  name: IconName;
  className?: string;
  size?: number;
  'aria-hidden'?: boolean;
  title?: string;
};

export function Icon({ name, className, size = 20, title, ...props }: IconProps) {
  const IconComponent =
    name === 'search'
      ? Search
      : name === 'map'
        ? Map
        : name === 'analytics'
          ? BarChart3
          : name === 'campaign'
            ? Megaphone
            : name === 'list'
              ? ClipboardList
              : name === 'truck'
                ? Truck
                : name === 'fire'
                  ? Flame
                  : name === 'notifications'
                    ? Bell
                    : name === 'logout'
                      ? LogOut
                      : name === 'close'
                        ? X
                        : name === 'refresh'
                          ? RefreshCw
                          : name === 'warning'
                            ? AlertTriangle
                            : name === 'thermostat'
                              ? Thermometer
                              : name === 'air'
                                ? Wind
                                : name === 'share'
                                  ? Share2
                                  : name === 'open'
                                    ? ExternalLink
                                    : name === 'pin'
                                      ? Pin
                                      : name === 'clipboard'
                                        ? ClipboardList
                                        : name === 'siren'
                                          ? Siren
                                          : name === 'calendar'
                                            ? CalendarDays
                                            : name === 'id'
                                              ? IdCard
                                              : name === 'phone'
                                                ? Phone
                                                : name === 'key'
                                                  ? KeyRound
                                                  : name === 'moon'
                                                    ? Moon
                                                    : name === 'sun'
                                                      ? Sun
                                                      : name === 'loading'
                                                        ? Loader2
                                                        : name === 'route'
                                                          ? Route
                                                          : name === 'send'
                                                            ? Send
                                                            : name === 'cached'
                                                              ? Database
                                                              : name === 'check'
                                                                ? CheckCircle2
                                                                : name === 'info'
                                                                  ? Info
                                                                  : name === 'database'
                                                                    ? Database
                                                                    : name === 'download'
                                                                      ? Download
                                                                      : name === 'more_horiz'
                                                                        ? MoreHorizontal
                                                                      : name === 'camera'
                                                                        ? Camera
                                                                        : name === 'image'
                                                                          ? Image
                                                                          : name === 'navigation'
                                                                            ? Navigation
                                                                            : name === 'check-circle'
                                                                              ? CheckCircle2
                                                                              : name === 'trash'
                                                                                ? Trash2
                                                                                : name === 'menu'
                                                                                  ? Menu
                                                                                  : name === 'chevronUp'
                                                                                    ? ChevronUp
                                                                                    : name === 'chevronDown'
                                                                                      ? ChevronDown
                                                                                      : name === 'droplet'
                                                                                        ? Droplets
                                                                                        : name === 'eye'
                                                                                          ? Eye
                                                                                          : name === 'leaf'
                                                                                            ? Leaf
                                                                                            : name === 'shield'
                                                                                              ? Shield
                                                                                              : name === 'timer'
                                                                                                ? Timer
                                                                                                : name === 'trending_up'
                                                                                                  ? TrendingUp
                                                                                                  : name === 'users'
                                                                                                    ? Users
                                                                                                    : name === 'waves'
                                                                                                      ? Waves
                                                                                                      : name === 'wrench'
                                                                                                        ? Wrench
                                                                                                        : name === 'cloud'
                                                                                                          ? Cloud
                                                                                                          : name === 'mountain'
                                                                                                            ? Mountain
                                                                                                            : name === 'layers'
                                                                                                              ? Layers
                                                                                                              : name === 'plus'
                                                                                                                ? Plus
                                                                                                                : name === 'pencil'
                                                                                                                  ? Pencil
                                                                                                                  : name === 'mapPin'
                                                                                                                    ? MapPin
                                                                                                                    : name === 'chevronRight'
                                                                                                                      ? ChevronRight
                                                                                                                      : Compass;

  return (
    <IconComponent
      size={size}
      className={cn('shrink-0', className)}
      aria-hidden={props['aria-hidden']}
    >
      {title ? <title>{title}</title> : null}
    </IconComponent>
  );
}
