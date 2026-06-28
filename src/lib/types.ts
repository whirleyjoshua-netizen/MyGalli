// Block types
export type BlockType = 'image' | 'text' | 'link' | 'embed' | 'heading'

export interface ImageBlockContent {
  url: string
  alt?: string
  caption?: string
}

export interface TextBlockContent {
  text: string
}

export interface HeadingBlockContent {
  text: string
  level: 1 | 2 | 3
}

export interface LinkBlockContent {
  url: string
  title: string
  description?: string
  thumbnail?: string
}

export interface EmbedBlockContent {
  url: string
  type: 'youtube' | 'vimeo' | 'spotify' | 'other'
}

export type BlockContent =
  | ImageBlockContent
  | TextBlockContent
  | HeadingBlockContent
  | LinkBlockContent
  | EmbedBlockContent

export interface Block {
  id: string
  type: BlockType
  content: BlockContent
  order: number
}

// Layout types
export type LayoutType = 'grid' | 'masonry' | 'list' | 'carousel'

// Theme types
export type ThemeType = 'default' | 'dark' | 'minimal' | 'bold'

// Display
export interface Display {
  id: string
  slug: string
  title: string
  description?: string
  theme: ThemeType
  layout: LayoutType
  published: boolean
  views: number
  blocks: Block[]
  user: {
    username: string
    name?: string
    avatar?: string
  }
}

// Auth
export interface User {
  id: string
  email: string
  username: string
  name?: string
  avatar?: string
  bio?: string
  emailVerified?: string | Date | null
}

export interface AuthState {
  user: User | null
  setAuth: (user: User) => void
  logout: () => void
}
