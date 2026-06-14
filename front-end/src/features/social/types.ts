export type FeedTab = 'para-ti' | 'siguiendo'
export type AccountSection = 'overview' | 'saved' | 'settings' | 'preferences'

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

export type SocialRecipeIngredient = {
  name: string
  amount: string
}

export type SocialRecipe = {
  title: string
  description: string
  difficulty: string
  prepTimeMinutes: number
  servings: number
  calories: number
  protein: number
  carbs: number
  fat: number
  ingredients: SocialRecipeIngredient[]
  steps: string[]
}

export type SocialComment = {
  id: string
  postId: string
  authorId: string
  message: string
  createdAt: string
}

export type SocialPost = {
  id: string
  authorId: string
  imageUrl: string
  title: string
  caption: string
  createdAt: string
  likesCount: number
  interactionsCount: number
  recipe: SocialRecipe
}

export type SocialState = {
  currentUserId: string
  commentsByPostId: Record<string, SocialComment[]>
  likedPostIds: string[]
  followingIds: string[]
  sentFriendRequestIds: string[]
}
