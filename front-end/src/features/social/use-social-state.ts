import { useCallback, useMemo, useReducer } from 'react'
import type { SocialComment, SocialState, SocialUser } from './types'

type Action =
  | { type: 'follow_user'; userId: string }
  | { type: 'send_friend_request'; userId: string }
  | { type: 'add_comment'; postId: string; authorId: string; message: string }

function buildInitialState(currentUserId: string): SocialState {
  return {
    currentUserId,
    commentsByPostId: {},
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

      return {
        ...state,
        followingIds: [...state.followingIds, action.userId],
      }
    }
    case 'send_friend_request': {
      if (
        action.userId === state.currentUserId ||
        state.sentFriendRequestIds.includes(action.userId)
      ) {
        return state
      }

      return {
        ...state,
        sentFriendRequestIds: [...state.sentFriendRequestIds, action.userId],
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
  const requestSet = useMemo(
    () => new Set(state.sentFriendRequestIds),
    [state.sentFriendRequestIds],
  )

  const followingUsers = useMemo(
    () => state.followingIds.map((userId) => usersById[userId]).filter(Boolean),
    [state.followingIds, usersById],
  )

  const followUser = useCallback((userId: string) => {
    dispatch({ type: 'follow_user', userId })
  }, [])

  const sendFriendRequest = useCallback((userId: string) => {
    dispatch({ type: 'send_friend_request', userId })
  }, [])

  const addComment = useCallback((postId: string, message: string) => {
    dispatch({ type: 'add_comment', postId, authorId: currentUserId, message })
  }, [currentUserId])

  return {
    commentsByPostId: state.commentsByPostId,
    followingUsers,
    followingSet,
    requestSet,
    followUser,
    sendFriendRequest,
    addComment,
  }
}
