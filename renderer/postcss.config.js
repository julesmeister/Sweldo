module.exports = {
  plugins: {
    tailwindcss: {
      config:
        process.env.npm_lifecycle_event === "build:web"
          ? "./tailwind.config.js" // For web builds (npm run build:web)
          : "./renderer/tailwind.config.js", // For Nextron builds (npm run dev, npm run build)
    },
    autoprefixer: {},
  },
};
