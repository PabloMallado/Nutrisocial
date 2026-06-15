import { useCallback, useMemo, useReducer } from 'react'
import type { SocialComment, SocialState, SocialUser } from './types'

type Action =
  | { type: 'follow_user'; userId: string }
  | { type: 'toggle_like'; postId: string }
  | { type: 'add_comment'; postId: string; authorId: string; message: string }

function buildInitialState(currentUserId: string): SocialState {
  return {
    currentUserId,
    commentsByPostId: {},
    likedPostIds: [],
    followingIds: [],
  }
}

function socialReducer(state: SocialState, action: Action): SocialState {
  switch (action.type) {
    case 'follow_user': {
      if (action.userId === state.currentUserId || state.followingIds.includes(action.userId)) {
        return state
      }

      return {
        ...state,
        followingIds: [...state.followingIds, action.userId],
      }
    }
    case 'toggle_like': {
      const isLiked = state.likedPostIds.includes(action.postId)

      return {
        ...state,
        likedPostIds: isLiked
          ? state.likedPostIds.filter((postId) => postId !== action.postId)
          : [...state.likedPostIds, action.postId],
      }
    }
    case 'add_comment': {
      const trimmedMessage = action.message.trim()

      if (trimmedMessage.length === 0) {
        return state
      }

      const nextComment: SocialComment = {
        id: `comment-${action.postId}-${Date.now()}`,
        postId: action.postId,
        authorId: action.authorId,
        message: trimmedMessage,
        createdAt: new Date().toISOString(),
      }

      return {
        ...state,
        commentsByPostId: {
          ...state.commentsByPostId,
          [action.postId]: [...(state.commentsByPostId[action.postId] ?? []), nextComment],
        },
      }
    }
    default:
      return state
  }
}

export function useSocialState(currentUserId: string, usersById: Record<string, SocialUser>) {
  const [state, dispatch] = useReducer(
    socialReducer,
    currentUserId,
    buildInitialState,
  )

  const followingSet = useMemo(() => new Set(state.followingIds), [state.followingIds])
  const likedPostSet = useMemo(() => new Set(state.likedPostIds), [state.likedPostIds])

  const followingUsers = useMemo(
    () => state.followingIds.map((userId) => usersById[userId]).filter(Boolean),
    [state.followingIds, usersById],
  )

  const followUser = useCallback((userId: string) => {
    const currentUser = usersById[currentUserId]
    const targetUser = usersById[userId]

    if (targetUser?.username && currentUser?.username === targetUser.username) {
      return
    }

    dispatch({ type: 'follow_user', userId })
  }, [currentUserId, usersById])

  const addComment = useCallback((postId: string, message: string) => {
    dispatch({ type: 'add_comment', postId, authorId: currentUserId, message })
  }, [currentUserId])

  const toggleLike = useCallback((postId: string) => {
    dispatch({ type: 'toggle_like', postId })
  }, [])

  return {
    commentsByPostId: state.commentsByPostId,
    followingUsers,
    followingSet,
    likedPostSet,
    followUser,
    addComment,
    toggleLike,
  }
}
