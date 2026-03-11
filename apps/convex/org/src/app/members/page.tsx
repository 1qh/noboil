'use client'

import MembersPageShell from '@a/fe/members-page-shell'
import { useOrg } from '~/hook/use-org'

import InviteDialog from './invite-dialog'
import JoinRequests from './join-requests'
import MemberList from './member-list'
import PendingInvites from './pending-invites'

const MembersPage = () => {
  const { canManageMembers, org } = useOrg()
  return (
    <MembersPageShell
      JoinRequests={JoinRequests}
      MemberList={MemberList}
      PendingInvites={PendingInvites}
      InviteDialog={InviteDialog}
      canManageMembers={canManageMembers}
      orgId={org._id}
    />
  )
}

export default MembersPage
