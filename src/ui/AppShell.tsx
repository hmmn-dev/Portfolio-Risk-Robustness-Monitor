import {
  AppBar,
  Box,
  IconButton,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useUIStore } from '../store/ui'
import appLogo from '../assets/brand-mark.png'

type AppShellProps = {
  children: ReactNode
}

const AppShell = ({ children }: AppShellProps) => {
  const theme = useTheme()
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'))
  const toolbarHeight = isMdUp ? 64 : 56
  const mainPaddingY = isMdUp ? 32 : 24
  const mainContentHeight = `calc(100dvh - ${toolbarHeight}px - ${mainPaddingY * 2}px)`
  const colorMode = useUIStore((state) => state.colorMode)
  const toggleColorMode = useUIStore((state) => state.toggleColorMode)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 4)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{ boxShadow: isScrolled ? theme.shadows[3] : 'none' }}
      >
        <Toolbar
          sx={{
            gap: 2,
            px: { xs: 2.5, md: 4 },
            minHeight: { xs: 48, md: 48 },
          }}
        >
          <Box
            component="img"
            src={appLogo}
            alt="Portfolio Monitoring logo"
            sx={{
              display: 'block',
              flexShrink: 0,
              width: { xs: 30, md: 32 },
              height: { xs: 30, md: 32 },
            }}
          />
          <Typography variant="h6">Portfolio Monitoring Tool</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton color="inherit" onClick={toggleColorMode} aria-label="Toggle color mode">
            {colorMode === 'light' ? <DarkModeOutlinedIcon /> : <LightModeOutlinedIcon />}
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box
        component="main"
        sx={{
          px: { xs: 2.5, md: 4 },
          pt: { xs: 3, md: 4 },
          pb: {
            xs: 'var(--main-padding-bottom-xs, 24px)',
            md: 'var(--main-padding-bottom-md, 32px)',
          },
          '--main-content-height': mainContentHeight,
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default AppShell
