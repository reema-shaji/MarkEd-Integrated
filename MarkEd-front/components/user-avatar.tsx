'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface User {
  userName: string
  userNumber: string
  role: string
}

interface UserAvatarProps {
  user: User
  size?: 'sm' | 'md' | 'lg'
  showInfo?: boolean
}

export function UserAvatar({
  user,
  size = 'md',
  showInfo = true,
}: UserAvatarProps) {
  const SHORT_ROLE_TO_LONG_ROLE = {
    S: 'Student',
    T: 'TA',
    M: 'Marker',
    A: 'Academic',
  }

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  }

  return (
    <div className='flex items-center gap-2'>
      <Avatar className={`${sizeClasses[size]} rounded-lg`}>
        <AvatarImage src={''} alt={user.userName} />
        <AvatarFallback className='rounded-lg'>
          {user.userName.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      {showInfo && (
        <div className='grid flex-1 text-left text-sm leading-tight'>
          <span className='truncate font-semibold'>{user.userName}</span>
          <span className='truncate text-xs'>
            {
              SHORT_ROLE_TO_LONG_ROLE[
                user.role as keyof typeof SHORT_ROLE_TO_LONG_ROLE
              ]
            }{user.userNumber && ` · ${user.userNumber}`}
          </span>
        </div>
      )}
    </div>
  )
}
