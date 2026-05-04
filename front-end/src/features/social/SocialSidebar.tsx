import { useMemo } from 'react'
import { FollowingList } from './components/FollowingList'
import { UserCard } from './components/UserCard'
import type { SocialUser } from './types'

type SocialSidebarProps = {
  currentUser: SocialUser
  usersById: Record<string, SocialUser>
  followingUsers: SocialUser[]
  followingSet: Set<string>
  requestSet: Set<string>
  onOpenProfile: (userId: string) => void
  onFollowUser: (userId: string) => void
  onSendFriendRequest: (userId: string) => void
}

export function SocialSidebar({
  currentUser,
  usersById,
  followingUsers,
  followingSet,
  requestSet,
  onOpenProfile,
  onFollowUser,
  onSendFriendRequest,
}: SocialSidebarProps) {
  const discoverUsers = useMemo(
    () =>
      Object.values(usersById).filter(
        (user) => user.id !== currentUser.id && !followingSet.has(user.id),
      ),
    [currentUser.id, followingSet, usersById],
  )

  return (
    <>
      <FollowingList
        currentUserName={currentUser.username}
        followingUsers={followingUsers}
        onOpenProfile={onOpenProfile}
      />

      <section className="social-discover-card">
        <header>
          <h3>Descubrir perfiles</h3>
          <p>Perfiles sugeridos para ampliar tu red.</p>
        </header>

        <div className="social-discover-list">
          {discoverUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              isFollowing={followingSet.has(user.id)}
              hasRequest={requestSet.has(user.id)}
              onOpenProfile={onOpenProfile}
              onFollow={onFollowUser}
              onSendFriendRequest={onSendFriendRequest}
            />
          ))}
        </div>
      </section>
    </>
  )
}
