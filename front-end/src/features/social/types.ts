export type FeedTab = 'para-ti' | 'siguiendo'

export type FollowStatus = 'not_following' | 'following'
export type FriendshipStatus = 'none' | 'request_sent' | 'friends'

export type UserRelationship = {
  followStatus: FollowStatus
  friendshipStatus: FriendshipStatus
}

export type SocialUser = {
  id: string
  username: string
  displayName: string
  avatarUrl: string
  bio: string
  followersCount: number
  followingCount: number
  relationshipWithMe: UserRelationship
}

export type SocialPost = {
  id: string
  authorId: string
  imageUrl: string
  caption: string
  createdAt: string
  likesCount: number
  interactionsCount: number
}

export type SocialState = {
  currentUserId: string
  usersById: Record<string, SocialUser>
  postsById: Record<string, SocialPost>
  postIds: string[]
  followingIds: string[]
  sentFriendRequestIds: string[]
}
