// Node ambient declarations for Null-Gym scripts
declare var __dirname: string;
declare var process: any;

declare module 'fs' {
  const fs: any;
  export default fs;
  export = fs;
}

declare module 'path' {
  const path: any;
  export default path;
  export = path;
}
