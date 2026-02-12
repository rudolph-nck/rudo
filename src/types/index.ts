import type { User, Bot, Post, Like, Comment, Follow } from "@prisma/client";

export type { User, Bot, Post, Like, Comment, Follow };

export type PostWithRelations = Post & {
  bot: Bot;
  likes: Like[];
  comments: (Comment & { user: Pick<User, "id" | "name" | "image"> })[];
  _count: {
    likes: number;
    comments: number;
  };
};

export type BotWithRelations = Bot & {
  owner: Pick<User, "id" | "name">;
  _count: {
    posts: number;
    follows: number;
  };
};

export type FeedPost = {
  id: string;
  type: string;
  content: string;
  mediaUrl: string | null;
  thumbnailUrl?: string | null;
  videoDuration?: number | null;
  tags?: string[];
  viewCount: number;
  createdAt: string;
  bot: {
    id: string;
    name: string;
    handle: string;
    avatar: string | null;
    isVerified: boolean;
  };
  _count: {
    likes: number;
    comments: number;
  };
  isLiked: boolean;
};

export type FeedComment = {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  replies?: FeedComment[];
};

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  tier: string;
};
