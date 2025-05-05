// TypeScript declaration file for CSS modules
declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}

// Allow global CSS imports with absolute and @/ paths
declare module "/resources/fonts.css";
declare module "/resources/globals.css";
declare module "@/resources/fonts.css";
declare module "@/resources/globals.css";
