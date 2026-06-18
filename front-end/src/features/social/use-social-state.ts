import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { SocialComment, SocialState, SocialUser } from './types'

type Action =
  | { type: 'reset_user'; userId: string }
  | { type: 'follow_user'; currentUserId: string; userId: string }
  | { type: 'send_friend_request'; currentUserId: string; userId: string }
  | { type: 'toggle_like'; currentUserId: string; postId: string }
  | { type: 'add_comment'; currentUserId: string; postId: string; authorId: string; message: string }

const socialStateStorageKey = 'nutrisocial-social-state'
const userSocialStateKey = (userId: string) => `${socialStateStorageKey}:${userId}`

function buildInitialState(currentUserId: string): SocialState {
  return {
    currentUserId,
    commentsByPostId: {},
    likedPostIds: [],
    followingIds: [],
    sentFriendRequestIds: [],
  }
}

function readSocialState(currentUserId: string): SocialState {
  if (typeof window === 'undefined') return buildInitialState(currentUserId)
  try {
    const rawValue = window.localStorage.getItem(userSocialStateKey(currentUserId))
    if (!rawValue) return buildInitialState(currentUserId)
    const parsed = JSON.parse(rawValue) as Partial<SocialState>
    return {
      currentUserId,
      commentsByPostId: parsed.commentsByPostId && typeof parsed.commentsByPostId === 'object'
        ? parsed.commentsByPostId
        : {},
      likedPostIds: Array.isArray(parsed.likedPostIds) ? parsed.likedPostIds.map(String) : [],
      followingIds: Array.isArray(parsed.followingIds) ? parsed.followingIds.map(String) : [],
      sentFriendRequestIds: Array.isArray(parsed.sentFriendRequestIds) ? parsed.sentFriendRequestIds.map(String) : [],
    }
  } catch {
    return buildInitialState(currentUserId)
  }
}

function storeSocialState(state: SocialState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(userSocialStateKey(state.currentUserId), JSON.stringify(state))
}

function readAllSocialStates(activeState: SocialState): SocialState[] {
  if (typeof window === 'undefined') return [activeState]

  const prefix = `${socialStateStorageKey}:`
  const statesByUserId = new Map<string, SocialState>()

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith(prefix)) continue
    const userId = key.slice(prefix.length)
    if (!userId) continue
    statesByUserId.set(userId, readSocialState(userId))
  }

  statesByUserId.set(activeState.currentUserId, activeState)
  return [...statesByUserId.values()]
}

function commitSocialState(previousState: SocialState, nextState: SocialState) {
  if (nextState !== previousState) {
    storeSocialState(nextState)
  }
  return nextState
}

function socialReducer(state: SocialState, action: Action): SocialState {
  const activeState = 'currentUserId' in action && state.currentUserId !== action.currentUserId
    ? readSocialState(action.currentUserId)
    : state

  switch (action.type) {
    case 'reset_user':
      return readSocialState(action.userId)
    case 'follow_user': {
      if (action.userId === activeState.currentUserId || activeState.followingIds.includes(action.userId)) {
        return activeState
      }

      return commitSocialState(activeState, {
        ...activeState,
        followingIds: [...activeState.followingIds, action.userId],
      })
    }
    case 'send_friend_request': {
      if (
        action.userId === activeState.currentUserId ||
        activeState.sentFriendRequestIds.includes(action.userId)
      ) {
        return activeState
      }

      return commitSocialState(activeState, {
        ...activeState,
        sentFriendRequestIds: [...activeState.sentFriendRequestIds, action.userId],
      })
    }
    case 'toggle_like': {
      const isLiked = activeState.likedPostIds.includes(action.postId)

      return commitSocialState(activeState, {
        ...activeState,
        likedPostIds: isLiked
          ? activeState.likedPostIds.filter((postId) => postId !== action.postId)
          : [...activeState.likedPostIds, action.postId],
      })
    }
    case 'add_comment': {
      const trimmedMessage = action.message.trim()

      if (trimmedMessage.length === 0) {
        return activeState
      }

      const nextComment: SocialComment = {
        id: `comment-${action.postId}-${Date.now()}`,
        postId: action.postId,
        authorId: action.authorId,
        message: trimmedMessage,
        createdAt: new Date().toISOString(),
      }

      return commitSocialState(activeState, {
        ...activeState,
        commentsByPostId: {
          ...activeState.commentsByPostId,
          [action.postId]: [...(activeState.commentsByPostId[action.postId] ?? []), nextComment],
        },
      })
    }
    default:
      return state
  }
}

export function useSocialState(currentUserId: string, usersById: Record<string, SocialUser>) {
  const [state, dispatch] = useReducer(
    socialReducer,
    currentUserId,
    readSocialState,
  )
  const activeState = state.currentUserId === currentUserId ? state : readSocialState(currentUserId)

  useEffect(() => {
    dispatch({ type: 'reset_user', userId: currentUserId })
  }, [currentUserId])

  useEffect(() => {
    if (state.currentUserId === currentUserId) {
      storeSocialState(state)
    }
  }, [currentUserId, state])

  const followingSet = useMemo(() => new Set(activeState.followingIds), [activeState.followingIds])
  const requestSet = useMemo(
    () => new Set(activeState.sentFriendRequestIds),
    [activeState.sentFriendRequestIds],
  )
  const likedPostSet = useMemo(() => new Set(activeState.likedPostIds), [activeState.likedPostIds])
  const allSocialStates = useMemo(() => readAllSocialStates(activeState), [activeState])
  const commentsByPostId = useMemo(() => {
    const next: Record<string, SocialComment[]> = {}

    allSocialStates.forEach((userState) => {
      Object.entries(userState.commentsByPostId).forEach(([postId, comments]) => {
        next[postId] = [...(next[postId] ?? []), ...comments]
      })
    })

    Object.keys(next).forEach((postId) => {
      next[postId].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    })

    return next
  }, [allSocialStates])
  const likeCountsByPostId = useMemo(() => {
    const likedUsersByPostId = new Map<string, Set<string>>()

    allSocialStates.forEach((userState) => {
      new Set(userState.likedPostIds).forEach((postId) => {
        const likedUsers = likedUsersByPostId.get(postId) ?? new Set<string>()
        likedUsers.add(userState.currentUserId)
        likedUsersByPostId.set(postId, likedUsers)
      })
    })

    return [...likedUsersByPostId.entries()].reduce<Record<string, number>>((acc, [postId, likedUsers]) => {
      acc[postId] = likedUsers.size
      return acc
    }, {})
  }, [allSocialStates])

  const followingUsers = useMemo(
    () => activeState.followingIds.map((userId) => usersById[userId]).filter(Boolean),
    [activeState.followingIds, usersById],
  )

  const followUser = useCallback((userId: string) => {
    if (userId === currentUserId) return
    dispatch({ type: 'follow_user', currentUserId, userId })
  }, [currentUserId])

  const sendFriendRequest = useCallback((userId: string) => {
    if (userId === currentUserId) return
    dispatch({ type: 'send_friend_request', currentUserId, userId })
  }, [currentUserId])

  const addComment = useCallback((postId: string, message: string) => {
    dispatch({ type: 'add_comment', currentUserId, postId, authorId: currentUserId, message })
  }, [currentUserId])

  const toggleLike = useCallback((postId: string) => {
    dispatch({ type: 'toggle_like', currentUserId, postId })
  }, [currentUserId])

  return {
    commentsByPostId,
    likeCountsByPostId,
    followingUsers,
    followingSet,
    requestSet,
    likedPostSet,
    followUser,
    sendFriendRequest,
    addComment,
    toggleLike,
  }
}
