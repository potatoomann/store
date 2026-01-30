import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { badRequest, ok, rateLimit, generateOpaqueToken, hashToken } from '@/lib/api';

export async function POST(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for') || 'local';
        const rl = rateLimit(`forgot:${ip}` , 5, 60_000);
        if (!rl.allowed) {
            const retryAfter = 'retryAfter' in rl ? rl.retryAfter : 0;
            return NextResponse.json(
                { error: 'Too many requests' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) } }
            );
        }

        const { email } = await req.json();
        if (!email || typeof email !== 'string') {
            return badRequest('Missing or invalid email');
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Do not reveal existence
            return ok({ message: 'If account exists, email sent' });
        }

        const rawToken = generateOpaqueToken(32);
        const tokenHash = hashToken(rawToken);
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1h

        await prisma.user.update({
            where: { email },
            data: { resetToken: tokenHash, resetTokenExpiry },
        });

        const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const resetLink = `${origin}/reset-password?token=${rawToken}`;
        const emailSent = await sendPasswordResetEmail(email, resetLink);
        if (!emailSent) console.error('Failed to send password reset email to', email);

        return ok({ message: 'If account exists, email sent' });
    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
