import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { sendWelcomeEmail } from '@/lib/email';
import { badRequest, created, rateLimit } from '@/lib/api';

export async function POST(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for') || 'local';
        const rl = rateLimit(`register:${ip}`, 5, 60_000);
        if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

        const { name, email, password } = await req.json();

        if (!name || typeof name !== 'string' || !email || typeof email !== 'string' || !password || typeof password !== 'string') {
            return badRequest('Missing required fields');
        }

        if (password.length < 8) {
            return badRequest('Password must be at least 8 characters long');
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return NextResponse.json({ error: 'User already exists' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: { name, email, password: hashedPassword },
        });

        const { password: _, ...userWithoutPassword } = user;

        await sendWelcomeEmail(email, name);

        return created(userWithoutPassword);
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
