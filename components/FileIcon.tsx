// components/FileIcon.tsx
import { IconType } from 'react-icons';
import {
  FaFile, FaFileImage, FaFilePdf, FaFileWord, FaFileExcel, FaFilePowerpoint,
  FaFileAudio, FaFileVideo, FaFileZipper, FaFolder, FaFileCode, FaDatabase,
  FaFont, FaCompactDisc, FaGear, FaVectorSquare, FaFileLines, FaAppStoreIos, // <-- Thêm icon mới
  FaWindows, FaLinux, FaApple, FaAndroid, FaJava, FaPython, FaSquare, FaHtml5, FaCss3Alt, FaMarkdown, FaDocker, FaGitAlt
} from 'react-icons/fa6';
interface FileIconProps {
  fileName: string;
  isFolder?: boolean;
  className?: string;
}

const FileIcon: React.FC<FileIconProps> = ({ fileName, isFolder = false, className = "w-6 h-6" }) => {
  if (isFolder) {
    return <FaFolder className={`text-yellow-500 ${className}`} />;
  }
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === 0 || lastDotIndex === fileName.length - 1) {
    // Nếu không có dấu chấm, hoặc dấu chấm ở đầu, hoặc dấu chấm ở cuối -> dùng icon file mặc định
    return <FaFile className={`text-gray-500 dark:text-gray-400 ${className}`} />;
  }
  const extension = fileName.slice(lastDotIndex + 1).toLowerCase();

  let IconComponent: IconType = FaFile; // Icon mặc định

  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tif', 'tiff'].includes(extension)) {
    IconComponent = FaFileImage;
  } else if (extension === 'ai' || extension === 'eps') { // Adobe Illustrator / Vector
    IconComponent = FaVectorSquare;
  } else if (extension === 'psd') { // Adobe Photoshop
    // Có thể dùng FaImage hoặc một icon design khác nếu muốn phân biệt rõ hơn
    IconComponent = FaFileImage; // Giữ FaFileImage cho đơn giản, hoặc đổi thành FaPaintBrush, FaPalette...
  } else if (extension === 'pdf') {
    IconComponent = FaFilePdf;
  } else if (['doc', 'docx'].includes(extension)) {
    IconComponent = FaFileWord;
  } else if (['xls', 'xlsx'].includes(extension)) {
    IconComponent = FaFileExcel;
  } else if (['ppt', 'pptx'].includes(extension)) {
    IconComponent = FaFilePowerpoint;
  } else if (extension === 'txt' || extension === 'md') { // Text và Markdown
    IconComponent = FaFileLines; // Hoặc dùng FaMarkdown nếu muốn icon riêng
  } else if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(extension)) {
    IconComponent = FaFileAudio;
  } else if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'mpg', 'mpeg'].includes(extension)) {
    IconComponent = FaFileVideo;
  } else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(extension)) {
    IconComponent = FaFileZipper;
  }
  // 5. Font chữ
  else if (['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(extension)) {
    IconComponent = FaFont;
  } else if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'php', 'rb'].includes(extension)) {
    IconComponent = FaFileCode;
  } else if (['sql', 'db', 'sqlite', 'mdb', 'accdb'].includes(extension)) {
    IconComponent = FaDatabase;
  }
  // 7. Disk Images & Máy ảo
  else if (['iso', 'img', 'vhd', 'vmdk', 'vdi', 'ova', 'dmg'].includes(extension)) {
    IconComponent = FaCompactDisc; // Dùng icon CD/DVD ẩn dụ cho disk image
    if (extension === 'dmg' || extension === 'app') IconComponent = FaApple; // Cụ thể hơn cho macOS
  }// 8. File thực thi & Cài đặt (Executable & Setup)
  else if (extension === 'exe' || extension === 'msi' || extension === 'msu') { // Windows
    IconComponent = FaWindows;
  } else if (extension === 'apk') { // Android Package
    IconComponent = FaAndroid; // Hoặc dùng FaAppStoreIos nếu muốn chung chung hơn
  } else if (extension === 'jar') { // Java Archive
    IconComponent = FaJava; // Cần import FaJava từ react-icons/fa6 hoặc fa
  } else if (extension === 'deb' || extension === 'rpm' || extension === 'sh' || extension === 'run') { // Linux
    IconComponent = FaLinux;
  } else if (extension === 'app' || extension === 'pkg') { // macOS (app đã có ở trên)
    IconComponent = FaApple;
  } else if (extension === 'ipa') { // iOS Package
    IconComponent = FaAppStoreIos; // Hoặc FaApple
  }
 // 9. Code & Script & Config
 else if (extension === 'js' || extension === 'jsx' || extension === 'mjs' ) { // Javascript
     IconComponent = FaSquare; // Cần import FaJsSquare từ react-icons/fa6 hoặc fa
 } else if (extension === 'ts' || extension === 'tsx') { // Typescript
     IconComponent = FaFileCode; // Chưa có icon TS riêng biệt phổ biến trong Fa6, dùng code chung
 } else if (extension === 'py' || extension === 'pyc') { // Python
     IconComponent = FaPython; // Cần import FaPython từ react-icons/fa6 hoặc fa
 } else if (extension === 'java') { // Java source
     IconComponent = FaJava;
 } else if (extension === 'html' || extension === 'htm') { // HTML
     IconComponent = FaHtml5; // Cần import FaHtml5 từ react-icons/fa6 hoặc fa
 } else if (extension === 'css' || extension === 'scss' || extension === 'sass' || extension === 'less') { // CSS
     IconComponent = FaCss3Alt; // Cần import FaCss3Alt từ react-icons/fa6 hoặc fa
 } else if (extension === 'json') { // JSON
     IconComponent = FaFileCode; // Dùng code chung
 } else if (extension === 'xml') { // XML
     IconComponent = FaFileCode; // Dùng code chung
 } else if (['c', 'cpp', 'h', 'hpp'].includes(extension)) { // C/C++
     IconComponent = FaFileCode; // Dùng code chung
 } else if (extension === 'cs') { // C#
     IconComponent = FaFileCode; // Dùng code chung
 } else if (['rb', 'ruby'].includes(extension)) { // Ruby
     IconComponent = FaFileCode; // Dùng code chung
 } else if (['php'].includes(extension)) { // PHP
     IconComponent = FaFileCode; // Dùng code chung
 } else if (extension === 'swift') { // Swift
     IconComponent = FaApple; // Liên quan đến Apple
 } else if (extension === 'kt' || extension === 'kts') { // Kotlin
     IconComponent = FaFileCode; // Dùng code chung, liên quan Android/Java
 } else if (['sh', 'bash', 'zsh'].includes(extension)) { // Shell script (đã có FaLinux ở trên, nhưng có thể để đây)
     IconComponent = FaFileCode;
 } else if (extension === 'ps1') { // Powershell
     IconComponent = FaWindows; // Liên quan đến Windows
 } else if (['bat', 'cmd'].includes(extension)) { // Windows Batch
     IconComponent = FaWindows;
 } else if (['ini', 'cfg', 'conf', 'yml', 'yaml', 'toml', 'env'].includes(extension)) { // Config files
     IconComponent = FaGear;
 } else if (extension === 'log') { // Log files
     IconComponent = FaFileLines;
 } else if (extension === 'gitignore') { // Git ignore
     IconComponent = FaGitAlt; // Cần import FaGitAlt từ react-icons/fa6 hoặc fa
 } else if (extension === 'dockerfile' || extension === 'dockerignore') { // Docker
     IconComponent = FaDocker; // Cần import FaDocker từ react-icons/fa6 hoặc fa
 }


  return <IconComponent className={`text-gray-500 dark:text-gray-400 ${className}`} />;
};

export default FileIcon;