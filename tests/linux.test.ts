import { describe, expect, it } from 'vitest'
import { autostartExecPath, desktopEntry, hideToTrayOnClose } from '../src/main/linux'

describe('autostartExecPath', () => {
  it('prefers the APPIMAGE path over the FUSE mount point', () => {
    expect(
      autostartExecPath(
        { APPIMAGE: '/home/u/Applications/Anshin.AppImage' },
        '/tmp/.mount_XYZ/anshin',
      ),
    ).toBe('/home/u/Applications/Anshin.AppImage')
  })

  it('falls back to the executable path outside AppImage', () => {
    expect(autostartExecPath({}, '/opt/Anshin/anshin')).toBe('/opt/Anshin/anshin')
  })
})

describe('desktopEntry', () => {
  it('renders an XDG autostart entry', () => {
    const entry = desktopEntry('Anshin', '/opt/Anshin/anshin')

    expect(entry).toContain('[Desktop Entry]')
    expect(entry).toContain('Type=Application')
    expect(entry).toContain('Name=Anshin')
    expect(entry).toContain('Terminal=false')
    expect(entry).toContain('Exec="/opt/Anshin/anshin"')
  })

  it('escapes reserved characters in the exec path', () => {
    const entry = desktopEntry('Anshin', '/opt/My "Anshin"\\App/app')

    expect(entry).toContain('Exec="/opt/My \\"Anshin\\"\\\\App/app"')
  })

  it('escapes dollar signs and backticks inside quotes', () => {
    const entry = desktopEntry('Anshin', '/home/u/my$app/`bin`/app')

    expect(entry).toContain('Exec="/home/u/my\\$app/\\`bin\\`/app"')
  })

  it('doubles percent signs so they are not read as field codes', () => {
    const entry = desktopEntry('Anshin', '/opt/100% done/app')

    expect(entry).toContain('Exec="/opt/100%% done/app"')
  })

  it('refuses control characters in the exec path', () => {
    expect(() => desktopEntry('Anshin', '/home/u/bad\npath/app')).toThrow()
  })
})

describe('hideToTrayOnClose', () => {
  it('keeps running in the tray on macOS and Windows', () => {
    expect(hideToTrayOnClose('darwin', 'GNOME')).toBe(true)
    expect(hideToTrayOnClose('win32', undefined)).toBe(true)
  })

  it('quits on desktops without a reliable tray', () => {
    expect(hideToTrayOnClose('linux', 'GNOME')).toBe(false)
    expect(hideToTrayOnClose('linux', 'ubuntu:GNOME')).toBe(false)
    expect(hideToTrayOnClose('linux', undefined)).toBe(false)
    expect(hideToTrayOnClose('linux', 'Pantheon')).toBe(false)
  })

  it('keeps running on desktops with a native tray', () => {
    expect(hideToTrayOnClose('linux', 'KDE')).toBe(true)
    expect(hideToTrayOnClose('linux', 'XFCE')).toBe(true)
    expect(hideToTrayOnClose('linux', 'X-Cinnamon')).toBe(true)
    expect(hideToTrayOnClose('linux', 'LXQt')).toBe(true)
    expect(hideToTrayOnClose('linux', 'Budgie:GNOME')).toBe(true)
    expect(hideToTrayOnClose('linux', 'Deepin')).toBe(true)
    expect(hideToTrayOnClose('linux', 'UKUI')).toBe(true)
    expect(hideToTrayOnClose('linux', 'Unity')).toBe(true)
  })
})
