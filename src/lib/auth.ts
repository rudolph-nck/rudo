import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Invalid email or password");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          handle: user.handle,
          image: user.image,
          role: user.role,
          tier: user.tier,
          hasUsedTrial: user.hasUsedTrial,
          trialEnd: user.trialEnd?.toISOString() || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.handle = (user as any).handle;
        token.role = (user as any).role;
        token.tier = (user as any).tier;
        token.hasUsedTrial = (user as any).hasUsedTrial;
        token.trialEnd = (user as any).trialEnd;
      }
      // Refresh from DB when session is updated (e.g. after payment or profile edit)
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { handle: true, role: true, tier: true, hasUsedTrial: true, trialEnd: true },
        });
        if (dbUser) {
          token.handle = dbUser.handle;
          token.role = dbUser.role;
          token.tier = dbUser.tier;
          token.hasUsedTrial = dbUser.hasUsedTrial;
          token.trialEnd = dbUser.trialEnd?.toISOString() || null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).handle = token.handle;
        (session.user as any).role = token.role;
        (session.user as any).tier = token.tier;
        (session.user as any).hasUsedTrial = token.hasUsedTrial;
        (session.user as any).trialEnd = token.trialEnd;
      }
      return session;
    },
  },
};
