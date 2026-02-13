import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      handle: string | null;
      image: string | null;
      role: string;
      tier: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    handle: string | null;
    role: string;
    tier: string;
  }
}
