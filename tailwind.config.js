/**
 * TailwindCSS Configuration File
 *
 * Docs: https://tailwindcss.com/docs/configuration
 * Default: https://github.com/tailwindcss/tailwindcss/blob/master/stubs/defaultConfig.stub.js
 */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        '3xl': '1920px',
      },
      spacing: {
        72: '18rem',
        84: '21rem',
        96: '24rem',
      },
      zIndex: {
        '-1': '-1',
      },
      rotate: {
        24: '24deg',
        '-24': '-24deg',
      },
    },
  },
  variants: {
    borderWidth: ['responsive', 'hover', 'focus', 'dark'],
  },
  plugins: [
    // https://github.com/tailwindlabs/tailwindcss-typography#usage
    require('@tailwindcss/typography'),
  ],
  purge: {
    // Learn more on https://tailwindcss.com/docs/controlling-file-size/#removing-unused-css
    enabled: process.env.NODE_ENV === 'production',
    content: [
      './index.html',
      './packages/**/*.css',
      './packages/**/*.js',
      './packages/**/*.ts',
      './packages/**/*.jsx',
      './packages/**/*.tsx',
      './packages/**/*.vue',
    ],
  },
}
