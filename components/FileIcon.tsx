// components/FileIcon.tsx
import { IconType } from 'react-icons';
import {
  FaFile,
  FaFileImage,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFilePowerpoint,
  FaFileAudio,
  FaFileVideo,
  FaFileZipper,
  FaFolder,
  FaFileCode,
  FaDatabase,
  FaFont,
  FaCompactDisc,
  FaGear,
  FaVectorSquare,
  FaFileLines,
  FaFileCsv,
  FaWindows,
  FaLinux,
  FaApple,
  FaAndroid,
  FaJava,
  FaPython,
  FaHtml5,
  FaCss3Alt,
  FaDocker,
  FaGitAlt,
} from 'react-icons/fa6';

interface FileIconProps {
  fileName: string;
  isFolder?: boolean;
  className?: string;
}

const FileIcon: React.FC<FileIconProps> = ({ fileName, isFolder = false, className = 'w-6 h-6' }) => {
  if (isFolder) {
    return <FaFolder className={`text-amber-400 ${className}`} />;
  }

  const lower = fileName.toLowerCase();
  if (lower === 'dockerfile' || lower.endsWith('.dockerfile')) {
    return <FaDocker className={`text-sky-500 ${className}`} />;
  }
  if (lower === '.gitignore') {
    return <FaGitAlt className={`text-orange-600 ${className}`} />;
  }

  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    return <FaFile className={`text-gray-400 dark:text-gray-500 ${className}`} />;
  }

  const ext = fileName.slice(lastDotIndex + 1).toLowerCase();
  let IconComponent: IconType = FaFile;
  let colorClass = 'text-gray-500 dark:text-gray-400';

  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tif', 'tiff', 'psd'].includes(ext)) {
    IconComponent = FaFileImage;
    colorClass = 'text-sky-500';
  } else if (['ai', 'eps'].includes(ext)) {
    IconComponent = FaVectorSquare;
    colorClass = 'text-orange-500';
  } else if (ext === 'pdf') {
    IconComponent = FaFilePdf;
    colorClass = 'text-red-500';
  } else if (['doc', 'docx'].includes(ext)) {
    IconComponent = FaFileWord;
    colorClass = 'text-blue-600';
  } else if (ext === 'csv' || ext === 'tsv') {
    IconComponent = FaFileCsv;
    colorClass = 'text-emerald-600';
  } else if (['xls', 'xlsx'].includes(ext)) {
    IconComponent = FaFileExcel;
    colorClass = 'text-emerald-600';
  } else if (['ppt', 'pptx'].includes(ext)) {
    IconComponent = FaFilePowerpoint;
    colorClass = 'text-orange-500';
  } else if (['txt', 'md', 'markdown', 'log'].includes(ext)) {
    IconComponent = FaFileLines;
    colorClass = 'text-slate-500 dark:text-slate-300';
  } else if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(ext)) {
    IconComponent = FaFileAudio;
    colorClass = 'text-emerald-500';
  } else if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'mpg', 'mpeg', '3gp'].includes(ext)) {
    IconComponent = FaFileVideo;
    colorClass = 'text-rose-500';
  } else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
    IconComponent = FaFileZipper;
    colorClass = 'text-amber-600';
  } else if (['py', 'pyc'].includes(ext)) {
    IconComponent = FaPython;
    colorClass = 'text-yellow-500';
  } else if (['java', 'jar'].includes(ext)) {
    IconComponent = FaJava;
    colorClass = 'text-red-600';
  } else if (['html', 'htm'].includes(ext)) {
    IconComponent = FaHtml5;
    colorClass = 'text-orange-600';
  } else if (['css', 'scss', 'sass', 'less'].includes(ext)) {
    IconComponent = FaCss3Alt;
    colorClass = 'text-blue-500';
  } else if (['js', 'jsx', 'mjs', 'ts', 'tsx', 'json', 'xml', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'php', 'rb', 'rs', 'kt'].includes(ext)) {
    IconComponent = FaFileCode;
    colorClass = 'text-indigo-500';
  } else if (['sql', 'db', 'sqlite', 'mdb', 'accdb'].includes(ext)) {
    IconComponent = FaDatabase;
    colorClass = 'text-cyan-600';
  } else if (['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(ext)) {
    IconComponent = FaFont;
    colorClass = 'text-purple-500';
  } else if (['iso', 'img', 'vhd', 'vmdk', 'vdi', 'ova'].includes(ext)) {
    IconComponent = FaCompactDisc;
    colorClass = 'text-zinc-500';
  } else if (['exe', 'msi', 'msu', 'bat', 'cmd', 'ps1'].includes(ext)) {
    IconComponent = FaWindows;
    colorClass = 'text-blue-500';
  } else if (ext === 'apk') {
    IconComponent = FaAndroid;
    colorClass = 'text-green-500';
  } else if (['deb', 'rpm', 'sh', 'bash', 'run'].includes(ext)) {
    IconComponent = FaLinux;
    colorClass = 'text-amber-600';
  } else if (['dmg', 'app', 'pkg', 'ipa', 'swift'].includes(ext)) {
    IconComponent = FaApple;
    colorClass = 'text-zinc-700 dark:text-zinc-200';
  } else if (['ini', 'cfg', 'conf', 'yml', 'yaml', 'toml', 'env'].includes(ext)) {
    IconComponent = FaGear;
    colorClass = 'text-gray-500';
  }

  return <IconComponent className={`${colorClass} ${className}`} />;
};

export default FileIcon;
