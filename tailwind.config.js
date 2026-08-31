/** @type {import('tailwindcss').Config} */

// The `brand` palette and the two font families exist for the landing page
// only (src/components/landing/*). The product itself keeps the colours it
// has always had — hardcoded per component — so adding tokens here changes
// nothing that already renders; it just stops the marketing page from
// repeating nine hex values in nine files.
//
// `blue` is sampled straight out of the logo's own ground (public/logo.png),
// so the mark never sits on a colour that is merely close to its background.
// `amber` replaced a yellow-green that fought both the blue and the white
// wordmark; gold against blue is the pairing the product's own coin already
// uses, and it stays readable as a fill under dark text and as text on dark.
//
// Onest and Inter are both loaded from Google Fonts in index.html and both
// carry the Cyrillic-Extended subset, which is what ө / ү / ң need. The
// system stack behind each one is the fallback that renders while the web
// font is still in flight.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}', './admin-src/index.html', './admin-src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#0147EE',        // the logo's ground — navbar, hero, CTAs
          'blue-deep': '#0B2AA8', // gradient end under the hero
          amber: '#FFC53D',       // accent: buttons, ribbon, numbers
          'amber-dim': '#E8A81F', // the same amber pressed/hovered
          mint: '#24E6A4',        // the third colour — badges, quote marks
          ink: '#050B1F',         // blue-black ground the glass floats on
          paper: '#FFFFFF',
        },
      },
      fontFamily: {
        display: ['Onest', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        body: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
