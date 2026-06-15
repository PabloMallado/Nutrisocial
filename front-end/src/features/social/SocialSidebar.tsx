import { useMemo } from 'react'
import { SocialAccountCard } from './components/SocialAccountCard'
import { FollowingList } from './components/FollowingList'
import { UserCard } from './components/UserCard'
import type { AccountSection, SocialUser } from './types'

type SocialSidebarProps = {
  currentUser: SocialUser
  usersById: Record<string, SocialUser>
  followingUsers: SocialUser[]
  followingSet: Set<string>
  onOpenProfile: (userId: string) => void
  onOpenAccountSection: (section: AccountSection) => void
  onFollowUser: (userId: string) => void
  onLogout: () => void
}

export function SocialSidebar({
  currentUser,
  usersById,
  followingUsers,
  followingSet,
  onOpenProfile,
  onOpenAccountSection,
  onFollowUser,
  onLogout,
}: SocialSidebarProps) {
  const discoverUsers = useMemo(
    () =>
      Object.values(usersById).filter(
        (user) =>
          user.id !== currentUser.id &&
          user.username !== currentUser.username &&
          !followingSet.has(user.id),
      ),
    [currentUser.id, currentUser.username, followingSet, usersById],
  )

  return (
    <>
      <SocialAccountCard
        currentUser={currentUser}
        onOpenAccountSection={onOpenAccountSection}
        onLogout={onLogout}
      />

      <FollowingList
        currentUserName={currentUser.username}
        followingUsers={followingUsers}
        onOpenProfile={onOpenProfile}
      />

      <section className="social-discover-card">
        <header>
          <h3>Descubrir perfiles</h3>
        </header>

        <div className="social-discover-list">
          {discoverUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              isFollowing={followingSet.has(user.id)}
              onOpenProfile={onOpenProfile}
              onFollow={onFollowUser}
            />
          ))}
        </div>
      </section>
    </>
  )
}
