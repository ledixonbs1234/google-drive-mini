// tailwind.config.js hoặc tailwind.config.ts
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./app/**/*.{js,ts,jsx,tsx,mdx}",
      "./pages/**/*.{js,ts,jsx,tsx,mdx}", // Giữ lại nếu có page cũ
      "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: 'class', // Kích hoạt dark mode dựa trên class 'dark' ở thẻ html
    theme: {
      extend: {
        // Mở rộng theme nếu cần
      },
    },
    plugins: [
      // require('@tailwindcss/forms'), // Có thể cần nếu dùng nhiều form
    ],
  };