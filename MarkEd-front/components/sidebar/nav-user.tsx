'use client'

import { EllipsisVertical, LogOut } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useUser } from '@/src/contexts/user-context'
import { UserAvatar } from '@/components/user-avatar'
import { DefaultService } from '@/src/api'
import { clearToken } from '@/src/api/config'

export function NavUser() {
  const { isMobile } = useSidebar()
  const { user } = useUser()

  const logout = async () => {
    // Revoke the token server-side, then drop it locally and return to login.
    try {
      await DefaultService.apiLogout()
    } catch {
      // Even if the revoke call fails, clear the local token so the browser
      // is signed out.
    }
    clearToken()
    window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/login`
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              {user && <UserAvatar user={user} />}
              <EllipsisVertical className='ml-auto size-4' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg'
            side={isMobile ? 'bottom' : 'right'}
            align='end'
            sideOffset={4}
          >
            <DropdownMenuItem onClick={logout} className='cursor-pointer'>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
