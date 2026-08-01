import { alpha, createTheme } from '@mui/material/styles'

const accent = '#1b3b5f'
const darkBaseBg = '#0a0c10'
const darkPaperBg = '#151922'
const lightBaseBg = '#ffffff'
const lightPaperBg = '#ffffff'

export const createAppTheme = (mode: 'light' | 'dark') => {
  const isLight = mode === 'light'
  const baseBg = isLight ? lightBaseBg : darkBaseBg
  const paperBg = isLight ? lightPaperBg : darkPaperBg
  const primaryMain = isLight ? accent : '#7fa6d8'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: primaryMain,
      },
      background: {
        default: baseBg,
        paper: paperBg,
      },
      text: {
        primary: isLight ? '#171715' : '#eef2f6',
        secondary: isLight ? '#5c5f5a' : '#a9b3c1',
      },
      divider: isLight ? alpha('#1f1e1b', 0.18) : alpha('#ffffff', 0.2),
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily:
        '"Montserrat", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      h1: { fontWeight: 600, letterSpacing: 0 },
      h2: { fontWeight: 600, letterSpacing: 0 },
      h3: { fontWeight: 600, letterSpacing: 0 },
      h4: { fontWeight: 600, letterSpacing: 0 },
      h5: { fontWeight: 600, letterSpacing: 0 },
      h6: { fontWeight: 600, letterSpacing: 0 },
      subtitle1: { fontWeight: 600, letterSpacing: 0 },
      subtitle2: { fontWeight: 600, letterSpacing: 0 },
      body1: { letterSpacing: 0 },
      body2: { letterSpacing: 0 },
      caption: { letterSpacing: 0 },
      overline: { letterSpacing: 0 },
      button: { fontWeight: 600, letterSpacing: 0 },
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isLight ? accent : '#111621',
            color: isLight ? '#ffffff' : '#eef2f6',
            backdropFilter: 'blur(14px)',
            borderBottom: 'none',
            border: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: alpha(baseBg, isLight ? 0.96 : 0.92),
            borderRight: `1px solid ${alpha(isLight ? '#1f1e1b' : '#ffffff', 0.2)}`,
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          outlined: {
            borderColor: alpha(isLight ? '#1f1e1b' : '#ffffff', isLight ? 0.2 : 0.22),
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
          },
          outlined: {
            backgroundColor: 'transparent',
          },
        },
      },
    },
  })
}

export const appBackgroundStyles = (mode: 'light' | 'dark') => {
  const isLight = mode === 'light'
  return {
    html: {
      fontSynthesis: 'none',
      textRendering: 'optimizeLegibility',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    },
    body: {
      margin: 0,
      minWidth: 320,
      minHeight: '100vh',
      backgroundColor: isLight ? lightBaseBg : darkBaseBg,
      backgroundImage: 'none',
    },
    '#root': {
      minHeight: '100vh',
    },
    '*': {
      boxSizing: 'border-box',
    },
    a: {
      color: 'inherit',
      textDecoration: 'none',
    },
  }
}
