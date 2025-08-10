import NextAuth, { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { JWT } from 'next-auth/jwt';
import { db, users, getUserByEmail } from '@/lib/db';
import { eq } from 'drizzle-orm';

export type AppUserRole = 'admin' | 'editor' | 'viewer';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      email?: string | null;
      role?: AppUserRole;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: AppUserRole;
    uid?: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    }),
  ],
  session: { strategy: 'jwt', maxAge: 2 * 60 * 60 },
  jwt: {
    maxAge: 2 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user?.email) {
        // Ensure user exists in DB and fetch role
        let existing = await getUserByEmail(user.email);
        if (!existing) {
          const inserted = await db.insert(users).values({ email: user.email }).returning();
          existing = inserted[0];
        }
        token.role = existing.role as AppUserRole;
        token.uid = existing.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as AppUserRole | undefined;
        if (token.uid) session.user.id = token.uid;
      }
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Host-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export function assertRole(role: AppUserRole | AppUserRole[] | undefined, allowed: AppUserRole[]): boolean {
  if (!role) return false;
  return allowed.includes(role);
}


