import { useEffect, useCallback } from 'react'

type ShortcutKey = {
  key: string
  cmd?: boolean // for ⌘ or Ctrl
  shift?: boolean
  alt?: boolean
}

export function useKeyboardShortcut(
  shortcut: ShortcutKey | ShortcutKey[],
  callback: () => void,
  enabled = true
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const shortcuts = Array.isArray(shortcut) ? shortcut : [shortcut]

      const matchesShortcut = shortcuts.some((sc) => {
        const cmdMatch = sc.cmd
          ? event.metaKey || event.ctrlKey
          : !event.metaKey && !event.ctrlKey
        const shiftMatch = sc.shift ? event.shiftKey : !event.shiftKey
        const altMatch = sc.alt ? event.altKey : !event.altKey
        const keyMatch = event.key.toLowerCase() === sc.key.toLowerCase()

        return cmdMatch && shiftMatch && altMatch && keyMatch
      })

      if (matchesShortcut) {
        event.preventDefault()
        callback()
      }
    },
    [shortcut, callback]
  )

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, handleKeyDown])
}

// Component for displaying keyboard shortcuts
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className='pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground'>
      {children}
    </kbd>
  )
}

// Displaying command key based on OS
export function CommandKey() {
  const isMac =
    typeof window !== 'undefined' &&
    navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return <span className='text-xs'>{isMac ? '⌘' : 'Ctrl'}</span>
}

export function ShortcutKeys({ shortcut }: { shortcut: ShortcutKey }) {
  return (
    <div className='flex items-center gap-1'>
      {shortcut.cmd && (
        <>
          <Kbd>
            <CommandKey />
          </Kbd>
          <span className='text-xs'>+</span>
        </>
      )}
      {shortcut.shift && (
        <>
          <Kbd>Shift</Kbd>
          <span className='text-xs'>+</span>
        </>
      )}
      {shortcut.alt && (
        <>
          <Kbd>Alt</Kbd>
          <span className='text-xs'>+</span>
        </>
      )}
      <Kbd>{shortcut.key}</Kbd>
    </div>
  )
}
