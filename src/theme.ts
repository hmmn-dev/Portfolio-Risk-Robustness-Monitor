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
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${alpha(isLight ? '#1f1e1b' : '#ffffff', isLight ? 0.2 : 0.22)}`,
            boxShadow: 'none',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            backgroundColor: alpha(accent, isLight ? 0.12 : 0.15),
            border: `1px solid ${alpha(accent, isLight ? 0.3 : 0.35)}`,
          },
          outlined: {
            backgroundColor: isLight ? '#ffffff' : '#000000',
            borderColor: alpha(isLight ? '#1f1e1b' : '#ffffff', isLight ? 0.3 : 0.6),
          },
          deleteIcon: {
            color: alpha(isLight ? '#1f1e1b' : '#ffffff', isLight ? 0.7 : 0.7),
            '&:hover': {
              color: isLight ? '#1f1e1b' : '#ffffff',
            },
          },
        },
      },
    },
  })
}

export const appBackgroundStyles = (mode: 'light' | 'dark') => {
  const isLight = mode === 'light'
  return {
    body: {
      margin: 0,
      minHeight: '100vh',
      backgroundColor: isLight ? lightBaseBg : darkBaseBg,
      backgroundImage: 'none',
      backgroundSize: 'auto',
      backgroundPosition: '0 0, 0 0, 0 0, 0 0',
    },
    '#root': {
      minHeight: '100vh',
    },
    '*': {
      boxSizing: 'border-box',
    },
  }
}
