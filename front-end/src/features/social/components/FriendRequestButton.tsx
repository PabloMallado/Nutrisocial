type FriendRequestButtonProps = {
  hasRequest: boolean
  onClick: () => void
}

export function FriendRequestButton({ hasRequest, onClick }: FriendRequestButtonProps) {
  return (
    <button
      type="button"
      className={`social-action-btn ${hasRequest ? 'is-sent' : 'is-secondary'}`}
      onClick={onClick}
      disabled={hasRequest}
    >
      {hasRequest ? 'Solicitud enviada' : 'Anadir'}
    </button>
  )
}
