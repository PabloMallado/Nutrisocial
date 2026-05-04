import { useCallback, useMemo, useReducer } from 'react'
import { CURRENT_USER_ID, mockComments, mockCurrentUser, mockPosts, mockUsers } from './mock-data'
import type { FeedTab, SocialComment, SocialPost, SocialState, SocialUser } from './types'

type Action =
  | { type: 'follow_user'; userId: string }
  | { type: 'send_friend_request'; userId: string }
  | { type: 'add_comment'; postId: string; message: string }

function sortPostIdsByRecent(posts: SocialPost[]): string[] {
  return [...posts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((post) => post.id)
}

function buildInitialState(): SocialState {
  const usersById = [...mockUsers, mockCurrentUser].reduce<Record<string, SocialUser>>((acc, user) => {
    acc[user.id] = user
    return acc
  }, {})

  const postsById = mockPosts.reduce<Record<string, SocialPost>>((acc, post) => {
    acc[post.id] = post
    return acc
  }, {})

  const commentsByPostId = mockComments.reduce<Record<string, SocialComment[]>>((acc, comment) => {
    acc[comment.postId] = [...(acc[comment.postId] ?? []), comment]
    return acc
  }, {})

  return {
    currentUserId: CURRENT_USER_ID,
    usersById,
    postsById,
    commentsByPostId,
    postIds: sortPostIdsByRecent(mockPosts),
    followingIds: [],
    sentFriendRequestIds: [],
  }
}

function socialReducer(state: SocialState, action: Action): SocialState {
  switch (action.type) {
    case 'follow_user': {
      if (action.userId === state.currentUserId || state.followingIds.includes(action.userId)) {
        return state
      }

      const targetUser = state.usersById[action.userId]
      const currentUser = state.usersById[state.currentUserId]

      if (!targetUser || !currentUser) {
        return state
      }

      return {
        ...state,
        followingIds: [...state.followingIds, action.userId],
        usersById: {
          ...state.usersById,
          [action.userId]: {
            ...targetUser,
            followersCount: targetUser.followersCount + 1,
            relationshipWithMe: {
              ...targetUser.relationshipWithMe,
              followStatus: 'following',
            },
          },
          [state.currentUserId]: {
            ...currentUser,
            followingCount: currentUser.followingCount + 1,
          },
        },
      }
    }
    case 'send_friend_request': {
      if (
        action.userId === state.currentUserId ||
        state.sentFriendRequestIds.includes(action.userId)
      ) {
        return state
      }

      const targetUser = state.usersById[action.userId]
      if (!targetUser) {
        return state
      }

      return {
        ...state,
        sentFriendRequestIds: [...state.sentFriendRequestIds, action.userId],
        usersById: {
          ...state.usersById,
          [action.userId]: {
            ...targetUser,
            relationshipWithMe: {
              ...targetUser.relationshipWithMe,
              friendshipStatus: 'request_sent',
            },
          },
        },
      }
    }
    case 'add_comment': {
      const post = state.postsById[action.postId]
      const trimmedMessage = action.message.trim()

      if (!post || trimmedMessage.length === 0) {
        return state
      }

      const nextComment: SocialComment = {
        id: `comment-${action.postId}-${Date.now()}`,
        postId: action.postId,
        authorId: state.currentUserId,
        message: trimmedMessage,
        createdAt: new Date().toISOString(),
      }

      return {
        ...state,
        commentsByPostId: {
          ...state.commentsByPostId,
          [action.postId]: [...(state.commentsByPostId[action.postId] ?? []), nextComment],
        },
        postsById: {
          ...state.postsById,
          [action.postId]: {
            ...post,
            interactionsCount: post.interactionsCount + 1,
          },
        },
      }
    }
    default:
      return state
  }
}

export function useSocialState() {
  const [state, dispatch] = useReducer(socialReducer, undefined, buildInitialState)

  const followingSet = useMemo(() => new Set(state.followingIds), [state.followingIds])
  const requestSet = useMemo(
    () => new Set(state.sentFriendRequestIds),
    [state.sentFriendRequestIds],
  )

  const allPosts = useMemo(() => state.postIds.map((postId) => state.postsById[postId]), [state.postIds, state.postsById])

  const followingPosts = useMemo(
    () => allPosts.filter((post) => followingSet.has(post.authorId)),
    [allPosts, followingSet],
  )

  const followingUsers = useMemo(
    () => state.followingIds.map((userId) => state.usersById[userId]).filter(Boolean),
    [state.followingIds, state.usersById],
  )

  const commentsByPostId = useMemo(() => state.commentsByPostId, [state.commentsByPostId])

  const followUser = useCallback((userId: string) => {
    dispatch({ type: 'follow_user', userId })
  }, [])

  const sendFriendRequest = useCallback((userId: string) => {
    dispatch({ type: 'send_friend_request', userId })
  }, [])

  const addComment = useCallback((postId: string, message: string) => {
    dispatch({ type: 'add_comment', postId, message })
  }, [])

  const getFeedPosts = useCallback(
    (feedTab: FeedTab) => (feedTab === 'para-ti' ? allPosts : followingPosts),
    [allPosts, followingPosts],
  )

  const getUserPosts = useCallback(
    (userId: string) => allPosts.filter((post) => post.authorId === userId),
    [allPosts],
  )

  return {
    currentUser: state.usersById[state.currentUserId],
    usersById: state.usersById,
    allPosts,
    commentsByPostId,
    followingPosts,
    followingUsers,
    followingSet,
    requestSet,
    followUser,
    sendFriendRequest,
    addComment,
    getFeedPosts,
    getUserPosts,
  }
}
