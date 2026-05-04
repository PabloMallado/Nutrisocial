import type { SocialPost, SocialUser } from './types'

export const CURRENT_USER_ID = 'me'

export const mockCurrentUser: SocialUser = {
  id: CURRENT_USER_ID,
  username: 'fernandorm',
  displayName: 'Fernando RM',
  avatarUrl: 'https://i.pravatar.cc/160?img=14',
  bio: 'Construyendo una comunidad saludable plato a plato.',
  followersCount: 42,
  followingCount: 18,
  relationshipWithMe: {
    followStatus: 'following',
    friendshipStatus: 'friends',
  },
}

export const mockUsers: SocialUser[] = [
  {
    id: 'usr-lucia',
    username: 'nutri_lucia',
    displayName: 'Lucia Mendez',
    avatarUrl: 'https://i.pravatar.cc/160?img=32',
    bio: 'Nutricion practica y recetas rapidas para el dia a dia.',
    followersCount: 128,
    followingCount: 76,
    relationshipWithMe: {
      followStatus: 'not_following',
      friendshipStatus: 'none',
    },
  },
  {
    id: 'usr-marcos',
    username: 'chefmarcos',
    displayName: 'Marcos Ruiz',
    avatarUrl: 'https://i.pravatar.cc/160?img=12',
    bio: 'Batch cooking y comida real para semanas con poco tiempo.',
    followersCount: 203,
    followingCount: 92,
    relationshipWithMe: {
      followStatus: 'not_following',
      friendshipStatus: 'none',
    },
  },
  {
    id: 'usr-andrea',
    username: 'verde_andrea',
    displayName: 'Andrea Gil',
    avatarUrl: 'https://i.pravatar.cc/160?img=47',
    bio: 'Ideas frescas de mercado y platos ligeros de temporada.',
    followersCount: 167,
    followingCount: 61,
    relationshipWithMe: {
      followStatus: 'not_following',
      friendshipStatus: 'none',
    },
  },
]

export const mockPosts: SocialPost[] = [
  {
    id: 'post-lucia-1',
    authorId: 'usr-lucia',
    imageUrl: 'https://picsum.photos/seed/lucia-breakfast/960/720',
    caption: 'Desayuno alto en proteina listo en menos de 8 minutos.',
    createdAt: '2026-04-08T09:10:00.000Z',
    likesCount: 83,
    interactionsCount: 19,
  },
  {
    id: 'post-lucia-2',
    authorId: 'usr-lucia',
    imageUrl: 'https://picsum.photos/seed/lucia-snack/960/720',
    caption: 'Snack post-entreno: yogur, frutos rojos y semillas.',
    createdAt: '2026-04-07T15:20:00.000Z',
    likesCount: 54,
    interactionsCount: 12,
  },
  {
    id: 'post-marcos-1',
    authorId: 'usr-marcos',
    imageUrl: 'https://picsum.photos/seed/marcos-bowl/960/720',
    caption: 'Bowl de arroz integral con pollo especiado y vegetales.',
    createdAt: '2026-04-08T07:45:00.000Z',
    likesCount: 97,
    interactionsCount: 25,
  },
  {
    id: 'post-marcos-2',
    authorId: 'usr-marcos',
    imageUrl: 'https://picsum.photos/seed/marcos-prep/960/720',
    caption: 'Domingo de batch cooking: 4 comidas preparadas en 1 hora.',
    createdAt: '2026-04-06T19:40:00.000Z',
    likesCount: 131,
    interactionsCount: 33,
  },
  {
    id: 'post-andrea-1',
    authorId: 'usr-andrea',
    imageUrl: 'https://picsum.photos/seed/andrea-salad/960/720',
    caption: 'Ensalada crunchy con garbanzos y vinagreta citrica.',
    createdAt: '2026-04-08T10:55:00.000Z',
    likesCount: 74,
    interactionsCount: 17,
  },
  {
    id: 'post-andrea-2',
    authorId: 'usr-andrea',
    imageUrl: 'https://picsum.photos/seed/andrea-market/960/720',
    caption: 'Compra inteligente: productos frescos para toda la semana.',
    createdAt: '2026-04-07T11:05:00.000Z',
    likesCount: 66,
    interactionsCount: 14,
  },
]
