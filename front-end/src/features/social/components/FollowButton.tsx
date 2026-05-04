type FollowButtonProps = {
  isFollowing: boolean
  onClick: () => void
}

export function FollowButton({ isFollowing, onClick }: FollowButtonProps) {
  return (
    <button
      type="button"
      className={`social-action-btn ${isFollowing ? 'is-following' : 'is-primary'}`}
      onClick={onClick}
      disabled={isFollowing}
    >
      {isFollowing ? 'Siguiendo' : 'Seguir'}
    </button>
  )
}
