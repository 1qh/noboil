'use client'

import type { ComponentType } from 'react'

import { cn } from '@a/ui'

interface MembersPageShellProps {
  canManageMembers: boolean
  className?: string
  headerClassName?: string
  InviteDialog: ComponentType<{ orgId: string }>
  JoinRequests: ComponentType
  MemberList: ComponentType
  orgId: string
  PendingInvites: ComponentType
  title?: string
}

const MembersPageShell = ({
  canManageMembers,
  className,
  headerClassName,
  InviteDialog,
  JoinRequests,
  MemberList,
  orgId,
  PendingInvites,
  title = 'Members'
}: MembersPageShellProps) => (
  <div className={cn('space-y-6', className)}>
    <div className={cn('flex items-center justify-between', headerClassName)}>
      <h1 className='text-2xl font-bold'>{title}</h1>
      {canManageMembers ? <InviteDialog orgId={orgId} /> : null}
    </div>
    <MemberList />
    {canManageMembers ? <PendingInvites /> : null}
    {canManageMembers ? <JoinRequests /> : null}
  </div>
)

export type { MembersPageShellProps }
export default MembersPageShell
