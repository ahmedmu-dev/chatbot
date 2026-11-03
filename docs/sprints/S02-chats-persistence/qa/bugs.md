# Bugs

## BUG-1  Severity: Low  Type: test gap
AC: AC-12 / AC-6 (drawer config)  Commit: 68d0f23  Found by: Jest review
Missing: no Jest test for src/app/_layout.tsx Drawer config (drawerType front, swipeEnabled, width min(85%, 320), drawerContent wired). Feasible by mocking `expo-router/drawer` and asserting props. Android back closing the drawer comes from react-navigation; verified on device only.
Status: open
