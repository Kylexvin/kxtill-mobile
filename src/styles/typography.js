// src/styles/typography.js
//
// Text styles carry size, weight, line height and tracking only.
// Colour is always applied by the screen so themes stay in one place.

export const typography = {
  // Big hero line (login-style headline)
  display: {
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: -1.4,
  },

  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  h2: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },

  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  // Small uppercase kickers and section labels. Write the text in caps;
  // add letterSpacing at the call site where a wider tracking is wanted.
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  button: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  // Large numbers (sales totals, counts)
  figure: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
};