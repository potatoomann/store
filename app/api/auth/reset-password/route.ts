import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { badRequest } from '@/lib/api';
import { hashToken } from '@/lib/api';

export async function POST(req: Request) {
    try {
        const { token, password } = await req.json();

        if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
            return badRequest('Missing token or password');
        }
        if (password.length < 8) {
            return badRequest('Password must be at least 8 characters long');
        }

        const user = await prisma.user.findFirst({
            where: {
                resetToken: hashToken(token),
                resetTokenExpiry: { gt: new Date() },
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword, resetToken: null, resetTokenExpiry: null },
        });

        return NextResponse.json({ message: 'Password reset successful' });

    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
