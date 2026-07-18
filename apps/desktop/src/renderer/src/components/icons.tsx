import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faAnglesLeft,
  faAnglesRight,
  faArrowLeft,
  faArrowsRotate,
  faArrowUpRightFromSquare,
  faBell,
  faCalendarDays,
  faCheck,
  faCircleCheck,
  faCircleHalfStroke,
  faCircleQuestion,
  faClock,
  faClockRotateLeft,
  faCloudArrowDown,
  faCopy,
  faDisplay,
  faDownload,
  faEye,
  faFile,
  faFloppyDisk,
  faFolder,
  faFolderOpen,
  faFolderPlus,
  faFolderTree,
  faGaugeHigh,
  faGear,
  faGlobe,
  faHardDrive,
  faLanguage,
  faMagnifyingGlass,
  faMemory,
  faMicrochip,
  faMoon,
  faNetworkWired,
  faPaperPlane,
  faPen,
  faPlay,
  faPlug,
  faPlus,
  faRobot,
  faSatelliteDish,
  faSort,
  faSun,
  faTableColumns,
  faTag,
  faTerminal,
  faTrashCan,
  faTriangleExclamation,
  faCubes,
  faWandMagic,
  faWandMagicSparkles,
  faWindowMaximize,
  faWindowMinimize,
  faWindowRestore,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

export interface IconProps {
  className?: string;
  onClick?: React.MouseEventHandler<SVGSVGElement>;
}

function makeIcon(icon: IconDefinition): React.ForwardRefExoticComponent<IconProps> {
  const Icon = React.forwardRef<SVGSVGElement, IconProps>(({ className, ...props }, ref) => (
    <FontAwesomeIcon icon={icon} className={className} ref={ref} {...props} />
  ));
  Icon.displayName = `Icon(${icon.iconName})`;
  return Icon;
}

// Names mirror the lucide-react icons they replace so call sites didn't need
// to change, only their import path.
export const ArrowLeft = makeIcon(faArrowLeft);
export const Blocks = makeIcon(faCubes);
export const Check = makeIcon(faCheck);
export const ChevronsUpDown = makeIcon(faSort);
export const Copy = makeIcon(faCopy);
export const Download = makeIcon(faDownload);
export const Eye = makeIcon(faEye);
export const ExternalLink = makeIcon(faArrowUpRightFromSquare);
export const File = makeIcon(faFile);
export const FileCog = makeIcon(faGear);
export const Folder = makeIcon(faFolder);
export const FolderKanban = makeIcon(faTableColumns);
export const FolderOpen = makeIcon(faFolderOpen);
export const FolderPlus = makeIcon(faFolderPlus);
export const FolderTree = makeIcon(faFolderTree);
export const Globe = makeIcon(faGlobe);
export const LayoutDashboard = makeIcon(faGaugeHigh);
export const Monitor = makeIcon(faDisplay);
export const Moon = makeIcon(faMoon);
export const Pencil = makeIcon(faPen);
export const Plus = makeIcon(faPlus);
export const RefreshCw = makeIcon(faArrowsRotate);
export const Save = makeIcon(faFloppyDisk);
export const Search = makeIcon(faMagnifyingGlass);
export const SettingsIcon = makeIcon(faGear);
export const Sparkles = makeIcon(faWandMagicSparkles);
export const Sun = makeIcon(faSun);
export const SunMoon = makeIcon(faCircleHalfStroke);
export const Tag = makeIcon(faTag);
export const TerminalSquare = makeIcon(faTerminal);
export const Trash2 = makeIcon(faTrashCan);
export const Wand2 = makeIcon(faWandMagic);
export const X = makeIcon(faXmark);

// New icons for this pass of work.
export const AnglesLeft = makeIcon(faAnglesLeft);
export const AnglesRight = makeIcon(faAnglesRight);
export const Languages = makeIcon(faLanguage);
export const History = makeIcon(faClockRotateLeft);
export const WindowMinimize = makeIcon(faWindowMinimize);
export const WindowMaximize = makeIcon(faWindowMaximize);
export const WindowRestore = makeIcon(faWindowRestore);

// System monitor icons.
export const Cpu = makeIcon(faMicrochip);
export const MemoryStick = makeIcon(faMemory);
export const NetworkIcon = makeIcon(faNetworkWired);
export const SatelliteDish = makeIcon(faSatelliteDish);
export const HardDrive = makeIcon(faHardDrive);
export const Gpu = makeIcon(faDisplay);

// CLI manager icons.
export const CloudDownload = makeIcon(faCloudArrowDown);

// Prompt scheduling icons.
export const CalendarDays = makeIcon(faCalendarDays);
export const Clock = makeIcon(faClock);
export const Play = makeIcon(faPlay);

// Notification hook icons.
export const Bell = makeIcon(faBell);
export const Send = makeIcon(faPaperPlane);
export const CircleCheck = makeIcon(faCircleCheck);
export const CircleQuestion = makeIcon(faCircleQuestion);
export const Robot = makeIcon(faRobot);
export const TriangleAlert = makeIcon(faTriangleExclamation);

// MCP marketplace icons.
export const Plug = makeIcon(faPlug);
